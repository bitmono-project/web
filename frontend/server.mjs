import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crackmeCardPng, siteCardPng } from './og.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL ?? 'http://api:8430';
const port = Number(process.env.PORT ?? 8429);

const distDir = path.join(__dirname, 'dist');
const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');

const DEFAULTS = {
  title: 'BitMono — obfuscate your .NET in the browser',
  description: 'Free & open-source obfuscator for .NET and Mono. Drop your assembly, get it protected — no install.',
};

const escAttr = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Cloudflare terminates TLS, so trust its forwarded proto/host to build absolute (https://) social URLs.
function originOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'bitmono.dev';
  return `${proto}://${host}`;
}

function socialTags({ title, description, url, image, type = 'website' }) {
  const og = [
    ['og:type', type], ['og:site_name', 'BitMono'], ['og:title', title],
    ['og:description', description], ['og:url', url], ['og:image', image],
    ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', title],
  ].map(([p, v]) => `<meta property="${p}" content="${escAttr(v)}"/>`);
  const tw = [
    ['twitter:card', 'summary_large_image'], ['twitter:title', title],
    ['twitter:description', description], ['twitter:image', image],
  ].map(([n, v]) => `<meta name="${n}" content="${escAttr(v)}"/>`);
  return [...og, ...tw].join('\n    ');
}

// Per-page social tags. Crackme pages fetch their own data (incl. taken-down tombstones); the rest get site defaults.
async function tagsFor(req) {
  const origin = originOf(req);
  const m = req.path.match(/^\/challenge\/([^/]+)\/?$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    try {
      const r = await fetch(`${apiUrl}/api/crackmes/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } });
      if (r.ok) {
        const c = await r.json();
        const diff = c.avgDifficulty != null ? ` · difficulty ${c.avgDifficulty.toFixed(1)}/6` : '';
        const description = (c.description && c.description.trim())
          || `A ${c.runtime || '.NET'} crackme by ${c.author}${diff}. Reverse it and prove your solve on BitMono.`;
        return socialTags({
          title: `${c.title} — BitMono crackme`,
          description,
          url: `${origin}/challenge/${slug}`,
          image: `${origin}/og/challenge/${encodeURIComponent(slug)}.png`,
          type: 'article',
        });
      }
    } catch { /* fall through to site defaults */ }
  }
  return socialTags({ ...DEFAULTS, url: origin + req.path, image: `${origin}/og.png` });
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

// Hashed build assets. index:false so "/" falls through to the SPA handler below (which injects social tags).
app.use(express.static(distDir, { index: false }));

// SPA fallback — serve index.html with per-page social tags injected before </head>. Crawlers (Telegram,
// X, Discord, …) don't run JS, so the tags must be server-rendered here. Function replacer: titles with $ are safe.
app.use(async (req, res) => {
  const tags = await tagsFor(req);
  res.set('Content-Type', 'text/html; charset=utf-8')
    .send(template.replace('</head>', () => `    ${tags}\n  </head>`));
});

app.listen(port, '0.0.0.0');
