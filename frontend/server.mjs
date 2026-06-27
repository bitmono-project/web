import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL ?? 'http://api:8430';
const port = Number(process.env.PORT ?? 8429);

const app = express();
// http-proxy-middleware v3 no longer re-adds Express mount paths — proxy at root with pathFilter
// so /protections, /version, and /obfuscate/* reach the API with the full path intact.
app.use(createProxyMiddleware({
  target: apiUrl,
  // Keep the original Host (bitmono.dev) instead of rewriting it to api:8430 — the API needs it
  // (with X-Forwarded-Proto from Cloudflare) to build correct https://bitmono.dev OAuth redirect URIs.
  changeOrigin: false,
  pathFilter: ['/api', '/obfuscate', '/version', '/protections'],
}));
app.use(express.static(path.join(__dirname, 'dist')));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0');
