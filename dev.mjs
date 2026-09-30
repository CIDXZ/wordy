// Local stand-in for Netlify: serves public/ and runs netlify/functions/chat.mjs at /api/chat.
// Usage: node dev.mjs   (reads GROQ_API_KEY from .env)
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
try { process.loadEnvFile(join(root, '.env')); } catch { console.warn('no .env found, /api/chat will answer 500'); }

const PORT = Number(process.env.PORT || 8732);
const PUBLIC = join(root, 'public');
const TYPES = {'.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript',
               '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'};
const {default: chat} = await import('./netlify/functions/chat.mjs');

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/chat'){
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {
      method: req.method, headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
    });
    const t0 = Date.now();
    const response = await chat(request, {ip: req.socket.remoteAddress});
    const text = await response.text();
    console.log(`${req.method} /api/chat ${response.status} ${Date.now() - t0}ms ${text.slice(0, 140)}`);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(text);
    return;
  }

  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^([/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)){ res.writeHead(403).end(); return; }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream'});
    res.end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`Wordy on http://127.0.0.1:${PORT}`));
