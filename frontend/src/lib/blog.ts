// Client twin of ../../blog.mjs (the server-side source of truth): same frontmatter shape, same
// heading renderer, so React renders the exact HTML the server prerenders for crawlers. Keep in sync.
import { Marked } from 'marked'

export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  updated: string | null
  author: string
  authorUrl: string | null
  minutes: number
  body: string
}

const headingId = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const id = headingId(text)
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`
    },
  },
})

// Posts are our own repo-committed markdown — same trust level as the JSX around it.
export const renderMarkdown = (md: string): string => marked.parse(md) as string

function parse(path: string, raw: string): BlogPost {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  const meta: Record<string, string> = {}
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const body = raw.slice(m?.[0].length ?? 0)
  const words = body.split(/\s+/).filter(Boolean).length
  return {
    slug: path.replace(/^.*\//, '').replace(/\.md$/, ''),
    title: meta.title ?? '',
    description: meta.description ?? '',
    date: meta.date ?? '',
    updated: meta.updated ?? null,
    author: meta.author ?? 'BitMono',
    authorUrl: meta.authorUrl ?? null,
    minutes: Math.max(1, Math.round(words / 220)),
    body,
  }
}

// Bundled at build time. The blog pages are lazy-loaded, so all post content lives in the blog
// chunk only. ponytail: fine into the tens of posts — switch to per-post dynamic imports if fat.
const files = import.meta.glob('../../blog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const posts: BlogPost[] = Object.entries(files)
  .map(([path, raw]) => parse(path, raw))
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))

export const postBySlug = (slug: string): BlogPost | null => posts.find((p) => p.slug === slug) ?? null
