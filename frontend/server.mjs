import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crackmeCardPng, siteCardPng } from './og.mjs';
import { headFor, injectHead, buildSitemap } from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL ?? 'http://api:8430';
const port = Number(process.env.PORT ?? 8429);
// Set GSC_VERIFICATION to the google-site-verification token to add the meta tag (URL-prefix property
// fallback). Not needed when verifying via DNS — see SEO.md.
const gscToken = process.env.GSC_VERIFICATION ?? null;

const distDir = path.join(__dirname, 'dist');
const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');

// Cloudflare terminates TLS, so trust its forwarded proto/host to build absolute (https://) URLs.
function originOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'bitmono.dev';
  return `${proto}://${host}`;
}

const app = express();

// http-proxy-middleware v3 proxies at root with pathFilter so /api, /obfuscate, /version, /protections reach
// the API with the full path. Host is preserved (changeOrigin:false) so the API builds correct OAuth redirects.
app.use(createProxyMiddleware({
  target: apiUrl,
  changeOrigin: false,
  pathFilter: ['/api', '/obfuscate', '/version', '/protections'],
}));

// Dynamic Open Graph cards (1200x630 PNG). Cached hard — content is stable and Telegram/Cloudflare cache anyway.
app.get('/og.png', (_req, res) => {
  res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400, immutable').send(siteCardPng());
});
app.get('/og/challenge/:slug.png', async (req, res) => {
  try {
    const r = await fetch(`${apiUrl}/api/crackmes/${encodeURIComponent(req.params.slug)}`, { headers: { accept: 'application/json' } });
    const png = r.ok ? crackmeCardPng(await r.json()) : siteCardPng();
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400').send(png);
  } catch {
    res.set('Content-Type', 'image/png').send(siteCardPng());
  }
});

// XML sitemap — static routes + every public crackme + author profiles, fetched live from the API.
app.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await buildSitemap(originOf(req), { apiUrl });
    res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(xml);
  } catch {
    res.status(500).end();
  }
});

// Hashed build assets + robots.txt. index:false so "/" falls through to the SEO handler below.
app.use(express.static(distDir, { index: false }));

// SPA fallback — serve index.html with per-route <title>, description, canonical, robots, Open Graph,
// Twitter and JSON-LD injected before </head>. Crawlers (Google's first wave, Telegram, X, Discord,
// AI bots) don't run JS, so all SEO-critical head tags must be server-rendered here.
app.use(async (req, res) => {
  const head = await headFor(req, { apiUrl, origin: originOf(req) });
  res.status(head.status ?? 200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(injectHead(template, head, { gscToken }));
});

app.listen(port, '0.0.0.0');
