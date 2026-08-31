const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3020;
const BASE_DIRS = {
  teknoloji: 'C:/inetpub/wwwroot/teknoloji',
  technology: 'C:/inetpub/wwwroot/technology'
};

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  const match = pathname.match(/^\/(teknoloji|technology)(\/.*)?$/i);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const appKey = match[1].toLowerCase();
  const subRaw = match[2];

  if (!subRaw || subRaw === '') {
    res.writeHead(301, {
      'Location': `/${appKey}/${parsedUrl.search || ''}`,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end();
    return;
  }

  const subPath = subRaw.replace(/^\//, '');
  const rootDir = BASE_DIRS[appKey];

  let targetFile = path.join(rootDir, subPath);
  if (subPath === '' || subPath.endsWith('/')) {
    targetFile = path.join(rootDir, 'index.html');
  }

  if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    targetFile = path.join(rootDir, 'index.html');
  }

  if (!fs.existsSync(targetFile)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(targetFile).toLowerCase();
  const mime = MIMES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*'
  });

  const stream = fs.createReadStream(targetFile);
  stream.pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RadioTEDU Technology Server running on http://127.0.0.1:${PORT}`);
});
