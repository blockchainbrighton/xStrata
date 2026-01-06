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
