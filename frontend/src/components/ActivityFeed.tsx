import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type ActivityItem, getActivity } from '../lib/feed'
import { relativeTime } from '../lib/notifications'

// Live "is anyone here?" strip for the home page: recent solves, first bloods, new challenges.
// Polls every 45s and on tab refocus. Self-hides until there's something to show.
export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  useEffect(() => {
    let live = true
    const load = () => getActivity().then((x) => { if (live) setItems(x) }).catch(() => {})
    load()
    const id = setInterval(load, 45_000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { live = false; clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [])

  if (items.length === 0) return null

  return (
    <section className="my-16">
      <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-acid" />
        </span>
        live activity
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/25">
        {items.map((a, i) => <Row key={i} a={a} />)}
      </div>
    </section>
  )
}

function Row({ a }: { a: ActivityItem }) {
  const actor = a.actorHandle
    ? <Link to={`/user/${a.actorHandle}`} className="relative z-10 text-ink transition-colors hover:text-acid">{a.actorName}</Link>
    : <span className="text-ink">{a.actorName ?? 'someone'}</span>
  const crackme = <Link to={`/challenge/${a.crackmeSlug}`} className="text-muted transition-colors hover:text-acid">{a.crackmeTitle}</Link>

  return (
    <div className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 font-mono text-[13px] last:border-0">
      <span className="w-4 shrink-0 text-center" aria-hidden>{a.kind === 'firstBlood' ? '🩸' : a.kind === 'solve' ? '✓' : '✦'}</span>
      <span className="min-w-0 flex-1 truncate">
        {a.kind === 'published'
          ? <>{actor} published {crackme}</>
          : a.kind === 'firstBlood'
            ? <>{actor} drew <span className="text-red-400">first blood</span> on {crackme}</>
            : <>{actor} solved {crackme}</>}
      </span>
      {a.points != null && a.points > 0 && <span className="shrink-0 text-acid">+{a.points}</span>}
      <span className="shrink-0 text-faint">{relativeTime(a.at)}</span>
    </div>
  )
}
