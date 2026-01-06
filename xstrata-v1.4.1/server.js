const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Simple .env parser
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
    console.log("Loaded .env configuration.");
  }
} catch (e) {
  console.warn("Could not load .env file:", e);
}

const PORT = 8001;
const PUBLIC_URL = 'http://localhost:' + PORT;
const HIRO_API_KEY = process.env.HIRO_API_KEY;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[${new Date().toISOString()}] [${requestId}]`;

  console.log(`${logPrefix} IN  ${req.method} ${req.url}`);

  // HIRO PROXY HANDLER (Mainnet & Testnet)
  if (req.url.startsWith('/hiro-proxy-mainnet/') || req.url.startsWith('/hiro-proxy-testnet/')) {
    if (!HIRO_API_KEY) {
        console.error(`${logPrefix} PROXY ERROR: Missing HIRO_API_KEY`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server misconfiguration: Missing API Key' }));
        return;
    }

    const isTestnet = req.url.startsWith('/hiro-proxy-testnet/');
    const targetHost = isTestnet ? 'api.testnet.hiro.so' : 'api.hiro.so';
    const prefixToRemove = isTestnet ? '/hiro-proxy-testnet' : '/hiro-proxy-mainnet';
    const targetPath = req.url.replace(prefixToRemove, '');

    const options = {
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: req.method,
      headers: {
        ...req.headers,
        'host': targetHost, // Vital for SNI
        'x-hiro-api-key': HIRO_API_KEY
      }
    };

    // Remove headers that might confuse the upstream
    delete options.headers['host'];
    delete options.headers['connection'];
    delete options.headers['accept-encoding']; 

    console.log(`${logPrefix} PROXY -> https://${targetHost}${targetPath}`);

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (e) => {
      console.error(`${logPrefix} PROXY FAILURE: ${e.message}`);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream unavailable', details: e.message }));
    });

    if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq, { end: true });
    } else {
        proxyReq.end();
    }
    return;
  }

  // Handle errors on the response stream to prevent crashes
  res.on('error', (err) => {
    console.error(`${logPrefix} RES ERROR: ${err.message}`);
  });

  // Log when the request finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${logPrefix} OUT ${res.statusCode} (${duration}ms)`);
  });

  // Handle default route to serve index.html
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.warn(`${logPrefix} 404 Not Found: ${filePath}`);
        fs.readFile('./404.html', (error, content) => {
            if (error) {
                res.writeHead(404, { 
                  'Content-Type': 'text/plain',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(404, { 
                  'Content-Type': 'text/html',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end(content, 'utf-8');
            }
        });
      } else {
        console.error(`${logPrefix} 500 Read Error: ${error.code}`);
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Connection': 'close' // Force close to help tunnel stability
      });
      res.end(content, 'utf-8');
    }
  });
});

// Handle client errors (e.g., malformed requests) that can crash the server or tunnel
server.on('clientError', (err, socket) => {
  console.error(`[${new Date().toISOString()}] CLIENT ERROR: ${err.message}`);
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return;
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// Disable Keep-Alive to improve localtunnel stability
server.keepAliveTimeout = 0;
server.headersTimeout = 0;

// Global error handlers to prevent process exit
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] CRITICAL: Uncaught Exception:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] CRITICAL: Unhandled Rejection at:`, promise, 'reason:', reason);
});

server.listen(PORT, () => {
  console.log(`Server running at ${PUBLIC_URL}/`);
  console.log(`To share this with others, open a new terminal and run: npx localtunnel --port ${PORT}`);
});
