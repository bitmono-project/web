// Per-route SEO head + JSON-LD + sitemap, rendered server-side. Crawlers (Google's first wave,
// Telegram/X/Discord unfurlers, AI bots) don't run JS, so every SEO-critical tag — <title>, description,
// canonical, robots, Open Graph, Twitter, structured data — is injected into the initial HTML here, not
// by React. The client only keeps the tab <title> in sync on navigation (see src/lib/useTitle.ts).

const SITE = {
  name: 'BitMono',
  title: 'BitMono — obfuscate your .NET in the browser',
  description: 'Free & open-source obfuscator for .NET and Mono. Drop your assembly, get it protected — no install.',
}

// Static routes → title/description. `noindex` keeps content-less app pages out of search results while
// still letting any crawler fetch them (robots.txt allows everything).
const ROUTES = {
  '/': { title: SITE.title, description: SITE.description },
  '/crackmes': {
    title: 'Crackmes — .NET reverse-engineering challenges — BitMono',
    description: 'Browse BitMono-obfuscated .NET crackmes. Filter by runtime, difficulty and protection, download a challenge, then prove your solve.',
  },
  '/leaderboard': {
    title: 'Leaderboard — BitMono crackmes',
    description: 'Top reverse engineers on BitMono. Points scale with difficulty and decay as a crackme gets over-solved — first blood pays double.',
  },
  '/privacy': {
    title: 'Privacy Policy — BitMono',
    description: 'What BitMono collects and why. Short version: as little as possible — obfuscator uploads are ephemeral, crackme submissions are public.',
  },
  '/terms': {
    title: 'Terms of Service — BitMono',
    description: 'The rules for using BitMono — the free .NET obfuscator and the crackmes gallery. No malware, challenges must run, everything is moderated.',
  },
  '/login': { title: 'Sign in — BitMono', description: SITE.description, noindex: true },
  '/upload': { title: 'Submit a crackme — BitMono', description: 'Share a .NET crackme with the BitMono gallery.', noindex: true },
  '/submissions': { title: 'My submissions — BitMono', description: SITE.description, noindex: true },
  '/notifications': { title: 'Notifications — BitMono', description: SITE.description, noindex: true },
  '/moderation': { title: 'Moderation — BitMono', description: SITE.description, noindex: true },
  '/admin': { title: 'Admin — BitMono', description: SITE.description, noindex: true },
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s) => esc(s).replace(/"/g, '&quot;')

async function fetchJson(url) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } })
    return r.ok ? await r.json() : null
  } catch { return null }
}

// --- JSON-LD builders (schema.org). Emit a property only when we have real data; conditional blocks
// (aggregateRating, image, author url) are omitted when missing so the Rich Results Test stays clean. ---

function homeGraph(origin) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`,
        name: 'BitMono', alternateName: 'BitMono Obfuscator',
        publisher: { '@id': `${origin}/#org` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${origin}/crackmes?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization', '@id': `${origin}/#org`, name: 'BitMono', url: `${origin}/`,
        logo: `${origin}/mark.png`,
        description: 'Free, open-source .NET obfuscator and a gallery of downloadable reverse-engineering crackme challenges.',
        sameAs: ['https://github.com/bitmono-project', 'https://discord.gg/sFDHd47St4'],
      },
      {
        '@type': 'SoftwareApplication', '@id': `${origin}/#app`, name: 'BitMono',
        description: 'Free and open-source obfuscator for .NET and Mono — renames symbols, strips namespaces and encrypts strings, right in the browser.',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Windows, Linux, macOS',
        url: `${origin}/`, downloadUrl: 'https://github.com/bitmono-project/BitMono',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@id': `${origin}/#org` },
      },
    ],
  }
}

// A crackme is a downloadable reverse-engineering puzzle → CreativeWork (+ LearningResource semantics).
// aggregateRating is driven by *quality* votes (the "how good is this challenge" signal); difficulty rides
// along as a non-rating PropertyValue so a star snippet never misreads it as quality.
function challengeGraph(origin, c) {
  const url = `${origin}/challenge/${encodeURIComponent(c.slug)}`
  const work = {
    '@type': ['CreativeWork', 'LearningResource'],
    '@id': `${url}#crackme`,
    name: c.title,
    url,
    description: descriptionFor(c),
    datePublished: c.publishedAt,
    inLanguage: 'en',
    learningResourceType: 'Crackme challenge',
    educationalUse: 'Reverse engineering practice',
    author: {
      '@type': 'Person',
      name: c.author,
      ...(c.authorHandle ? { '@id': `${origin}/user/${c.authorHandle}#person`, url: `${origin}/user/${encodeURIComponent(c.authorHandle)}` } : {}),
    },
    encoding: {
      '@type': 'MediaObject',
      contentUrl: `${origin}/api/crackmes/${encodeURIComponent(c.slug)}/download`,
      encodingFormat: 'application/zip',
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/DownloadAction',
      userInteractionCount: c.downloadCount ?? 0,
    },
  }
  const props = []
  if (c.avgDifficulty != null) props.push({ '@type': 'PropertyValue', name: 'Difficulty', value: c.avgDifficulty, minValue: 1, maxValue: 6 })
  if (c.runtime || c.platform) props.push({ '@type': 'PropertyValue', name: 'Runtime', value: c.runtime || c.platform })
  if (c.protections?.length) props.push({ '@type': 'PropertyValue', name: 'Protections', value: c.protections.join(', ') })
  if (props.length) work.additionalProperty = props
  // Only valid with real votes — an AggregateRating with ratingCount 0 is a Rich Results Test error.
  if (c.avgQuality != null && c.qualityCount > 0) {
    work.aggregateRating = { '@type': 'AggregateRating', ratingValue: c.avgQuality, bestRating: 6, worstRating: 1, ratingCount: c.qualityCount }
  }
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Crackmes', item: `${origin}/crackmes` },
      { '@type': 'ListItem', position: 3, name: c.title },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [work, breadcrumb] }
}

function profileGraph(origin, p) {
  const url = `${origin}/user/${encodeURIComponent(p.handle)}`
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#profilepage`,
    url,
    ...(p.joinedAt ? { dateCreated: p.joinedAt } : {}),
    mainEntity: {
      '@type': 'Person', '@id': `${url}#person`,
      name: p.displayName || p.handle, alternateName: p.handle, url,
      ...(p.avatar ? { image: p.avatar } : {}),
      agentInteractionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CreateAction',
        userInteractionCount: p.authored ?? 0,
      },
    },
  }
}

function descriptionFor(c) {
  if (c.description && c.description.trim()) return c.description.trim()
  const diff = c.avgDifficulty != null ? ` · difficulty ${c.avgDifficulty.toFixed(1)}/6` : ''
  return `A ${c.runtime || '.NET'} crackme by ${c.author}${diff}. Reverse it and prove your solve on BitMono.`
}

// --- Per-route head. Dynamic routes fetch their own data (the API enforces visibility, so pending/private
// items 404 here too); a missing crackme/profile returns a 404 status so Google doesn't log a soft-404. ---

export async function headFor(req, { apiUrl, origin }) {
  let m = req.path.match(/^\/challenge\/([^/]+)\/?$/)
  if (m) {
    const slug = decodeURIComponent(m[1])
    const c = await fetchJson(`${apiUrl}/api/crackmes/${encodeURIComponent(slug)}`)
    if (!c) return notFound(origin, req, 'Crackme not found — BitMono')
    const takenDown = c.status === 'takenDown'
    return {
      title: `${c.title} — BitMono crackme`,
      description: descriptionFor(c),
      canonical: `${origin}/challenge/${encodeURIComponent(slug)}`,
      image: `${origin}/og/challenge/${encodeURIComponent(slug)}.png`,
      ogType: 'article',
      robots: takenDown ? 'noindex,follow' : null,
      jsonld: takenDown ? [] : [challengeGraph(origin, c)],
    }
  }

  m = req.path.match(/^\/user\/([^/]+)\/?$/)
  if (m) {
    const handle = decodeURIComponent(m[1])
    const p = await fetchJson(`${apiUrl}/api/users/${encodeURIComponent(handle)}`)
    if (!p) return notFound(origin, req, 'User not found — BitMono')
    return {
      title: `${p.displayName || p.handle} (@${p.handle}) — BitMono`,
      description: `${p.displayName || p.handle} on BitMono — ${p.points} pts, ${p.solves} solved, ${p.authored} crackmes authored. Rank: ${p.rankName}.`,
      canonical: `${origin}/user/${encodeURIComponent(handle)}`,
      image: `${origin}/og.png`,
      ogType: 'profile',
      robots: null,
      jsonld: [profileGraph(origin, p)],
    }
  }

  // Normalize a trailing slash (except root) so "/crackmes/" canonicalizes to "/crackmes" and gets the
  // right title instead of falling through to the generic default.
  const p = req.path.length > 1 ? req.path.replace(/\/+$/, '') : '/'
  const r = ROUTES[p] ?? { title: SITE.title, description: SITE.description }
  return {
    title: r.title,
    description: r.description,
    canonical: `${origin}${p}`,
    image: `${origin}/og.png`,
    ogType: 'website',
    robots: r.noindex ? 'noindex,follow' : null,
    jsonld: p === '/' ? [homeGraph(origin)] : [],
  }
}

function notFound(origin, req, title) {
  return {
    title, description: SITE.description, canonical: `${origin}${req.path}`,
    image: `${origin}/og.png`, ogType: 'website', robots: 'noindex,follow', jsonld: [], status: 404,
  }
}

// --- HTML injection ---

function socialTags(h) {
  const og = [
    ['og:type', h.ogType], ['og:site_name', SITE.name], ['og:title', h.title],
    ['og:description', h.description], ['og:url', h.canonical], ['og:image', h.image],
    ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', h.title],
  ].map(([p, v]) => `<meta property="${p}" content="${escAttr(v)}"/>`)
  const tw = [
    ['twitter:card', 'summary_large_image'], ['twitter:title', h.title],
    ['twitter:description', h.description], ['twitter:image', h.image],
  ].map(([n, v]) => `<meta name="${n}" content="${escAttr(v)}"/>`)
  return [...og, ...tw]
}

// JSON.stringify doesn't escape "<", so neutralize it to keep a "</script>" in any field from breaking out.
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

export function injectHead(template, head, { gscToken } = {}) {
  const tags = [`<link rel="canonical" href="${escAttr(head.canonical)}"/>`]
  if (head.robots) tags.push(`<meta name="robots" content="${escAttr(head.robots)}"/>`)
  if (gscToken) tags.push(`<meta name="google-site-verification" content="${escAttr(gscToken)}"/>`)
  tags.push(...socialTags(head))
  for (const obj of head.jsonld) tags.push(jsonLd(obj))
  const block = tags.join('\n    ')
  // Function replacers: titles/descriptions with "$" are inserted verbatim (no $-substitution).
  return template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(head.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${escAttr(head.description)}"/>`)
    .replace('</head>', () => `    ${block}\n  </head>`)
}

// --- Sitemap: static routes + every public crackme + the distinct author profiles, fetched live. ---

export async function buildSitemap(origin, { apiUrl }) {
  const urls = [
    { loc: `${origin}/` },
    { loc: `${origin}/crackmes` },
    { loc: `${origin}/leaderboard` },
    { loc: `${origin}/privacy` },
    { loc: `${origin}/terms` },
  ]
  const handles = new Set()
  for (let page = 1; page <= 100; page++) {
    const r = await fetchJson(`${apiUrl}/api/crackmes?sort=date&page=${page}&pageSize=100`)
    if (!r?.items?.length) break
    for (const c of r.items) {
      urls.push({ loc: `${origin}/challenge/${encodeURIComponent(c.slug)}`, lastmod: c.publishedAt })
      if (c.authorHandle) handles.add(c.authorHandle)
    }
    if (page * 100 >= (r.total ?? 0)) break
  }
  for (const h of handles) urls.push({ loc: `${origin}/user/${encodeURIComponent(h)}` })

  const body = urls.map((u) => {
    const lastmod = u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''
    return `<url><loc>${esc(u.loc)}</loc>${lastmod}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}
