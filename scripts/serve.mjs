// Serves the built atlas (dist/) and prints a QR code, so a phone on the same Wi-Fi can open it.
// Usage: node scripts/serve.mjs   (PORT=9000 node scripts/serve.mjs to change the port)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.bin': 'application/octet-stream', '.gz': 'application/gzip', '.md': 'text/markdown; charset=utf-8',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Папка dist не найдена. Сначала выполните: npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(root, pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Не найдено'); return; }
      const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
      const immutable = /\/assets\//.test(file);
      res.writeHead(200, {
        'Content-Type': type, 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    });
  } catch { res.writeHead(400).end(); }
});

const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
server.listen(port, '0.0.0.0', async () => {
  const local = `http://127.0.0.1:${port}/`, phone = lan ? `http://${lan}:${port}/` : null;
  console.log('\nАтлас тела человека запущен.\n');
  console.log(`  На этом компьютере:  ${local}`);
  if (phone) {
    console.log(`  На iPhone/iPad (тот же Wi-Fi):  ${phone}\n`);
    try { (await import('qrcode-terminal')).default.generate(phone, {small: true}); console.log('\n  Наведите камеру iPhone на QR-код и откройте ссылку.'); } catch { /* the link above is enough */ }
  } else console.log('\n  Сеть Wi-Fi не найдена: телефон подключить не получится.');
  console.log('\n  Чтобы остановить сервер, нажмите Ctrl+C.\n');
  if (process.platform === 'darwin' && !process.env.NO_OPEN) spawn('open', [local], {stdio: 'ignore', detached: true}).unref();
});
