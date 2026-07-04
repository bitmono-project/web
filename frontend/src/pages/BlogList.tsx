import { Link } from 'react-router-dom'
import { posts } from '../lib/blog'
import { useI18n } from '../lib/i18n'
import { useTitle } from '../lib/useTitle'

export default function BlogList() {
  const { t, lang } = useI18n()
  useTitle('Blog — BitMono')
  const fmt = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid">bitmono // blog</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">{t('blog.heading')}</h1>
          <p className="mt-3 max-w-xl font-mono text-[13px] leading-relaxed text-muted">{t('blog.tagline')}</p>
        </div>
        <a href="/blog/rss.xml" className="mt-1 shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-acid hover:text-acid">rss</a>
      </div>
      <div className="mt-8 divide-y divide-line border-t border-line">
        {posts.map((p) => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="group block py-7">
            <p className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint">
              <time dateTime={p.date}>{fmt.format(new Date(`${p.date}T00:00:00Z`))}</time>
              <span>·</span>
              <span>{t('blog.minRead', { min: p.minutes })}</span>
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink transition-colors group-hover:text-acid">{p.title}</h2>
            <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted">{p.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
