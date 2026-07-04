import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { postBySlug, renderMarkdown } from '../lib/blog'
import { useI18n } from '../lib/i18n'
import { useTitle } from '../lib/useTitle'

export default function BlogPost() {
  const { slug = '' } = useParams()
  const post = postBySlug(slug)
  const { t, lang } = useI18n()
  useTitle(post ? `${post.title} — BitMono Blog` : 'Blog — BitMono')
  const html = useMemo(() => (post ? renderMarkdown(post.body) : ''), [post])
  // Land at the top on post-to-post navigation; a hash is HashTarget's job (Layout).
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [slug])
  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-mono text-sm text-muted">{t('blog.notFound')}</p>
        <Link to="/blog" className="mt-4 inline-block font-mono text-xs text-acid hover:underline">{t('blog.back')}</Link>
      </main>
    )
  }
  const fmt = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/blog" className="font-mono text-xs text-faint transition-colors hover:text-muted">{t('blog.back')}</Link>
      <article className="mt-4">
        <p className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-faint">
          <time dateTime={post.date}>{fmt.format(new Date(`${post.date}T00:00:00Z`))}</time>
          <span>·</span>
          <span>{t('blog.minRead', { min: post.minutes })}</span>
          {post.updated && (
            <>
              <span>·</span>
              <span>{t('blog.updated', { date: fmt.format(new Date(`${post.updated}T00:00:00Z`)) })}</span>
            </>
          )}
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink">{post.title}</h1>
        <p className="mt-3 font-mono text-[13px] text-muted">
          {t('blog.by')}{' '}
          {post.authorUrl
            ? <a href={post.authorUrl} rel="author" className="text-acid hover:underline">{post.author}</a>
            : <span className="text-ink">{post.author}</span>}
        </p>
        <div className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <div className="mt-12 border-t border-line pt-6">
        <Link to="/blog" className="font-mono text-xs text-faint transition-colors hover:text-acid">{t('blog.back')}</Link>
      </div>
    </main>
  )
}
