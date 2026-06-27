import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { type NotificationItem, getNotifications, markAllRead, markRead, relativeTime } from '../lib/notifications'

export default function Notifications() {
  const { me, loading } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [state, setState] = useState<'loading' | 'ok'>('loading')

  useEffect(() => {
    if (loading || !me) return
    getNotifications().then((r) => { setItems(r.items); setState('ok') })
  }, [loading, me])

  if (loading) return null
  if (!me) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      Sign in to see notifications. <Link to="/login?returnUrl=/notifications" className="text-acid hover:underline">Sign in →</Link>
    </main>
  )

  const readAll = async () => {
    await markAllRead()
    setItems((xs) => xs.map((x) => ({ ...x, isRead: true })))
  }
  const open = async (n: NotificationItem) => {
    if (n.isRead) return
    await markRead(n.id)
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Notifications</h1>
        {items.some((x) => !x.isRead) && (
          <button onClick={readAll} className="font-mono text-[12px] text-faint transition-colors hover:text-acid">mark all read</button>
        )}
      </div>

      {state === 'loading' ? (
        <p className="mt-10 font-mono text-sm text-muted">loading<span className="caret">_</span></p>
      ) : items.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Nothing yet — you’ll hear when your submissions are reviewed, or your crackmes get a comment, writeup, or solve.
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {items.map((n) => {
            const inner = (
              <div className={`rounded-xl border p-4 transition-colors ${n.isRead ? 'border-line bg-surface/20' : 'border-acid/30 bg-acid/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[13px] text-ink">{n.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-faint">{relativeTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">{n.body}</p>}
              </div>
            )
            return n.linkUrl
              ? <Link key={n.id} to={n.linkUrl} onClick={() => open(n)} className="block">{inner}</Link>
              : <button key={n.id} onClick={() => open(n)} className="block w-full text-left">{inner}</button>
          })}
        </div>
      )}
    </main>
  )
}
