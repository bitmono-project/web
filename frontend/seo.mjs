// Per-route SEO head + JSON-LD + sitemap, rendered server-side. Crawlers (Google's first wave,
// Telegram/X/Discord unfurlers, AI bots) don't run JS, so every SEO-critical tag — <title>, description,
// canonical, robots, Open Graph, Twitter, structured data — is injected into the initial HTML here, not
// by React. The client only keeps the tab <title> in sync on navigation (see src/lib/useTitle.ts).

import { allPosts, postBySlug } from './blog.mjs'

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
  '/faq': {
    title: 'FAQ — BitMono',
    description: 'How BitMono works — the free .NET & Mono obfuscator and the crackmes gallery. Submitting crackmes and writeups, downloads, ranks, accounts and reporting.',
  },
  '/ranks': {
    title: 'Ranks — BitMono',
    description: 'The eight BitMono ranks, from script kiddie to nop-sled legend. Climb by solving crackmes — harder challenges and first-blood solves pay the most.',
  },
  '/download': {
    title: 'Download BitMono — .NET & Unity obfuscator',
    description: 'Download BitMono, the free & open-source obfuscator for .NET and Unity. A guided picker resolves the exact CLI, Unity package or NuGet build for your runtime — always the latest release.',
  },
  '/blog': {
    title: 'Blog — BitMono',
    description: 'Notes from the BitMono project — .NET obfuscation techniques, reverse engineering, and how the free open-source obfuscator works under the hood.',
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

// Display maps mirrored from the client (crackmes.ts) so the prerendered body matches the React render.
// Kept tiny and local — seo.mjs is plain ESM and can't import the client's TS.
const PLATFORM = { dotNet: '.NET', mono: 'Mono', netFramework: '.NET Framework', unity: 'Unity', iL2CPP: 'IL2CPP', native: 'Native', other: 'Other' }
const LANGUAGE = { cSharp: 'C#', fSharp: 'F#', vbNet: 'VB.NET', cpp: 'C/C++', other: 'Other' }
const DIFFNUM = { veryEasy: 1, easy: 2, medium: 3, hard: 4, veryHard: 5, insane: 6 }
const DIFFLABEL = { veryEasy: 'Very Easy', easy: 'Easy', medium: 'Medium', hard: 'Hard', veryHard: 'Very Hard', insane: 'Insane' }
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(2)} KB` : `${b} B`)
const runtimeOf = (c) => c.runtime || PLATFORM[c.platform] || '.NET'
const diffOf = (c) => (c.avgDifficulty != null ? c.avgDifficulty : DIFFNUM[c.authorDifficulty] ?? null)

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

// Compact publisher node inlined into blog graphs so each page's JSON-LD is self-contained
// (Google evaluates structured data per page — @id references to other pages don't resolve).
const publisherNode = (origin) => ({
  '@type': 'Organization', name: 'BitMono', url: `${origin}/`,
  logo: { '@type': 'ImageObject', url: `${origin}/mark.png` },
})

function blogGraph(origin, posts) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog', '@id': `${origin}/blog#blog`, url: `${origin}/blog`,
        name: 'BitMono Blog',
        description: ROUTES['/blog'].description,
        inLanguage: 'en',
        publisher: publisherNode(origin),
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${origin}/blog/${p.slug}`,
          datePublished: p.date,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog' },
        ],
      },
    ],
  }
}

function blogPostGraph(origin, p) {
  const url = `${origin}/blog/${p.slug}`
  const posting = {
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    headline: p.title,
    description: p.description,
    url,
    mainEntityOfPage: url,
    image: [`${origin}/og/blog/${p.slug}.png`],
    datePublished: p.date,
    dateModified: p.updated ?? p.date,
    inLanguage: 'en',
    wordCount: p.words,
    isPartOf: { '@type': 'Blog', '@id': `${origin}/blog#blog`, name: 'BitMono Blog' },
    author: { '@type': 'Person', name: p.author, ...(p.authorUrl ? { url: p.authorUrl } : {}) },
    publisher: publisherNode(origin),
  }
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
      { '@type': 'ListItem', position: 3, name: p.title },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [posting, breadcrumb] }
}

function descriptionFor(c) {
  if (c.description && c.description.trim()) return c.description.trim()
  const diff = c.avgDifficulty != null ? ` · difficulty ${c.avgDifficulty.toFixed(1)}/6` : ''
  return `A ${c.runtime || '.NET'} crackme by ${c.author}${diff}. Reverse it and prove your solve on BitMono.`
}

// --- Prerendered page body, injected into #root. React's createRoot clears #root on mount (the standard
// loading-fallback pattern), so the client app replaces this with no duplication. It mirrors the real page
// (no cloaking) so non-JS crawlers (Bing, AI bots, Google's first wave) see content + internal links, and
// everyone gets a faster first paint. Interactive bits (obfuscate panel, filters, comments) are omitted —
// they carry no SEO value and only the client renders them. ---

function homeBody() {
  const protections = ['FullRenamer', 'NoNamespaces', 'StringsEncryption', 'AntiDe4dot', 'AntiILdasm', 'CallToCalli', 'DotNetHook', 'AntiDebugBreakpoints', 'BillionNops', 'UnmanagedString']
  const pillars = [
    ['01', 'Static, never run', 'BitMono rewrites the IL with AsmResolver. Your assembly is analyzed, never executed — safe by construction.'],
    ['02', 'Nothing is kept', 'Your upload is deleted the instant it’s obfuscated, and the result is wiped the moment you download it.'],
    ['03', 'The real engine', 'The same BitMono that ships on NuGet and runs in CI pipelines — not a watered-down web port.'],
  ]
  return `<main class="mx-auto max-w-6xl px-6">
  <section class="pt-14 pb-10 text-center md:pt-24">
    <h1 class="mx-auto mt-7 max-w-4xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">Obfuscate your <span class="text-acid">.NET</span> right in the browser.</h1>
    <p class="mx-auto mt-6 max-w-xl font-mono text-sm leading-relaxed text-muted md:text-base">Free &amp; open-source obfuscator for .NET and Mono. Drop a .dll — get it back with renamed symbols, stripped namespaces and encrypted strings. No install, nothing stored.</p>
  </section>
  <section class="border-y border-line py-5"><div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-faint"><span class="text-muted">protections //</span>${protections.map((p) => `<span>${esc(p)}</span>`).join('')}</div></section>
  <section class="my-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">${pillars.map(([n, t, b]) => `<div class="bg-void p-7"><div class="font-mono text-xs text-acid">${n}</div><h2 class="mt-3 font-display text-lg font-bold text-ink">${esc(t)}</h2><p class="mt-2 font-mono text-[13px] leading-relaxed text-muted">${esc(b)}</p></div>`).join('')}</section>
</main>`
}

function listBody(origin, items) {
  const rows = items.map((c) => {
    const d = diffOf(c)
    return `<tr class="border-b border-line/60"><td class="px-3 py-2"><a href="/challenge/${encodeURIComponent(c.slug)}" class="text-ink hover:text-acid">${esc(c.title)}</a></td><td class="px-3 py-2 text-muted">${esc(c.author)}</td><td class="px-3 py-2 text-muted">${esc(runtimeOf(c))}</td><td class="px-3 py-2 text-acid">${d != null ? d.toFixed(1) : '—'}</td></tr>`
  }).join('')
  return `<main class="mx-auto max-w-6xl px-6 py-12">
  <h1 class="font-display text-4xl font-extrabold tracking-tight text-ink">Crackmes</h1>
  <p class="mt-2 font-mono text-sm text-muted">BitMono-obfuscated .NET challenges. Reverse them, write it up.</p>
  <table class="mt-6 w-full border-collapse font-mono text-[13px]"><thead><tr class="border-b border-line text-left text-faint"><th class="px-3 py-2">Name</th><th class="px-3 py-2">Author</th><th class="px-3 py-2">Runtime</th><th class="px-3 py-2">Diff</th></tr></thead><tbody>${rows}</tbody></table>
</main>`
}

function challengeBody(origin, c) {
  if (c.status === 'takenDown') {
    return `<main class="mx-auto max-w-4xl px-6 py-12"><h1 class="font-display text-4xl font-extrabold tracking-tight text-ink">${esc(c.title)}</h1><p class="mt-4 font-mono text-sm text-muted">This crackme has been taken down.</p></main>`
  }
  const author = c.authorHandle
    ? `<a href="/user/${encodeURIComponent(c.authorHandle)}" class="text-muted hover:text-acid">${esc(c.author)}</a>`
    : esc(c.author)
  const d = diffOf(c)
  const field = (label, val) => `<div><dt class="text-[11px] uppercase tracking-wider text-faint">${label}</dt><dd class="mt-1 text-ink">${esc(val)}</dd></div>`
  const prots = c.protections?.length
    ? c.protections.map((p) => `<span class="rounded-full border border-line bg-void/60 px-3 py-1 font-mono text-[12px] text-muted">${esc(p)}</span>`).join('')
    : '<span class="font-mono text-sm text-faint">none declared</span>'
  const description = c.description && c.description.trim()
    ? `<section class="mt-8"><h2 class="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Description</h2><p class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink/90">${esc(c.description)}</p></section>`
    : ''
  return `<main class="mx-auto max-w-4xl px-6 py-12">
  <a href="/crackmes" class="font-mono text-xs text-faint hover:text-muted">← all crackmes</a>
  <div class="mt-4 flex flex-wrap items-start justify-between gap-4"><div>
    <h1 class="font-display text-4xl font-extrabold tracking-tight text-ink">${esc(c.title)}</h1>
    <p class="mt-1 font-mono text-sm text-muted">by ${author}</p>
  </div><a href="/api/crackmes/${encodeURIComponent(c.slug)}/download" class="btn-acid">download ↓</a></div>
  <dl class="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface/30 p-6 font-mono text-sm sm:grid-cols-4">
    ${field('Runtime', runtimeOf(c))}${field('Language', LANGUAGE[c.language] || c.language)}${field('Difficulty', d != null ? d.toFixed(1) : '—')}${field('Quality', c.avgQuality != null ? c.avgQuality.toFixed(1) : '—')}${field('Size', fmtSize(c.sizeBytes))}${field('Downloads', String(c.downloadCount))}${field('Solved', String(c.solvedCount))}${field('Published', String(c.publishedAt || '').slice(0, 10))}
  </dl>
  <section class="mt-6"><h2 class="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Protections</h2><div class="flex flex-wrap gap-2">${prots}</div></section>
  ${description}
</main>`
}

function profileBody(origin, p, crackmes) {
  const authored = crackmes.length
    ? crackmes.map((c) => `<li class="rounded-lg border border-line bg-surface/30 p-3"><a href="/challenge/${encodeURIComponent(c.slug)}" class="text-ink hover:text-acid">${esc(c.title)}</a> <span class="text-faint">${esc(DIFFLABEL[c.difficulty] ?? c.difficulty)}</span></li>`).join('')
    : '<li class="text-faint">None yet.</li>'
  return `<main class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="font-display text-3xl font-extrabold tracking-tight text-ink">${esc(p.displayName)}</h1>
  <p class="mt-1 font-mono text-[12px] text-faint">@${esc(p.handle)} · ${esc(p.rankName)} · ${p.points} pts · ${p.solves} solved · ${p.authored} authored</p>
  <h2 class="mb-3 mt-12 font-display text-2xl font-bold text-ink">Authored crackmes</h2>
  <ul class="space-y-2 font-mono text-[13px]">${authored}</ul>
</main>`
}

// Download page: real, indexable download links for non-JS crawlers (the React chooser only renders client-
// side). Mirrors the primary picks; the full matrix stays behind the interactive UI. rel may be null if the
// release feed is down — then we degrade to a GitHub Releases link.
function downloadBody(origin, rel) {
  const links = []
  if (rel?.assets?.length) {
    const cli = (tfm, os, arch, label) => {
      const a = rel.assets.find((x) => x.kind === 'cli' && x.tfm === tfm && x.os === os && x.arch === arch)
      return a ? `<li><a href="${origin}${esc(a.downloadUrl)}" class="text-acid hover:underline">.NET 8 CLI — ${label}</a></li>` : ''
    }
    links.push(cli('net8.0', 'win', 'x64', 'Windows x64'), cli('net8.0', 'linux', 'x64', 'Linux x64'), cli('net8.0', 'osx', 'arm64', 'macOS ARM64'))
    const unity = rel.assets.find((x) => x.kind === 'unityPackage')
    if (unity) links.push(`<li><a href="${origin}${esc(unity.downloadUrl)}" class="text-acid hover:underline">Unity — ${esc(unity.unityVersion)} .unitypackage</a></li>`)
  }
  const list = links.filter(Boolean).join('')
  const ver = rel ? `v${esc(rel.version)}` : 'the latest release'
  const releases = esc(rel?.htmlUrl || 'https://github.com/bitmono-project/BitMono/releases/latest')
  return `<main class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="font-display text-4xl font-extrabold tracking-tight text-ink">Download BitMono</h1>
  <p class="mt-2 font-mono text-sm text-muted">The free, open-source obfuscator for .NET &amp; Unity — ${ver}. Pick the exact CLI, Unity package or NuGet build for your setup.</p>
  ${list ? `<ul class="mt-6 space-y-1 font-mono text-[13px]">${list}</ul>` : ''}
  <p class="mt-6 font-mono text-[13px] text-muted">Embed it in your build via NuGet — <a href="https://www.nuget.org/packages/BitMono.Integration" class="text-acid hover:underline">BitMono.Integration</a> — or see every build on <a href="${releases}" class="text-acid hover:underline">GitHub Releases</a>.</p>
</main>`
}

const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

// Blog bodies mirror the client pages (src/pages/BlogList.tsx / BlogPost.tsx) — full article HTML in
// the initial response, since AI crawlers and Google's first wave read it without running JS.
function blogIndexBody(origin, posts) {
  const items = posts.map((p) => `<a href="/blog/${p.slug}" class="group block py-7">
    <p class="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint"><time datetime="${p.date}">${fmtDate(p.date)}</time><span>·</span><span>${p.minutes} min read</span></p>
    <h2 class="mt-2 font-display text-2xl font-bold tracking-tight text-ink transition-colors group-hover:text-acid">${esc(p.title)}</h2>
    <p class="mt-2 font-mono text-[13px] leading-relaxed text-muted">${esc(p.description)}</p>
  </a>`).join('')
  return `<main class="mx-auto max-w-3xl px-6 py-12">
  <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-acid">bitmono // blog</p>
  <h1 class="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">Blog</h1>
  <p class="mt-3 max-w-xl font-mono text-[13px] leading-relaxed text-muted">Notes from the BitMono project — .NET obfuscation, reverse engineering, and what ships.</p>
  <div class="mt-8 divide-y divide-line border-t border-line">${items}</div>
</main>`
}

function blogPostBody(origin, p) {
  const author = p.authorUrl ? `<a href="${escAttr(p.authorUrl)}" rel="author" class="text-acid hover:underline">${esc(p.author)}</a>` : esc(p.author)
  return `<main class="mx-auto max-w-3xl px-6 py-12">
  <a href="/blog" class="font-mono text-xs text-faint hover:text-muted">← all posts</a>
  <article class="mt-4">
    <p class="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint"><time datetime="${p.date}">${fmtDate(p.date)}</time><span>·</span><span>${p.minutes} min read</span>${p.updated ? `<span>·</span><span>updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time></span>` : ''}</p>
    <h1 class="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink">${esc(p.title)}</h1>
    <p class="mt-3 font-mono text-[13px] text-muted">by ${author}</p>
    <div class="blog-prose mt-8">${p.html}</div>
  </article>
</main>`
}

// SoftwareApplication for the download page — free .NET/Unity obfuscator, versioned to the current release.
function downloadGraph(origin, rel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${origin}/download#app`,
    name: 'BitMono',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: '.NET & Unity obfuscator',
    operatingSystem: 'Windows, Linux, macOS',
    softwareVersion: rel.version,
    url: `${origin}/download`,
    downloadUrl: `${origin}/download`,
    softwareHelp: 'https://docs.bitmono.dev',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': `${origin}/#org` },
  }
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
      body: challengeBody(origin, c),
    }
  }

  m = req.path.match(/^\/blog\/([^/]+)\/?$/)
  if (m) {
    const post = postBySlug(decodeURIComponent(m[1]))
    if (!post) return notFound(origin, req, 'Post not found — BitMono')
    return {
      title: `${post.title} — BitMono Blog`,
      description: post.description,
      canonical: `${origin}/blog/${post.slug}`,
      image: `${origin}/og/blog/${post.slug}.png`,
      ogType: 'article',
      article: { published: post.date, modified: post.updated ?? post.date, author: post.author },
      robots: null,
      jsonld: [blogPostGraph(origin, post)],
      body: blogPostBody(origin, post),
    }
  }

  m = req.path.match(/^\/user\/([^/]+)\/?$/)
  if (m) {
    const handle = decodeURIComponent(m[1])
    const p = await fetchJson(`${apiUrl}/api/users/${encodeURIComponent(handle)}`)
    if (!p) return notFound(origin, req, 'User not found — BitMono')
    const authored = (await fetchJson(`${apiUrl}/api/users/${encodeURIComponent(handle)}/crackmes`)) ?? []
    return {
      title: `${p.displayName || p.handle} (@${p.handle}) — BitMono`,
      description: `${p.displayName || p.handle} on BitMono — ${p.points} pts, ${p.solves} solved, ${p.authored} crackmes authored. Rank: ${p.rankName}.`,
      canonical: `${origin}/user/${encodeURIComponent(handle)}`,
      image: `${origin}/og.png`,
      ogType: 'profile',
      robots: null,
      jsonld: [profileGraph(origin, p)],
      body: profileBody(origin, p, authored),
    }
  }

  // Normalize a trailing slash (except root) so "/crackmes/" canonicalizes to "/crackmes" and gets the
  // right title instead of falling through to the generic default.
  const p = req.path.length > 1 ? req.path.replace(/\/+$/, '') : '/'
  const r = ROUTES[p] ?? { title: SITE.title, description: SITE.description }
  let body = ''
  let jsonld = p === '/' ? [homeGraph(origin)] : []
  if (p === '/') body = homeBody()
  else if (p === '/crackmes') {
    const list = await fetchJson(`${apiUrl}/api/crackmes?sort=date&pageSize=100`)
    body = listBody(origin, list?.items ?? [])
  } else if (p === '/download') {
    const rel = await fetchJson(`${apiUrl}/api/releases/latest`)
    body = downloadBody(origin, rel)
    if (rel) jsonld = [downloadGraph(origin, rel)]
  } else if (p === '/blog') {
    body = blogIndexBody(origin, allPosts())
    jsonld = [blogGraph(origin, allPosts())]
  }
  return {
    title: r.title,
    description: r.description,
    canonical: `${origin}${p}`,
    image: `${origin}/og.png`,
    ogType: 'website',
    robots: r.noindex ? 'noindex,follow' : null,
    jsonld,
    body,
  }
}

function notFound(origin, req, title) {
  return {
    title, description: SITE.description, canonical: `${origin}${req.path}`,
    image: `${origin}/og.png`, ogType: 'website', robots: 'noindex,follow', jsonld: [], status: 404, body: '',
  }
}

// --- HTML injection ---

function socialTags(h) {
  const og = [
    ['og:type', h.ogType], ['og:site_name', SITE.name], ['og:title', h.title],
    ['og:description', h.description], ['og:url', h.canonical], ['og:image', h.image],
    ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', h.title],
    // og:type article carries its dates — unfurlers and search both read them.
    ...(h.article ? [
      ['article:published_time', h.article.published],
      ['article:modified_time', h.article.modified],
      ['article:author', h.article.author],
    ] : []),
  ].map(([p, v]) => `<meta property="${p}" content="${escAttr(v)}"/>`)
  const tw = [
    ['twitter:card', 'summary_large_image'], ['twitter:title', h.title],
    ['twitter:description', h.description], ['twitter:image', h.image],
  ].map(([n, v]) => `<meta name="${n}" content="${escAttr(v)}"/>`)
  return [...og, ...tw]
}

// JSON.stringify doesn't escape "<", so neutralize it to keep a "</script>" in any field from breaking out.
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

export function injectHead(template, head, { gscToken, rssUrl } = {}) {
  const tags = [`<link rel="canonical" href="${escAttr(head.canonical)}"/>`]
  if (rssUrl) tags.push(`<link rel="alternate" type="application/rss+xml" title="BitMono Blog" href="${escAttr(rssUrl)}"/>`)
  if (head.robots) tags.push(`<meta name="robots" content="${escAttr(head.robots)}"/>`)
  if (gscToken) tags.push(`<meta name="google-site-verification" content="${escAttr(gscToken)}"/>`)
  tags.push(...socialTags(head))
  for (const obj of head.jsonld) tags.push(jsonLd(obj))
  const block = tags.join('\n    ')
  // Function replacers: titles/descriptions with "$" are inserted verbatim (no $-substitution).
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(head.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${escAttr(head.description)}"/>`)
    .replace('</head>', () => `    ${block}\n  </head>`)
  // Prerendered body for crawlers + fast first paint; createRoot clears #root on mount so the client app
  // replaces it cleanly (no duplication).
  if (head.body) html = html.replace('<div id="root"></div>', () => `<div id="root">${head.body}</div>`)
  return html
}

// --- Sitemap: static routes + every public crackme + the distinct author profiles, fetched live. ---

export async function buildSitemap(origin, { apiUrl }) {
  const urls = [
    { loc: `${origin}/` },
    { loc: `${origin}/crackmes` },
    { loc: `${origin}/leaderboard` },
    { loc: `${origin}/privacy` },
    { loc: `${origin}/terms` },
    { loc: `${origin}/faq` },
    { loc: `${origin}/ranks` },
    { loc: `${origin}/download` },
    { loc: `${origin}/blog` },
  ]
  for (const p of allPosts()) urls.push({ loc: `${origin}/blog/${p.slug}`, lastmod: p.updated ?? p.date })
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
