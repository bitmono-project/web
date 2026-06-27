import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type CrackmeDetail as Detail, type CommentItem, type MyRating, type WriteupItem, type ReactionSummary,
  getCrackme, getComments, postComment, getMyRating, rateCrackme,
  getWriteups, submitWriteup, writeupAttachmentUrl,
  REACTIONS, toggleCrackmeReaction, toggleCommentReaction, updateCrackmeSettings,
  REPORT_REASONS, reportCrackme, takedownCrackme, restoreCrackme,
  platformLabel, languageLabel, difficultyNumber, formatSize, formatDate,
} from '../lib/crackmes'
import { type Me, isAdmin, useAuth } from '../lib/auth'
import { getConfig } from '../lib/config'

export default function CrackmeDetail() {
  const { slug = '' } = useParams()
  const { me } = useAuth()
  const [c, setC] = useState<Detail | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [zipPassword, setZipPassword] = useState('bitmono.dev')

  useEffect(() => { getConfig().then((cfg) => setZipPassword(cfg.zipPassword)) }, [])

  useEffect(() => {
    let live = true
    setState('loading')
    getCrackme(slug)
      .then((r) => { if (live) { setC(r); setState(r ? 'ok' : 'missing') } })
      .catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [slug])

  // Re-fetch after an admin action — takedown flips the page to the tombstone, restore flips it back.
  const reload = () => getCrackme(slug).then((r) => setC(r)).catch(() => {})

  if (state === 'loading') return <Center>loading<span className="caret">_</span></Center>
  if (state === 'error') return <Center>couldn’t load this crackme.</Center>
  if (state === 'missing' || !c) return (
    <Center>
      not found. <Link to="/crackmes" className="text-acid hover:underline">back to the gallery</Link>
    </Center>
  )

  if (c.status === 'takenDown') return <Tombstone c={c} canRestore={isAdmin(me)} onRestore={reload} />

  const diff = (c.avgDifficulty ?? difficultyNumber(c.authorDifficulty)).toFixed(1)
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/crackmes" className="font-mono text-xs text-faint transition-colors hover:text-muted">← all crackmes</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{c.title}</h1>
          <p className="mt-1 font-mono text-sm text-muted">by {c.author}</p>
        </div>
        <div className="text-right">
          <a href={`/api/crackmes/${c.slug}/download`} className="btn-acid">download ↓</a>
          <p className="mt-2 font-mono text-[11px] text-faint">zip password: <span className="text-muted">{zipPassword}</span></p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface/30 p-6 font-mono text-sm sm:grid-cols-4">
        <Field label="Runtime" value={c.runtime ?? platformLabel(c.platform)} />
        <Field label="Language" value={languageLabel(c.language)} />
        <Field label="Difficulty"><span className="text-acid">{diff}</span> <span className="text-faint">({c.difficultyCount})</span></Field>
        <Field label="Quality">{c.avgQuality != null ? c.avgQuality.toFixed(1) : '—'} <span className="text-faint">({c.qualityCount})</span></Field>
        <Field label="Size" value={formatSize(c.sizeBytes)} />
        <Field label="Downloads" value={String(c.downloadCount)} />
        <Field label="Solved" value={String(c.solvedCount)} />
        <Field label="Published" value={formatDate(c.publishedAt)} />
      </dl>

      <div className="mt-6">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
          Protections {c.isBitMonoObfuscated && <span className="ml-1 text-acid">· BitMono {c.preset}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.protections.length === 0
            ? <span className="font-mono text-sm text-faint">none declared</span>
            : c.protections.map((p) => (
              <span key={p} className="rounded-full border border-line bg-void/60 px-3 py-1 font-mono text-[12px] text-muted">{p}</span>
            ))}
        </div>
      </div>

      {c.reactionsEnabled && (
        <div className="mt-6">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Reactions</div>
          <ReactionBar initialCounts={c.reactions} initialMine={c.myReactions} canReact={!!me} toggle={(e) => toggleCrackmeReaction(c.slug, e)} />
          {!me && <p className="mt-1 font-mono text-[11px] text-faint">sign in to react</p>}
        </div>
      )}

      {c.description && (
        <div className="mt-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Description</div>
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink/90">{c.description}</p>
        </div>
      )}

      <p className="mt-10 rounded-lg border border-line bg-surface/30 p-4 font-mono text-[12px] leading-relaxed text-muted">
        ⚠ Run crackmes only inside a VM. Obfuscated binaries often trip antivirus by design — that’s expected, not malware.
      </p>

      <ReportControl slug={c.slug} />

      <RatingsPanel slug={c.slug} me={me} initial={c} />
      <WriteupsPanel slug={c.slug} me={me} zipPassword={zipPassword} />
      <CommentsPanel slug={c.slug} me={me} commentReactionsEnabled={c.commentReactionsEnabled} />
      {c.isOwner && (
        <OwnerSettings
          slug={c.slug}
          reactionsEnabled={c.reactionsEnabled}
          commentReactionsEnabled={c.commentReactionsEnabled}
          onChange={(r, cr) => setC({ ...c, reactionsEnabled: r, commentReactionsEnabled: cr })}
        />
      )}
      {isAdmin(me) && <AdminControls c={c} onChange={reload} />}
    </main>
  )
}

// Shown instead of the full page when a crackme has been taken down — a public notice with the reason.
function Tombstone({ c, canRestore, onRestore }: { c: Detail; canRestore: boolean; onRestore: () => void }) {
  const [busy, setBusy] = useState(false)
  const restore = async () => {
    setBusy(true)
    const ok = await restoreCrackme(c.id)
    setBusy(false)
    if (ok) onRestore()
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link to="/crackmes" className="font-mono text-xs text-faint transition-colors hover:text-muted">← all crackmes</Link>
      <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/5 p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400">Taken down</div>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">{c.title}</h1>
        <p className="mt-1 font-mono text-sm text-muted">by {c.author}</p>
        <p className="mt-6 font-mono text-sm leading-relaxed text-ink/80">
          This crackme was removed by a moderator and is no longer available for download.
        </p>
        {c.takedownReason && (
          <p className="mx-auto mt-4 max-w-md rounded-lg border border-red-400/30 bg-void/40 p-3 font-mono text-[13px] text-red-300">
            Reason: {c.takedownReason}
          </p>
        )}
        {c.takenDownAt && <p className="mt-3 font-mono text-[11px] text-faint">removed {formatDate(c.takenDownAt)}</p>}
      </div>
      {canRestore && (
        <div className="mt-4 text-center">
          <button onClick={restore} disabled={busy} className="rounded-full border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-acid hover:text-acid disabled:opacity-50">
            {busy ? '…' : 'restore this crackme'}
          </button>
        </div>
      )}
    </main>
  )
}

// Admin-only takedown control on a live crackme (matches the existing reject flow's prompt UX).
function AdminControls({ c, onChange }: { c: Detail; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const takedown = async () => {
    const reason = window.prompt('Takedown reason (shown publicly on the crackme page):') ?? ''
    if (!reason.trim()) return
    setBusy(true)
    const ok = await takedownCrackme(c.id, reason.trim())
    setBusy(false)
    if (ok) onChange()
  }
  return (
    <div className="mt-10 rounded-lg border border-dashed border-red-400/40 bg-red-400/5 p-4">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-red-400/80">Admin</div>
      <p className="mb-3 font-mono text-[12px] text-muted">Remove this crackme from the gallery. Visitors will see a takedown notice with your reason.</p>
      <button onClick={takedown} disabled={busy} className="rounded-full border border-red-400/50 px-4 py-2 font-mono text-sm text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50">
        {busy ? '…' : 'take down'}
      </button>
    </div>
  )
}

function ReportControl({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done'>('idle')

  const send = async () => {
    setPhase('sending')
    const ok = await reportCrackme(slug, reason, details)
    setPhase(ok ? 'done' : 'idle')
    if (ok) setOpen(false)
  }

  if (phase === 'done')
    return <p className="mt-3 font-mono text-[12px] text-faint">Thanks — a moderator will take a look.</p>

  return (
    <div className="mt-3">
      {!open ? (
        <button onClick={() => setOpen(true)} className="font-mono text-[12px] text-faint transition-colors hover:text-red-400">⚑ report this crackme</button>
      ) : (
        <div className="rounded-lg border border-line bg-surface/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-acid">
              {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button onClick={() => setOpen(false)} className="font-mono text-[12px] text-faint hover:text-muted">cancel</button>
            <button onClick={send} disabled={phase === 'sending'} className="ml-auto rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50">submit report</button>
          </div>
          <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="optional details" className="mt-2 w-full rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-acid" />
        </div>
      )}
    </div>
  )
}

function ReactionBar({ initialCounts, initialMine, canReact, toggle }: {
  initialCounts: Record<string, number>
  initialMine: string[]
  canReact: boolean
  toggle: (emoji: string) => Promise<ReactionSummary | null>
}) {
  const [counts, setCounts] = useState(initialCounts)
  const [mine, setMine] = useState<string[]>(initialMine)
  const [busy, setBusy] = useState(false)

  const click = async (emoji: string) => {
    if (!canReact || busy) return
    setBusy(true)
    const r = await toggle(emoji)
    setBusy(false)
    if (r) { setCounts(r.counts); setMine(r.mine) }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTIONS.map((e) => {
        const n = counts[e] ?? 0
        const on = mine.includes(e)
        return (
          <button
            key={e}
            onClick={() => click(e)}
            disabled={!canReact || busy}
            className={`rounded-full border px-2 py-0.5 font-mono text-[13px] transition-colors ${on ? 'border-acid bg-acid/15 text-acid' : 'border-line text-muted'} ${canReact ? 'hover:border-acid' : 'cursor-not-allowed opacity-60'}`}
          >
            {e}{n > 0 && <span className="ml-1 text-[11px]">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}

function OwnerSettings({ slug, reactionsEnabled, commentReactionsEnabled, onChange }: {
  slug: string
  reactionsEnabled: boolean
  commentReactionsEnabled: boolean
  onChange: (reactionsEnabled: boolean, commentReactionsEnabled: boolean) => void
}) {
  const save = async (r: boolean, cr: boolean) => {
    if (await updateCrackmeSettings(slug, r, cr)) onChange(r, cr)
  }
  return (
    <div className="mt-10 rounded-lg border border-dashed border-line bg-void/30 p-4">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Owner settings</div>
      <label className="flex items-center gap-2 font-mono text-[13px] text-muted">
        <input type="checkbox" checked={reactionsEnabled} onChange={(e) => save(e.target.checked, commentReactionsEnabled)} /> allow reactions on this post
      </label>
      <label className="mt-1 flex items-center gap-2 font-mono text-[13px] text-muted">
        <input type="checkbox" checked={commentReactionsEnabled} onChange={(e) => save(reactionsEnabled, e.target.checked)} /> allow reactions on comments
      </label>
    </div>
  )
}

function RatingsPanel({ slug, me, initial }: { slug: string; me: Me | null; initial: Detail }) {
  const [avgDiff, setAvgDiff] = useState(initial.avgDifficulty)
  const [diffCount, setDiffCount] = useState(initial.difficultyCount)
  const [avgQual, setAvgQual] = useState(initial.avgQuality)
  const [qualCount, setQualCount] = useState(initial.qualityCount)
  const [mine, setMine] = useState<MyRating>({ difficulty: null, quality: null })

  useEffect(() => {
    if (me) getMyRating(slug).then((r) => { if (r) setMine(r) })
  }, [slug, me])

  const submit = async (difficulty: number, quality: number) => {
    const r = await rateCrackme(slug, difficulty, quality)
    if (!r) return
    setAvgDiff(r.avgDifficulty); setDiffCount(r.difficultyCount)
    setAvgQual(r.avgQuality); setQualCount(r.qualityCount)
  }

  const pickDiff = (d: number) => {
    setMine((m) => ({ ...m, difficulty: d }))
    if (mine.quality != null) submit(d, mine.quality)
  }
  const pickQual = (q: number) => {
    setMine((m) => ({ ...m, quality: q }))
    if (mine.difficulty != null) submit(mine.difficulty, q)
  }

  return (
    <div className="mt-10">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-faint">Rate it</div>
      {!me && <p className="mb-3 font-mono text-[12px] text-muted">
        <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to rate difficulty &amp; quality.
      </p>}
      <div className="space-y-3">
        <Scale label="Difficulty" value={mine.difficulty} avg={avgDiff} count={diffCount} disabled={!me} onPick={pickDiff} />
        <Scale label="Quality" value={mine.quality} avg={avgQual} count={qualCount} disabled={!me} onPick={pickQual} />
      </div>
    </div>
  )
}

function Scale({ label, value, avg, count, disabled, onPick }: {
  label: string; value: number | null; avg: number | null; count: number; disabled: boolean; onPick: (n: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-[13px]">
      <span className="w-20 text-muted">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onPick(n)}
            className={`h-7 w-7 rounded border text-[12px] transition-colors ${value === n ? 'border-acid bg-acid text-void' : 'border-line text-muted'} ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-acid hover:text-acid'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-faint">avg {avg != null ? avg.toFixed(1) : '—'} ({count})</span>
    </div>
  )
}

function CommentsPanel({ slug, me, commentReactionsEnabled }: { slug: string; me: Me | null; commentReactionsEnabled: boolean }) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [body, setBody] = useState('')
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getComments(slug).then(setComments) }, [slug])

  const send = async () => {
    if (!body.trim()) return
    setBusy(true)
    const added = await postComment(slug, body.trim(), isSpoiler)
    setBusy(false)
    if (added) {
      setComments((xs) => [...xs, added])
      setBody(''); setIsSpoiler(false)
    }
  }

  return (
    <div className="mt-10">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-faint">Comments ({comments.length})</div>

      <div className="space-y-3">
        {comments.length === 0 && <p className="font-mono text-[13px] text-faint">No comments yet.</p>}
        {comments.map((cm) => (
          <div key={cm.id} className="rounded-lg border border-line bg-surface/30 p-3">
            <div className="font-mono text-[11px] text-faint">{cm.author} · {formatDate(cm.createdAt)}</div>
            {cm.isSpoiler && !revealed.has(cm.id)
              ? <button onClick={() => setRevealed((s) => new Set(s).add(cm.id))} className="mt-1 font-mono text-[13px] text-acid hover:underline">[spoiler — click to reveal]</button>
              : <p className="mt-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">{cm.body}</p>}
            {commentReactionsEnabled && (
              <div className="mt-2">
                <ReactionBar initialCounts={cm.reactions} initialMine={cm.myReactions} canReact={!!me} toggle={(e) => toggleCommentReaction(cm.id, e)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {me ? (
        <div className="mt-4">
          <textarea
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            rows={3}
            maxLength={4000}
            placeholder="Stay polite — don’t spoil the solution (or mark it as a spoiler)."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
              <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} /> mark as spoiler
            </label>
            <button onClick={send} disabled={busy || !body.trim()} className="btn-acid ml-auto disabled:opacity-50">{busy ? '…' : 'comment'}</button>
          </div>
        </div>
      ) : (
        <p className="mt-4 font-mono text-[13px] text-muted">
          <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to comment.
        </p>
      )}
    </div>
  )
}

function WriteupsPanel({ slug, me, zipPassword }: { slug: string; me: Me | null; zipPassword: string }) {
  const [writeups, setWriteups] = useState<WriteupItem[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  useEffect(() => { getWriteups(slug).then(setWriteups) }, [slug])

  const send = async () => {
    if (!body.trim()) return
    setPhase('sending')
    const ok = await submitWriteup(slug, title, body.trim(), file)
    setPhase(ok ? 'done' : 'error')
    if (ok) { setTitle(''); setBody(''); setFile(null); setOpen(false) }
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Writeups ({writeups.length})</span>
        {me && <button onClick={() => setOpen((o) => !o)} className="font-mono text-[12px] text-acid hover:underline">{open ? 'cancel' : '+ submit a writeup'}</button>}
      </div>

      {phase === 'done' && <p className="mb-3 font-mono text-[12px] text-acid">Writeup submitted — it’ll appear here once a moderator approves it.</p>}

      {open && me && (
        <div className="mb-4 rounded-lg border border-line bg-surface/30 p-4">
          <p className="mb-2 font-mono text-[11px] text-faint">Explain how you solved it — Markdown welcome. Don’t just paste a key; show the process. Optional keygen/patched binary as attachment.</p>
          <input
            className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            placeholder="title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150}
          />
          <textarea
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            rows={8} maxLength={40000} placeholder="# How I cracked it&#10;..." value={body} onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="font-mono text-[12px] text-muted file:mr-2 file:rounded file:border-0 file:bg-line file:px-2 file:py-1 file:text-ink" />
            <button onClick={send} disabled={phase === 'sending' || !body.trim()} className="btn-acid ml-auto disabled:opacity-50">{phase === 'sending' ? '…' : 'submit for review'}</button>
          </div>
          {phase === 'error' && <p className="mt-2 font-mono text-xs text-red-400">Submission failed — try again.</p>}
        </div>
      )}

      <div className="space-y-3">
        {writeups.length === 0 && <p className="font-mono text-[13px] text-faint">No writeups yet — be the first.</p>}
        {writeups.map((w) => (
          <div key={w.id} className="rounded-lg border border-line bg-surface/30 p-4">
            <div className="flex items-center justify-between font-mono text-[11px] text-faint">
              <span>{w.title ?? 'Writeup'} · {w.author} · {formatDate(w.createdAt)}</span>
            </div>
            {revealed.has(w.id) ? (
              <>
                <p className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">{w.bodyMarkdown}</p>
                {w.hasAttachment && (
                  <a href={writeupAttachmentUrl(slug, w.id)} className="mt-3 inline-block font-mono text-[12px] text-acid hover:underline">
                    download attachment ↓ (zip password: {zipPassword})
                  </a>
                )}
              </>
            ) : (
              <button onClick={() => setRevealed((s) => new Set(s).add(w.id))} className="mt-1 font-mono text-[13px] text-acid hover:underline">
                [full solution — click to reveal spoiler]
              </button>
            )}
          </div>
        ))}
      </div>

      {!me && <p className="mt-3 font-mono text-[13px] text-muted">
        <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to submit a writeup.
      </p>}
    </div>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-1 text-ink">{children ?? value}</dd>
    </div>
  )
}

const Center = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto max-w-4xl px-6 py-24 text-center font-mono text-sm text-muted">{children}</main>
)
