// The blog: markdown files in ./blog with a small frontmatter block, rendered to HTML with marked.
// This module is the server-side source of truth — SSR bodies + JSON-LD (seo.mjs), the RSS feed and
// OG cards (server.mjs), and sitemap entries all come from here. The client bundles the same .md
// files via import.meta.glob; src/lib/blog.ts mirrors the frontmatter parser and heading renderer —
// keep the twins in sync so React renders the exact HTML crawlers were served.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// GitHub-style heading ids, so hashes survive a copy from any markdown preview.
export const headingId = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')

// Headings carry ids (the site-wide deep-link target lock picks them up) plus a hover anchor link.
const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const id = headingId(text)
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`
    },
  },
})

export const renderMarkdown = (md) => marked.parse(md)

// key: value frontmatter only — no lists, no nesting — so a few lines beat a YAML dependency.
function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  const meta = {}
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: raw.slice(m?.[0].length ?? 0) }
}

// Loaded once at import — content only changes on deploy, the container is immutable.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blog')
const posts = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const { meta, body } = parseFrontmatter(readFileSync(path.join(dir, file), 'utf8'))
    const words = body.split(/\s+/).filter(Boolean).length
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title ?? file,
      description: meta.description ?? '',
      date: meta.date ?? '1970-01-01',
      updated: meta.updated ?? null,
      author: meta.author ?? 'BitMono',
      authorUrl: meta.authorUrl ?? null,
      minutes: Math.max(1, Math.round(words / 220)),
      words,
      body,
      html: renderMarkdown(body),
    }
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))

export const allPosts = () => posts
export const postBySlug = (slug) => posts.find((p) => p.slug === slug) ?? null

// Full-text RSS 2.0 — feed readers get whole articles, and AI/search crawlers use it for discovery.
export function blogRss(origin) {
  const items = posts.map((p) => `<item>
<title>${esc(p.title)}</title>
<link>${origin}/blog/${p.slug}</link>
<guid isPermaLink="true">${origin}/blog/${p.slug}</guid>
<pubDate>${new Date(p.date).toUTCString()}</pubDate>
<dc:creator>${esc(p.author)}</dc:creator>
<description>${esc(p.description)}</description>
<content:encoded><![CDATA[${p.html.replaceAll(']]>', ']]]]><![CDATA[>')}]]></content:encoded>
</item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>BitMono Blog</title>
<link>${origin}/blog</link>
<atom:link href="${origin}/blog/rss.xml" rel="self" type="application/rss+xml"/>
<description>Notes from the BitMono project — .NET obfuscation, reverse engineering, and what ships.</description>
<language>en</language>
${items}
</channel>
</rss>`
}
