import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL ?? 'http://api:8430';
const port = Number(process.env.PORT ?? 8429);

const app = express();
const proxy = createProxyMiddleware({
  target: apiUrl,
  changeOrigin: true,
});

app.use('/obfuscate', proxy);
app.use('/version', proxy);
app.use('/protections', proxy);
app.use(express.static(path.join(__dirname, 'dist')));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0');
