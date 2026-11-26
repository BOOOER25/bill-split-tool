const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const project = __dirname;
const port = Number(process.env.BILL_SPLIT_PORT || 8787);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (pathname === '/demo') { res.writeHead(302, { Location: '/demo/' }); res.end(); return; }
  const demo = pathname.startsWith('/demo/');
  const root = path.join(project, demo ? 'dev' : 'dist');
  const relative = demo ? pathname.slice(6) : pathname.slice(1);
  const target = path.resolve(root, relative || 'index.html');
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(target).pipe(res);
  });
});
server.on('error', error => { console.error(error.message); process.exit(1); });
server.listen(port, '0.0.0.0', () => {
  console.log(`本机：http://127.0.0.1:${port}/`);
  console.log(`模拟：http://127.0.0.1:${port}/demo/`);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) console.log(`局域网：http://${item.address}:${port}/`);
  }
});
