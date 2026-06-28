import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isModerator, useAuth } from '../lib/auth'
import { PromptDialog, ConfirmDialog, REJECT_PRESETS } from '../components/PromptDialog'
import {
  type PendingItem, type PendingWriteup, type PendingReport,
  getQueue, approveCrackme, rejectCrackme, moderationFileUrl,
  getWriteupQueue, approveWriteup, rejectWriteup, modWriteupAttachmentUrl,
  getReportQueue, resolveReport,
  platformLabel, languageLabel, difficultyLabel, formatSize, formatDate,
} from '../lib/crackmes'

export default function Moderation() {
  const { me, loading } = useAuth()
  const [items, setItems] = useState<PendingItem[]>([])
  const [writeups, setWriteups] = useState<PendingWriteup[]>([])
  const [reports, setReports] = useState<PendingReport[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PendingItem | null>(null)
  const [approving, setApproving] = useState<PendingItem | null>(null)

  useEffect(() => {
    if (loading || !isModerator(me)) return
    getQueue().then((q) => { setItems(q); setState('ok') }).catch(() => setState('error'))
    getWriteupQueue().then(setWriteups).catch(() => {})
    getReportQueue().then(setReports).catch(() => {})
  }, [loading, me])

  const resolveOne = async (id: string) => {
    setBusy(id)
    const ok = await resolveReport(id)
    setBusy(null)
    if (ok) setReports((xs) => xs.filter((x) => x.id !== id))
  }

  const actWriteup = async (id: string, approve: boolean) => {
    setBusy(id)
    const ok = approve ? await approveWriteup(id) : await rejectWriteup(id)
    setBusy(null)
    if (ok) setWriteups((xs) => xs.filter((x) => x.id !== id))
  }

  if (loading) return null
  if (!isModerator(me)) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      Moderators only. <Link to="/" className="text-acid hover:underline">home</Link>
    </main>
  )

  const approve = async (item: PendingItem) => {
    setApproving(null)
    setBusy(item.id)
    const ok = await approveCrackme(item.id)
    setBusy(null)
    if (ok) setItems((xs) => xs.filter((x) => x.id !== item.id))
  }
  const doReject = async (item: PendingItem, reason: string) => {
    setRejecting(null)
    setBusy(item.id)
    const ok = await rejectCrackme(item.id, reason)
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
              <div className="flex shrink-0 gap-2">
                <Link to={`/challenge/${c.slug}`} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid">
                  preview ↗
                </Link>
                <a href={moderationFileUrl(c.id)} className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid">
                  download to inspect ↓
                </a>
              </div>
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
              <button onClick={() => setApproving(c)} disabled={busy === c.id} className="btn-acid disabled:opacity-50">approve</button>
              <button onClick={() => setRejecting(c)} disabled={busy === c.id} className="rounded-full border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50">reject</button>
            </div>
          </div>
        ))}
      </div>

      {reports.length > 0 && (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold text-ink">
            Reports <span className="font-mono text-sm text-faint">({reports.length})</span>
          </h2>
          <div className="mt-4 space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-surface/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-[13px]">
                    <span className="rounded border border-red-400/40 px-1.5 py-px text-[11px] uppercase text-red-400">{r.reason}</span>{' '}
                    <Link to={`/challenge/${r.crackmeSlug}`} className="text-acid hover:underline">{r.crackmeTitle}</Link>
                    <span className="ml-2 text-faint">{r.reporter} · {formatDate(r.createdAt)}</span>
                  </div>
                  <button onClick={() => resolveOne(r.id)} disabled={busy === r.id} className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid disabled:opacity-50">resolve</button>
                </div>
                {r.details && <p className="mt-2 font-mono text-[12px] text-muted">{r.details}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {writeups.length > 0 && (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold text-ink">
            Writeup queue <span className="font-mono text-sm text-faint">({writeups.length})</span>
          </h2>
          <div className="mt-4 space-y-4">
            {writeups.map((w) => (
              <div key={w.id} className="rounded-xl border border-line bg-surface/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">{w.title ?? 'Writeup'}</h3>
                    <p className="mt-1 font-mono text-[12px] text-muted">
                      for <Link to={`/challenge/${w.crackmeSlug}`} className="text-acid hover:underline">{w.crackmeTitle}</Link> · by {w.author} · {formatDate(w.createdAt)}
                    </p>
                  </div>
                  {w.hasAttachment && (
                    <a href={modWriteupAttachmentUrl(w.id)} className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid">attachment ↓</a>
                  )}
                </div>
                <p className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-void/40 p-3 font-mono text-[12px] leading-relaxed text-ink/80">{w.bodyMarkdown}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => actWriteup(w.id, true)} disabled={busy === w.id} className="btn-acid disabled:opacity-50">approve</button>
                  <button onClick={() => actWriteup(w.id, false)} disabled={busy === w.id} className="rounded-full border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50">reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {approving && (
        <ConfirmDialog
          title="Approve submission"
          message={`“${approving.title}” will be published to the gallery and the author notified. You can still take it down later.`}
          confirmText="approve"
          onConfirm={() => approve(approving)}
          onCancel={() => setApproving(null)}
        />
      )}
      {rejecting && (
        <PromptDialog
          title="Reject submission"
          label={`“${rejecting.title}” — the reason is shown to the author.`}
          placeholder="pick a reason above, or write your own"
          confirmText="reject"
          danger
          presets={REJECT_PRESETS}
          onConfirm={(reason) => doReject(rejecting, reason)}
          onCancel={() => setRejecting(null)}
        />
      )}
    </main>
  )
}
