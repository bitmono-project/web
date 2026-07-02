import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { type MySubmission, getMySubmissions, statusLabel, statusBadgeClass, formatDate } from '../lib/crackmes'

export default function Submissions() {
  const { me, loading } = useAuth()
  const [items, setItems] = useState<MySubmission[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (loading || !me) return
    getMySubmissions().then((x) => { setItems(x); setState('ok') }).catch(() => setState('error'))
  }, [loading, me])

  if (loading) return null
  if (!me) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      Sign in to see your submissions. <Link to="/login?returnUrl=/submissions" className="text-acid hover:underline">Sign in →</Link>
    </main>
  )

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">My submissions</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        Where each crackme you submitted stands. A moderator reviews every submission before it goes public.
      </p>

      {state === 'loading' && <p className="mt-10 font-mono text-sm text-muted">loading<span className="caret">_</span></p>}
      {state === 'error' && <p className="mt-10 font-mono text-sm text-red-400">couldn’t load your submissions.</p>}
      {state === 'ok' && items.length === 0 && (
        <p className="mt-10 font-mono text-sm text-muted">
          You haven’t submitted anything yet. <Link to="/upload" className="text-acid hover:underline">Submit a crackme →</Link>
        </p>
      )}

      <div className="mt-8 space-y-3">
        {items.map((s) => (
          <div key={s.slug} className="rounded-xl border border-line bg-surface/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to={`/challenge/${s.slug}`} className="font-display text-lg font-bold text-ink transition-colors hover:text-acid">{s.title}</Link>
                <p className="mt-1 font-mono text-[12px] text-faint">
                  submitted {formatDate(s.createdAt)}{s.publishedAt && ` · published ${formatDate(s.publishedAt)}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={statusBadgeClass(s.status)}>{statusLabel(s.status)}</span>
                <Link to={`/challenge/${s.slug}`} className="font-mono text-[12px] text-acid transition-colors hover:underline">
                  {s.status === 'approved' ? 'open ↗' : 'preview ↗'}
                </Link>
              </div>
            </div>

            {s.status === 'pending' && (
              <p className="mt-3 font-mono text-[13px] text-muted">⏳ Awaiting moderator review — it’ll appear in the gallery once approved.</p>
            )}
            {s.status === 'rejected' && (
              <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-red-400">Not approved</p>
                <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink/80">
                  {s.moderatorMessage || 'No reason was provided. You can revise and submit again.'}
                </p>
              </div>
            )}
            {s.status === 'takenDown' && (
              <div className="mt-3 rounded-lg border border-orange-400/30 bg-orange-400/5 p-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-orange-400">
                  Taken down{s.takenDownAt && ` · ${formatDate(s.takenDownAt)}`}
                </p>
                <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink/80">{s.takedownReason || 'No reason was provided.'}</p>
              </div>
            )}
            {s.status === 'approved' && (
              <p className="mt-3 font-mono text-[12px] text-faint">{s.downloadCount.toLocaleString()} downloads · {s.solvedCount} solved</p>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
