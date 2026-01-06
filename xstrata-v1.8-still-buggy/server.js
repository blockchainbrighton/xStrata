const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const PUBLIC_URL = 'http://localhost:' + PORT;
// TODO: Replace with your actual Hiro API Key
const HIRO_API_KEY = 'fed2e6f5e2f76c4b2167c5104a70262c';

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

  // Handle errors on the response stream to prevent crashes
  res.on('error', (err) => {
    console.error(`${logPrefix} RES ERROR: ${err.message}`);
  });

  // Log when the request finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${logPrefix} OUT ${res.statusCode} (${duration}ms)`);
  });

  // --- Hiro API Proxy ---
  if (req.url.startsWith('/hiro-proxy/')) {
    const proxyPath = req.url.replace('/hiro-proxy/', '');
    let targetHost = '';
    let targetPath = '';

    if (proxyPath.startsWith('mainnet/')) {
        targetHost = 'api.mainnet.hiro.so';
        targetPath = proxyPath.replace('mainnet/', '/');
    } else if (proxyPath.startsWith('testnet/')) {
        targetHost = 'api.testnet.hiro.so';
        targetPath = proxyPath.replace('testnet/', '/');
    } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid proxy network. Use /hiro-proxy/mainnet/... or /hiro-proxy/testnet/...' }));
        return;
    }

    const options = {
        hostname: targetHost,
        port: 443,
        path: targetPath,
        method: req.method,
        headers: {
            ...req.headers,
            'host': targetHost, // Vital for virtual hosting
            'x-api-key': HIRO_API_KEY
        }
    };

    // Remove headers that might confuse the upstream or are not needed
    delete options.headers['host']; // https.request handles this, but explicit override is sometimes safer or needed. 
    // Actually, explicit 'Host' header is good practice for proxies.
    options.headers['Host'] = targetHost;
    delete options.headers['origin'];
    delete options.headers['referer'];

    const proxyReq = https.request(options, (proxyRes) => {
        // Copy status and headers from upstream
        const headers = { ...proxyRes.headers };
        // Ensure CORS headers are set for our local frontend
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, x-hiro-product';

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error(`${logPrefix} PROXY ERROR: ${e.message}`);
        res.writeHead(502, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Proxy upstream error', details: e.message }));
    });

    if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
    return;
  }

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
