import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isModerator, useAuth } from '../lib/auth'
import {
  type PendingItem, getQueue, approveCrackme, rejectCrackme, moderationFileUrl,
  platformLabel, languageLabel, difficultyLabel, formatSize, formatDate,
} from '../lib/crackmes'

export default function Moderation() {
  const { me, loading } = useAuth()
  const [items, setItems] = useState<PendingItem[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !isModerator(me)) return
    getQueue().then((q) => { setItems(q); setState('ok') }).catch(() => setState('error'))
  }, [loading, me])

  if (loading) return null
  if (!isModerator(me)) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      Moderators only. <Link to="/" className="text-acid hover:underline">home</Link>
    </main>
  )

  const act = async (item: PendingItem, approve: boolean) => {
    let message = ''
    if (!approve) {
      message = window.prompt('Reason for rejection (shown to the author):') ?? ''
      if (message === '') return
    }
    setBusy(item.id)
    const ok = approve ? await approveCrackme(item.id) : await rejectCrackme(item.id, message)
    setBusy(null)
    if (ok) setItems((xs) => xs.filter((x) => x.id !== item.id))
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Review queue</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        Every submission is private until approved. Download &amp; inspect in a VM before deciding.
      </p>

      {state === 'loading' && <p className="mt-10 font-mono text-sm text-muted">loading<span className="caret">_</span></p>}
      {state === 'error' && <p className="mt-10 font-mono text-sm text-red-400">couldn’t load the queue.</p>}
      {state === 'ok' && items.length === 0 && <p className="mt-10 font-mono text-sm text-muted">queue is empty — nothing to review. ✓</p>}

      <div className="mt-8 space-y-4">
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-surface/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">{c.title}</h2>
                <p className="mt-1 font-mono text-[12px] text-muted">
                  by {c.author} · {c.runtime ?? platformLabel(c.platform)} · {languageLabel(c.language)} · {difficultyLabel(c.difficulty)} · {formatSize(c.sizeBytes)} · {formatDate(c.createdAt)}
                </p>
              </div>
              <a href={moderationFileUrl(c.id)} className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid">
                download to inspect ↓
              </a>
            </div>

            {c.description && <p className="mt-3 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/80">{c.description}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.isBitMonoObfuscated && <span className="rounded border border-acid/40 px-1.5 py-px font-mono text-[11px] text-acid">BitMono</span>}
              {c.protections.map((p) => (
                <span key={p} className="rounded border border-line bg-void/60 px-1.5 py-px font-mono text-[11px] text-muted">{p}</span>
              ))}
            </div>

            <p className="mt-3 break-all font-mono text-[11px] text-faint">sha256 {c.sha256}</p>

            <div className="mt-4 flex gap-2">
              <button onClick={() => act(c, true)} disabled={busy === c.id} className="btn-acid disabled:opacity-50">approve</button>
              <button onClick={() => act(c, false)} disabled={busy === c.id} className="rounded-full border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50">reject</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
