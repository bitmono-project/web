import { useEffect, useRef, useState } from 'react'
import type { BlogPost } from '../lib/blog'
import { useT } from '../lib/i18n'

// Post action row (aspire-docs style): copy the raw markdown, open it in an AI assistant, share it.
// Interactive-only chrome — deliberately absent from the server-prerendered body (seo.mjs).
export function BlogActions({ post }: { post: BlogPost }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState<null | 'open' | 'share'>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const url = `${window.location.origin}/blog/${post.slug}`
  const mdUrl = `${url}.md`
  const enc = encodeURIComponent
  const prompt = `Read ${mdUrl} and answer questions about it.`

  const copy = () => {
    setMenu(null)
    navigator.clipboard.writeText(`# ${post.title}\n\n${post.body}`).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  const openItems = [
    { label: t('blog.viewMd'), href: mdUrl },
    { label: t('blog.openIn', { tool: 'GitHub Copilot' }), href: `https://github.com/copilot?prompt=${enc(prompt)}` },
    { label: t('blog.openIn', { tool: 'Claude' }), href: `https://claude.ai/new?q=${enc(prompt)}` },
    { label: t('blog.openIn', { tool: 'ChatGPT' }), href: `https://chatgpt.com/?hints=search&q=${enc(prompt)}` },
  ]
  const shareItems = [
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ['X', `https://x.com/intent/post?text=${enc(post.title)}&url=${enc(url)}`],
    ['Threads', `https://www.threads.net/intent/post?text=${enc(`${post.title} ${url}`)}`],
    ['Bluesky', `https://bsky.app/intent/compose?text=${enc(`${post.title} ${url}`)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['Reddit', `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(post.title)}`],
    ['Hacker News', `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(post.title)}`],
    ['Email', `mailto:?subject=${enc(post.title)}&body=${enc(url)}`],
    ['WhatsApp', `https://wa.me/?text=${enc(`${post.title} ${url}`)}`],
    ['Telegram', `https://t.me/share/url?url=${enc(url)}&text=${enc(post.title)}`],
  ].map(([net, href]) => ({ label: t('blog.shareOn', { net }), href }))

  const pill = 'rounded-full border border-line px-3.5 py-1.5 font-mono text-[12px] transition-colors hover:border-acid hover:text-acid'
  return (
    <div ref={rootRef} className="mt-5 flex flex-wrap gap-2">
      <button onClick={copy} className={`${pill} ${copied ? 'border-acid text-acid' : 'text-muted'}`}>
        {copied ? t('blog.copied') : t('blog.copyMd')}
      </button>
      <Menu label={t('blog.open')} items={openItems} open={menu === 'open'} onToggle={() => setMenu(menu === 'open' ? null : 'open')} pill={pill} />
      <Menu label={t('blog.share')} items={shareItems} open={menu === 'share'} onToggle={() => setMenu(menu === 'share' ? null : 'share')} pill={pill} />
    </div>
  )
}

function Menu({ label, items, open, onToggle, pill }: {
  label: string
  items: { label: string; href: string }[]
  open: boolean
  onToggle: () => void
  pill: string
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} aria-haspopup="menu" aria-expanded={open} className={`${pill} ${open ? 'border-acid text-acid' : 'text-muted'}`}>
        {label} <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute start-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
          {items.map((it) => (
            <a
              key={it.href}
              role="menuitem"
              href={it.href}
              {...(it.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {it.label}
              <span className="text-faint">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
