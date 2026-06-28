// SEO smoke check — `node seo.smoke.mjs`. No API needed: dynamic fetches fail closed, so this exercises
// the static-route table, head injection, and sitemap fallback. Asserts the load-bearing behaviour.
import assert from 'node:assert/strict';
import { headFor, injectHead, buildSitemap } from './seo.mjs';

const origin = 'https://bitmono.dev';
const api = { apiUrl: 'http://127.0.0.1:1', origin }; // refused immediately → no real fetch

// Static route table: indexable content vs noindex app pages, self-referencing canonical.
const priv = await headFor({ path: '/privacy' }, api);
assert.match(priv.title, /Privacy Policy/);
assert.equal(priv.robots, null);
assert.equal(priv.canonical, 'https://bitmono.dev/privacy');

const login = await headFor({ path: '/login' }, api);
assert.equal(login.robots, 'noindex,follow');

// Home carries the WebSite/Organization/SoftwareApplication graph + a prerendered body.
const home = await headFor({ path: '/' }, api);
assert.equal(home.jsonld.length, 1);
const graph = JSON.stringify(home.jsonld[0]);
assert.ok(graph.includes('"SoftwareApplication"') && graph.includes('"Organization"') && graph.includes('"WebSite"'));
assert.ok(home.body.includes('Obfuscate your') && home.body.includes('<h1'));

// Injection replaces the template title/description, adds canonical + OG + JSON-LD + verification,
// and prerenders the body into #root.
const tpl = '<html><head><title>OLD</title><meta name="description" content="OLD" />\n</head><body><div id="root"></div></body></html>';
const html = injectHead(tpl, home, { gscToken: 'tok123' });
assert.ok(html.includes('<title>BitMono — obfuscate your .NET in the browser</title>'));
assert.ok(!html.includes('>OLD<') && !html.includes('content="OLD"'));
assert.ok(html.includes('rel="canonical" href="https://bitmono.dev/"'));
assert.ok(html.includes('property="og:title"'));
assert.ok(html.includes('application/ld+json'));
assert.ok(html.includes('name="google-site-verification" content="tok123"'));
assert.ok(html.includes('<div id="root"><main') && !html.includes('<div id="root"></div>'));

// A noindex utility page has no prerendered body — #root stays empty for React.
const privHtml = injectHead(tpl, await headFor({ path: '/privacy' }, api), {});
assert.ok(privHtml.includes('<div id="root"></div>'));

// Sitemap: API unreachable → static URLs only, but still valid XML.
const xml = await buildSitemap(origin, { apiUrl: 'http://127.0.0.1:1' });
assert.ok(xml.startsWith('<?xml'));
assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
assert.ok(xml.includes('<loc>https://bitmono.dev/crackmes</loc>'));

console.log('ok — seo smoke passed');
