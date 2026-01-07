const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const PUBLIC_URL = 'http://localhost:' + PORT;

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

  // --- Secure Hiro API Proxy ---
  if (req.url.startsWith('/hiro-proxy/')) {
    // Expected format: /hiro-proxy/network/path...
    // e.g. /hiro-proxy/mainnet/v2/info
    
    const parts = req.url.split('/');
    // parts[0] = empty (before first slash)
    // parts[1] = 'hiro-proxy'
    // parts[2] = network ('mainnet' or 'testnet')
    // parts[3+] = rest of path

    if (parts.length < 3) {
        res.writeHead(400);
        res.end('Bad Proxy Request: Missing network');
        return;
    }

    const network = parts[2];
    const validNetworks = ['mainnet', 'testnet'];
    
    if (!validNetworks.includes(network)) {
         res.writeHead(400);
         res.end(`Bad Proxy Request: Invalid network '${network}'`);
         return;
    }

    // Reconstruct the target path (everything after the network)
    const targetPath = '/' + parts.slice(3).join('/');
    const HIRO_API_URL = `https://api.${network}.hiro.so${targetPath}`;
    const HIRO_API_KEY = 'fed2e6f5e2f76c4b2167c5104a70262c';

    console.log(`${logPrefix} PROXY -> ${HIRO_API_URL}`);

    const proxyReq = require('https').request(HIRO_API_URL, {
      method: req.method,
      headers: {
        ...req.headers,
        'host': `api.${network}.hiro.so`,
        'x-hiro-api-key': HIRO_API_KEY
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'access-control-allow-origin': '*' // Ensure CORS for local frontend
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`${logPrefix} PROXY ERROR:`, err);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service Unavailable', details: err.message }));
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    return; // Stop processing, don't serve files
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
