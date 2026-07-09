import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type CrackmeDetail as Detail, type CommentItem, type CommentEditItem, type MyRating, type WriteupItem, type ReactionSummary,
  getCrackme, getComments, postComment, editComment, deleteComment, getCommentHistory, hideComment, setCommentsLock, getMyRating, rateCrackme,
  getWriteups, submitWriteup, writeupAttachmentUrl, writeupImageUrl, toggleWriteupUpvote, toggleWriteupHelped, pinWriteup, editWriteup, deleteWriteup,
  REACTIONS, toggleCrackmeReaction, toggleCommentReaction, updateCrackmeSettings,
  REPORT_REASONS, reportCrackme, takedownCrackme, restoreCrackme, approveCrackme, rejectCrackme,
  type ModerationEvent, getModerationHistory,
  markSolved, unmarkSolved, submitFlag, setVerification, VERIFICATION_KINDS,
  type HintItem, getHints, unlockHint, addHint, deleteHint,
  platformLabel, languageLabel, difficultyNumber, formatSize, formatDate, statusLabel,
} from '../lib/crackmes'
import { type Me, isAdmin, isModerator, useAuth } from '../lib/auth'
import { PromptDialog, ConfirmDialog, TAKEDOWN_PRESETS, RESTORE_PRESETS, REJECT_PRESETS } from '../components/PromptDialog'
import { ImageGallery } from '../components/ImageGallery'
import { MentionText } from '../components/MentionText'
import { MentionTextarea } from '../components/MentionTextarea'
import { Turnstile } from '../components/Turnstile'
import { Tooltip } from '../components/Tooltip'
import { StaffTag } from '../components/StaffTag'
import { getConfig } from '../lib/config'
import { useTitle } from '../lib/useTitle'

export default function CrackmeDetail() {
  const { slug = '' } = useParams()
  const { me } = useAuth()
  const [c, setC] = useState<Detail | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [zipPassword, setZipPassword] = useState('bitmono.dev')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null)

  useEffect(() => { getConfig().then((cfg) => { setZipPassword(cfg.zipPassword); setTurnstileSiteKey(cfg.turnstileSiteKey) }) }, [])

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

  useTitle(c ? `${c.title} — BitMono crackme` : 'Crackme — BitMono')

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

      {c.status !== 'approved' && (
        <div className="mt-4 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 font-mono text-[12px] text-yellow-300">
          Preview — this submission is <span className="font-bold">{statusLabel(c.status)}</span> and isn’t public yet.
        </div>
      )}

      {isModerator(me) && c.status === 'pending' && <ModeratePanel c={c} onChange={reload} />}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{c.title}</h1>
          <p className="mt-1 font-mono text-sm text-muted">
            by {c.authorHandle
              ? <Link to={`/user/${c.authorHandle}`} className="text-muted transition-colors hover:text-acid">{c.author}</Link>
              : c.author}
          </p>
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

      {c.verificationKind === 'none'
        ? <SolveButton slug={c.slug} initialSolved={c.solvedByMe} canSolve={!!me && !c.isOwner} onCount={(n) => setC({ ...c, solvedCount: n })} />
        : <FlagSubmit slug={c.slug} initialSolved={c.solvedByMe} me={me} isOwner={c.isOwner} onCount={(n) => setC({ ...c, solvedCount: n })} />}

      <div className="mt-6">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
          Protections {c.isBitMonoObfuscated && <span className="ml-1 text-acid">· BitMono {c.preset}{c.bitMonoVersion && ` · v${c.bitMonoVersion}`}</span>}
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
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink/90"><MentionText text={c.description} /></p>
        </div>
      )}

      <p className="mt-10 rounded-lg border border-line bg-surface/30 p-4 font-mono text-[12px] leading-relaxed text-muted">
        ⚠ Run crackmes only inside a VM. Obfuscated binaries often trip antivirus by design — that’s expected, not malware.
      </p>

      <ReportControl slug={c.slug} />
      <ModerationHistory slug={c.slug} />

      <HintsPanel slug={c.slug} me={me} canManage={c.isOwner || isAdmin(me)} solved={c.solvedByMe} />
      <RatingsPanel slug={c.slug} me={me} initial={c} />
      <WriteupsPanel slug={c.slug} me={me} isOwner={c.isOwner} zipPassword={zipPassword} turnstileSiteKey={turnstileSiteKey} />
      <CommentsPanel slug={c.slug} crackmeId={c.id} me={me} commentReactionsEnabled={c.commentReactionsEnabled} commentsLocked={c.commentsLocked} turnstileSiteKey={turnstileSiteKey} />
      {c.isOwner && (
        <>
          <OwnerSettings
            slug={c.slug}
            reactionsEnabled={c.reactionsEnabled}
            commentReactionsEnabled={c.commentReactionsEnabled}
            onChange={(r, cr) => setC({ ...c, reactionsEnabled: r, commentReactionsEnabled: cr })}
          />
          <VerificationSettings slug={c.slug} current={c.verificationKind} onChange={(k) => setC({ ...c, verificationKind: k })} />
        </>
      )}
      {isAdmin(me) && <AdminControls c={c} onChange={reload} />}
    </main>
  )
}

// Shown instead of the full page when a crackme has been taken down — a public notice with the reason.
function Tombstone({ c, canRestore, onRestore }: { c: Detail; canRestore: boolean; onRestore: () => void }) {
  const [busy, setBusy] = useState(false)
  const [prompting, setPrompting] = useState(false)
  const restore = async (reason: string) => {
    setPrompting(false)
    setBusy(true)
    const ok = await restoreCrackme(c.id, reason)
    setBusy(false)
    if (ok) onRestore()
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link to="/crackmes" className="font-mono text-xs text-faint transition-colors hover:text-muted">← all crackmes</Link>
      <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/5 p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400">Taken down</div>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">{c.title}</h1>
        <p className="mt-1 font-mono text-sm text-muted">by {c.authorHandle
          ? <Link to={`/user/${c.authorHandle}`} className="text-muted transition-colors hover:text-acid">{c.author}</Link>
          : c.author}</p>
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
        <div className="mt-4 flex items-center justify-center gap-2">
          <StaffTag label="admin" />
          <button onClick={() => setPrompting(true)} disabled={busy} className="rounded-full border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-acid hover:text-acid disabled:opacity-50">
            {busy ? '…' : 'restore this crackme'}
          </button>
        </div>
      )}
      <ModerationHistory slug={c.slug} />
      {prompting && (
        <PromptDialog
          title="Restore crackme"
          label="Put this back in the public gallery."
          warning="This action and your reason are recorded in the public moderation history that everyone can see."
          placeholder="why are you restoring this?"
          confirmText="restore"
          presets={RESTORE_PRESETS}
          onConfirm={restore}
          onCancel={() => setPrompting(false)}
        />
      )}
    </main>
  )
}

// Public takedown/restore trail — shown on both the live page and the tombstone whenever a crackme has
// been moderated. Renders nothing for the common never-touched case, so it self-hides.
function ModerationHistory({ slug }: { slug: string }) {
  const [events, setEvents] = useState<ModerationEvent[]>([])
  useEffect(() => { getModerationHistory(slug).then(setEvents).catch(() => {}) }, [slug])
  if (events.length === 0) return null
  return (
    <div className="mt-10">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-faint">
        Moderation history <span className="text-faint">· {events.length}</span>
      </div>
      <ol className="relative ml-1 border-l border-line pl-6">
        {events.map((e, i) => <ModEvent key={i} e={e} />)}
      </ol>
    </div>
  )
}

function ModEvent({ e }: { e: ModerationEvent }) {
  const down = e.action === 'takenDown'
  return (
    <li className="relative pb-6 last:pb-0">
      <span className={`absolute -left-6 top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-void ${down ? 'bg-red-400' : 'bg-acid'}`} />
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12px]">
        <span className={`font-bold uppercase tracking-wider ${down ? 'text-red-400' : 'text-acid'}`}>
          {down ? 'Taken down' : 'Restored'}
        </span>
        <span className="text-faint">
          {formatDate(e.at)} ·{' '}
          {e.moderatorHandle
            ? <Link to={`/user/${e.moderatorHandle}`} className="transition-colors hover:text-acid">{e.moderator}</Link>
            : (e.moderator ?? 'a moderator')}
        </span>
      </div>
      {e.reason && <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink/80">“{e.reason}”</p>}
    </li>
  )
}

// Moderator/admin review controls on a pending submission's own page — approve to publish it, or reject
// with a reason the author sees, without going back to the moderation queue.
function ModeratePanel({ c, onChange }: { c: Detail; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const approve = async () => {
    setConfirmApprove(false)
    setBusy(true)
    const ok = await approveCrackme(c.id)
    setBusy(false)
    if (ok) onChange()
  }
  const reject = async (reason: string) => {
    setRejecting(false)
    setBusy(true)
    const ok = await rejectCrackme(c.id, reason)
    setBusy(false)
    if (ok) onChange()
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-yellow-400/40 bg-yellow-400/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <StaffTag label="mod" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-yellow-400/80">Review this submission</span>
      </div>
      <p className="mb-3 font-mono text-[12px] text-muted">
        Approve to publish it to the gallery now, or reject it with a reason the author sees on their submissions page.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConfirmApprove(true)} disabled={busy}
          className="rounded-full border border-acid/50 px-4 py-2 font-mono text-sm text-acid transition-colors hover:bg-acid/10 disabled:opacity-50">
          {busy ? '…' : '✓ approve & publish'}
        </button>
        <button onClick={() => setRejecting(true)} disabled={busy}
          className="rounded-full border border-red-400/50 px-4 py-2 font-mono text-sm text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50">
          ✕ reject
        </button>
      </div>
      {confirmApprove && (
        <ConfirmDialog
          title="Approve submission"
          message="This publishes the crackme to the public gallery right now."
          confirmText="approve"
          onConfirm={approve}
          onCancel={() => setConfirmApprove(false)}
        />
      )}
      {rejecting && (
        <PromptDialog
          title="Reject submission"
          label="Tell the author why — they’ll see this on their submissions page."
          placeholder="pick a reason above, or write your own"
          confirmText="reject"
          danger
          presets={REJECT_PRESETS}
          onConfirm={reject}
          onCancel={() => setRejecting(false)}
        />
      )}
    </div>
  )
}

// Admin-only takedown control on a live crackme.
function AdminControls({ c, onChange }: { c: Detail; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [prompting, setPrompting] = useState(false)
  const takedown = async (reason: string) => {
    setPrompting(false)
    setBusy(true)
    const ok = await takedownCrackme(c.id, reason)
    setBusy(false)
    if (ok) onChange()
  }
  return (
    <div className="mt-10 rounded-lg border border-dashed border-red-400/40 bg-red-400/5 p-4">
      <div className="mb-2"><StaffTag label="admin" /></div>
      <p className="mb-3 font-mono text-[12px] text-muted">Remove this crackme from the gallery. Visitors will see a takedown notice with your reason.</p>
      <button onClick={() => setPrompting(true)} disabled={busy} className="rounded-full border border-red-400/50 px-4 py-2 font-mono text-sm text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50">
        {busy ? '…' : 'take down'}
      </button>
      {prompting && (
        <PromptDialog
          title="Take down crackme"
          label="Pick a reason or write your own."
          warning="This reason is shown publicly on the takedown page — the author and everyone who visits can read it."
          placeholder="pick a reason above, or write your own"
          confirmText="take down"
          danger
          presets={TAKEDOWN_PRESETS}
          onConfirm={takedown}
          onCancel={() => setPrompting(false)}
        />
      )}
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

// Date-as-permalink (GitHub-style): the real href gives native right/middle-click semantics;
// a click also copies the absolute URL, and the hash navigation fires HashTarget's
// target-lock brackets on the linked card — the flash shows exactly what was copied.
function PermalinkDate({ anchor, children }: { anchor: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${anchor}`).catch(() => {})
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Tooltip label={copied ? 'copied ✓' : 'copy permalink'}>
      <a href={`#${anchor}`} onClick={copy} className="transition-colors hover:text-acid">{children}</a>
    </Tooltip>
  )
}

function CommentsPanel({ slug, crackmeId, me, commentReactionsEnabled, commentsLocked, turnstileSiteKey }: { slug: string; crackmeId: string; me: Me | null; commentReactionsEnabled: boolean; commentsLocked: boolean; turnstileSiteKey: string | null }) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [body, setBody] = useState('')
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [tsKey, setTsKey] = useState(0)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [confirmHide, setConfirmHide] = useState<string | null>(null)
  const [confirmLock, setConfirmLock] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [locked, setLocked] = useState(commentsLocked)
  const isMod = isModerator(me)

  useEffect(() => { getComments(slug).then(setComments) }, [slug])

  const send = async () => {
    if (!body.trim()) return
    setBusy(true)
    const added = await postComment(slug, body.trim(), isSpoiler, captcha)
    setBusy(false)
    if (added) {
      setComments((xs) => [...xs, added])
      setBody(''); setIsSpoiler(false)
      setCaptcha(null); setTsKey((k) => k + 1)
    }
  }

  // Replies are one level deep — replyTo holds the top-level comment id whose reply box is open.
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const openReply = (rootId: string) => { setReplyTo(rootId); setReplyBody('') }
  const sendReply = async (rootId: string) => {
    if (!replyBody.trim()) return
    setReplyBusy(true)
    const added = await postComment(slug, replyBody.trim(), false, captcha, rootId)
    setReplyBusy(false)
    if (added) {
      setComments((xs) => [...xs, added])
      setReplyTo(null); setReplyBody('')
      setCaptcha(null); setTsKey((k) => k + 1)
    }
  }

  const hide = async (id: string) => {
    const r = await hideComment(id)
    if (r !== null) setComments((xs) => xs.map((x) => (x.id === id ? { ...x, isHidden: r } : x)))
  }
  const toggleLock = async () => {
    const r = await setCommentsLock(crackmeId)
    if (r !== null) setLocked(r)
  }

  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editSpoiler, setEditSpoiler] = useState(false)
  const [history, setHistory] = useState<Record<string, CommentEditItem[]>>({})

  const startEdit = (cm: CommentItem) => { setEditing(cm.id); setEditBody(cm.body); setEditSpoiler(cm.isSpoiler) }
  const saveEdit = async (id: string) => {
    if (await editComment(slug, id, editBody.trim(), editSpoiler)) {
      setComments((xs) => xs.map((x) => (x.id === id ? { ...x, body: editBody.trim(), isSpoiler: editSpoiler, edited: true } : x)))
      setEditing(null)
    }
  }
  const del = async (id: string) => {
    if (await deleteComment(slug, id)) setComments((xs) => xs.map((x) => (x.id === id ? { ...x, isDeleted: true } : x)))
  }
  const showHistory = async (id: string) => {
    if (history[id]) { setHistory((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== id))); return }
    setHistory((cur) => ({ ...cur, [id]: [] }))   // show the box while loading
    const h = await getCommentHistory(slug, id)
    setHistory((cur) => ({ ...cur, [id]: h }))
  }

  // Flat list → one-level tree: roots keep gallery order, replies group under their parent.
  const roots = comments.filter((c) => !c.parentCommentId)
  const repliesByParent = new Map<string, CommentItem[]>()
  for (const c of comments)
    if (c.parentCommentId) repliesByParent.set(c.parentCommentId, [...(repliesByParent.get(c.parentCommentId) ?? []), c])

  // One comment card's contents (header + body + actions), shared by roots and replies.
  const renderComment = (cm: CommentItem) => {
    const rootId = cm.parentCommentId ?? cm.id
    return (
      <div id={`comment-${cm.id}`} className={cm.isHidden ? 'opacity-60' : ''}>
        {cm.isDeleted ? (
          <p className="font-mono text-[12px] italic text-faint">// comment deleted by its author</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-faint">
              <span>{cm.authorHandle
                ? <Link to={`/user/${cm.authorHandle}`} className="transition-colors hover:text-acid">{cm.author}</Link>
                : cm.author} · <PermalinkDate anchor={`comment-${cm.id}`}>{formatDate(cm.createdAt)}</PermalinkDate>{cm.edited && <button onClick={() => showHistory(cm.id)} className="ml-1 transition-colors hover:text-acid">· edited</button>}{cm.isHidden && <span className="ml-1 text-orange-400">· hidden</span>}</span>
              <span className="flex gap-2">
                {me && !locked && <button onClick={() => openReply(rootId)} className="transition-colors hover:text-acid">reply</button>}
                {cm.mine && editing !== cm.id && <button onClick={() => startEdit(cm)} className="transition-colors hover:text-acid">edit</button>}
                {cm.mine && <button onClick={() => setConfirmDel(cm.id)} className="transition-colors hover:text-red-400">delete</button>}
                {isMod && (
                  <span className="inline-flex items-center gap-1">
                    <StaffTag label="mod" />
                    {cm.isHidden
                      ? <Tooltip label="unhide comment"><button onClick={() => hide(cm.id)} className="transition-colors hover:text-acid">unhide</button></Tooltip>
                      : <Tooltip label="hide comment"><button onClick={() => setConfirmHide(cm.id)} className="transition-colors hover:text-red-400">hide</button></Tooltip>}
                  </span>
                )}
              </span>
            </div>
            {editing === cm.id ? (
              <div className="mt-2">
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} maxLength={4000}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid" />
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
                    <input type="checkbox" checked={editSpoiler} onChange={(e) => setEditSpoiler(e.target.checked)} /> spoiler
                  </label>
                  <button onClick={() => setEditing(null)} className="rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted transition-colors hover:border-acid hover:text-acid">cancel</button>
                  <button onClick={() => saveEdit(cm.id)} disabled={!editBody.trim()} className="btn-acid ml-auto px-3 py-1 text-[12px] disabled:opacity-50">save</button>
                </div>
              </div>
            ) : cm.isSpoiler && !revealed.has(cm.id) ? (
              <button onClick={() => setRevealed((s) => new Set(s).add(cm.id))} className="mt-1 font-mono text-[13px] text-acid hover:underline">[spoiler — click to reveal]</button>
            ) : (
              <p className="mt-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90"><MentionText text={cm.body} /></p>
            )}
            {history[cm.id] && (
              <div className="mt-2 space-y-1 rounded border border-line bg-void/40 p-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-faint">edit history</div>
                {history[cm.id].length === 0
                  ? <p className="font-mono text-[12px] text-faint">no prior versions.</p>
                  : history[cm.id].map((h, i) => (
                    <p key={i} className="whitespace-pre-wrap font-mono text-[12px] text-muted"><span className="text-faint">{formatDate(h.editedAt)} — </span>{h.body}</p>
                  ))}
              </div>
            )}
            {commentReactionsEnabled && (
              <div className="mt-2">
                <ReactionBar initialCounts={cm.reactions} initialMine={cm.myReactions} canReact={!!me} toggle={(e) => toggleCommentReaction(cm.id, e)} />
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Comments ({comments.length}){locked && <span className="ml-2 normal-case text-faint">· 🔒 locked</span>}</span>
        {isMod && (
          <span className="inline-flex items-center gap-1.5">
            <StaffTag label="mod" />
            <button onClick={() => (locked ? toggleLock() : setConfirmLock(true))} className="font-mono text-[12px] text-faint transition-colors hover:text-acid">{locked ? 'unlock comments' : 'lock comments'}</button>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {comments.length === 0 && <p className="font-mono text-[13px] text-faint">No comments yet.</p>}
        {roots.map((cm) => {
          const replies = repliesByParent.get(cm.id) ?? []
          return (
            <div key={cm.id} className="rounded-lg border border-line bg-surface/30 p-3">
              {renderComment(cm)}
              {(replies.length > 0 || replyTo === cm.id) && (
                <div className="mt-3 space-y-3 border-l border-line/70 pl-3">
                  {replies.map((r) => <div key={r.id}>{renderComment(r)}</div>)}
                  {replyTo === cm.id && (
                    <div>
                      <MentionTextarea
                        autoFocus value={replyBody} onChange={setReplyBody} rows={2} maxLength={4000}
                        placeholder="Reply… @handle mentions someone."
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
                      />
                      <div className="mt-1 flex items-center gap-3">
                        <button onClick={() => setReplyTo(null)} className="font-mono text-[12px] text-faint transition-colors hover:text-ink">cancel</button>
                        <button onClick={() => sendReply(cm.id)} disabled={replyBusy || !replyBody.trim()} className="btn-acid ml-auto px-3 py-1 text-[12px] disabled:opacity-50">{replyBusy ? '…' : 'reply'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {locked ? (
        <p className="mt-4 font-mono text-[13px] text-faint">🔒 Comments are locked on this crackme.</p>
      ) : me ? (
        <div className="mt-4">
          <MentionTextarea
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            rows={3}
            maxLength={4000}
            placeholder="Stay polite — don’t spoil the solution (or mark it as a spoiler). @handle mentions someone."
            value={body}
            onChange={setBody}
            onFocus={() => setCommenting(true)}
          />
          {turnstileSiteKey && commenting && <Turnstile key={tsKey} siteKey={turnstileSiteKey} onToken={setCaptcha} />}
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
              <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} /> mark as spoiler
            </label>
            <button onClick={send} disabled={busy || !body.trim() || (!!turnstileSiteKey && !captcha)} className="btn-acid ml-auto disabled:opacity-50">{busy ? '…' : 'comment'}</button>
          </div>
        </div>
      ) : (
        <p className="mt-4 font-mono text-[13px] text-muted">
          <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to comment.
        </p>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Delete comment"
          message="This replaces your comment with a deleted marker — you can't undo it."
          confirmText="delete"
          danger
          onConfirm={() => { del(confirmDel); setConfirmDel(null) }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {confirmHide && (
        <ConfirmDialog
          title="Hide comment"
          message="This removes the comment from the public thread (reversible). The author isn't notified."
          confirmText="hide"
          danger
          onConfirm={() => { hide(confirmHide); setConfirmHide(null) }}
          onCancel={() => setConfirmHide(null)}
        />
      )}

      {confirmLock && (
        <ConfirmDialog
          title="Lock comments"
          message="New comments will be blocked until you unlock. Existing comments stay visible."
          confirmText="lock"
          danger
          onConfirm={() => { toggleLock(); setConfirmLock(false) }}
          onCancel={() => setConfirmLock(false)}
        />
      )}
    </div>
  )
}

// Author-written, point-costed hints. Owners write/manage them (bodies always visible to the author);
// solvers see locked cards and pay a % of the solve to reveal — the biggest one unlocked is deducted at
// solve time. Free once you've solved it. Self-hides when there are no hints and you're not the owner.
function HintsPanel({ slug, me, canManage, solved }: { slug: string; me: Me | null; canManage: boolean; solved: boolean }) {
  const [hints, setHints] = useState<HintItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState<HintItem | null>(null)
  // owner editor
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [cost, setCost] = useState(25)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getHints(slug).then((h) => { setHints(h); setLoaded(true) }) }, [slug])

  const unlock = async (h: HintItem) => {
    setConfirmUnlock(null)
    const r = await unlockHint(slug, h.id)
    if (r) setHints((xs) => xs.map((x) => (x.id === h.id ? { ...x, unlocked: true, body: r.body } : x)))
  }
  const create = async () => {
    if (!draft.trim()) return
    setBusy(true)
    const h = await addHint(slug, draft.trim(), cost)
    setBusy(false)
    if (h) { setHints((xs) => [...xs, h]); setDraft(''); setAdding(false) }
  }
  const remove = async (id: string) => {
    if (await deleteHint(slug, id)) setHints((xs) => xs.filter((x) => x.id !== id))
  }

  if (!loaded) return null
  if (hints.length === 0 && !canManage) return null

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Hints ({hints.length}){!canManage && !solved && hints.length > 0 && <span className="ml-2 normal-case text-faint">· unlocking one costs points</span>}
        </span>
        {canManage && <button onClick={() => setAdding((o) => !o)} className="font-mono text-[12px] text-acid hover:underline">{adding ? 'cancel' : '+ add a hint'}</button>}
      </div>

      {hints.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">No hints{canManage ? ' yet — add one to help stuck solvers (they’ll pay points to reveal it).' : '.'}</p>
      ) : (
        <div className="space-y-2">
          {hints.map((h, i) => {
            const open = h.unlocked || h.body != null
            return (
              <div key={h.id} className={`rounded-lg border p-3 ${open ? 'border-line bg-surface/30' : 'border-dashed border-line bg-void/30'}`}>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-faint">
                  <span>Hint {i + 1} <span className="text-acid">· −{h.costPercent}%</span></span>
                  {canManage && <button onClick={() => remove(h.id)} className="transition-colors hover:text-red-400">delete</button>}
                </div>
                {open ? (
                  <p className="mt-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">{h.body}</p>
                ) : me ? (
                  <button onClick={() => setConfirmUnlock(h)} className="mt-1 font-mono text-[13px] text-acid hover:underline">
                    🔒 reveal — costs {h.costPercent}% of the points for this solve
                  </button>
                ) : (
                  <p className="mt-1 font-mono text-[13px] text-faint">
                    🔒 <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to unlock this hint.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canManage && adding && (
        <div className="mt-3 rounded-lg border border-dashed border-line bg-void/30 p-3">
          <textarea
            autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000}
            placeholder="a nudge — where to look, what to patch, which method decrypts the strings…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
              cost
              <select value={cost} onChange={(e) => setCost(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink outline-none focus:border-acid">
                {[10, 25, 50, 75].map((n) => <option key={n} value={n}>−{n}%</option>)}
              </select>
            </label>
            <button onClick={create} disabled={busy || !draft.trim()} className="btn-acid ml-auto px-3 py-1 text-[12px] disabled:opacity-50">{busy ? '…' : 'add hint'}</button>
          </div>
        </div>
      )}

      {confirmUnlock && (
        <ConfirmDialog
          title={`Reveal this hint?`}
          message={`It'll shave ${confirmUnlock.costPercent}% off the points you earn when you solve this crackme (only the biggest hint you unlock counts). Already-earned solves aren't affected.`}
          confirmText={`reveal (−${confirmUnlock.costPercent}%)`}
          onConfirm={() => unlock(confirmUnlock)}
          onCancel={() => setConfirmUnlock(null)}
        />
      )}
    </div>
  )
}

function WriteupsPanel({ slug, me, isOwner, zipPassword, turnstileSiteKey }: { slug: string; me: Me | null; isOwner: boolean; zipPassword: string; turnstileSiteKey: string | null }) {
  const [writeups, setWriteups] = useState<WriteupItem[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [wCaptcha, setWCaptcha] = useState<string | null>(null)
  const [wTsKey, setWTsKey] = useState(0)
  const [confirmDelW, setConfirmDelW] = useState<string | null>(null)
  const [confirmPin, setConfirmPin] = useState<string | null>(null)

  const load = () => getWriteups(slug).then(setWriteups)
  useEffect(() => { load() }, [slug])

  const addImages = (files: FileList | File[] | null) =>
    setImages((cur) => [...cur, ...Array.from(files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 10))
  const removeImage = (i: number) =>
    setImages((cur) => { URL.revokeObjectURL(cur[i].url); return cur.filter((_, j) => j !== i) })
  // Ctrl+V a screenshot anywhere in the form — attaches it like the file picker would.
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    e.preventDefault() // a pasted file would otherwise dump its name into the textarea
    addImages(imgs)
  }

  const send = async () => {
    if (!body.trim()) return
    setPhase('sending')
    const ok = await submitWriteup(slug, title, body.trim(), file, images.map((x) => x.file), wCaptcha)
    setPhase(ok ? 'done' : 'error')
    if (ok) {
      images.forEach((x) => URL.revokeObjectURL(x.url))
      setTitle(''); setBody(''); setFile(null); setImages([]); setOpen(false)
      setWCaptcha(null); setWTsKey((k) => k + 1)
    }
  }

  const patch = (id: string, p: Partial<WriteupItem>) =>
    setWriteups((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)))
  const upvote = async (w: WriteupItem) => {
    const r = await toggleWriteupUpvote(slug, w.id)
    if (r) patch(w.id, { upvoteCount: r.upvoteCount, myUpvoted: r.upvoted })
  }
  const markHelped = async (w: WriteupItem) => {
    const r = await toggleWriteupHelped(slug, w.id)
    if (r) patch(w.id, { helpedCount: r.helpedCount, myHelped: r.helped })
  }
  const pin = async (id: string) => {
    if (await pinWriteup(slug, id)) load() // pin reorders + clears the previous pick — re-fetch
  }

  const [wEditing, setWEditing] = useState<string | null>(null)
  const [wTitle, setWTitle] = useState('')
  const [wBody, setWBody] = useState('')
  const startWEdit = (w: WriteupItem) => { setWEditing(w.id); setWTitle(w.title ?? ''); setWBody(w.bodyMarkdown) }
  const saveWEdit = async (id: string) => {
    if (await editWriteup(slug, id, wTitle, wBody.trim())) {
      setWriteups((ws) => ws.map((w) => (w.id === id ? { ...w, title: wTitle.trim() || null, bodyMarkdown: wBody.trim() } : w)))
      setWEditing(null)
    }
  }
  const delW = async (id: string) => {
    if (await deleteWriteup(slug, id)) setWriteups((ws) => ws.filter((x) => x.id !== id))
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Writeups ({writeups.length})</span>
        {me && <button onClick={() => setOpen((o) => !o)} className="font-mono text-[12px] text-acid hover:underline">{open ? 'cancel' : '+ submit a writeup'}</button>}
      </div>

      {phase === 'done' && <p className="mb-3 font-mono text-[12px] text-acid">Writeup submitted — it’ll appear here once a moderator approves it.</p>}

      {open && me && (
        <div className="mb-4 rounded-lg border border-line bg-surface/30 p-4" onPaste={onPaste}>
          <p className="mb-2 font-mono text-[11px] text-faint">Explain how you solved it — Markdown welcome. Don’t just paste a key; show the process. Optional keygen/patched binary as attachment.</p>
          <input
            className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            placeholder="title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150}
          />
          <textarea
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
            rows={8} maxLength={40000} placeholder="# How I cracked it&#10;..." value={body} onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2">
            <span className="font-mono text-[11px] text-faint">screenshots (optional) — paste (Ctrl+V) or pick · PNG/JPG/WEBP/GIF · up to 10 · 50 MB total</span>
            <input type="file" accept="image/*" multiple onChange={(e) => { addImages(e.target.files); e.currentTarget.value = '' }} className="mt-1 block font-mono text-[12px] text-muted file:mr-2 file:rounded file:border-0 file:bg-line file:px-2 file:py-1 file:text-ink" />
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative h-16 w-24 overflow-hidden rounded border border-line">
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} aria-label="remove" className="absolute right-0.5 top-0.5 rounded bg-void/80 px-1 font-mono text-[11px] text-red-400 hover:text-red-300">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {turnstileSiteKey && <Turnstile key={wTsKey} siteKey={turnstileSiteKey} onToken={setWCaptcha} />}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="font-mono text-[12px] text-muted file:mr-2 file:rounded file:border-0 file:bg-line file:px-2 file:py-1 file:text-ink" />
            <button onClick={send} disabled={phase === 'sending' || !body.trim() || (!!turnstileSiteKey && !wCaptcha)} className="btn-acid ml-auto disabled:opacity-50">{phase === 'sending' ? '…' : 'submit for review'}</button>
          </div>
          {phase === 'error' && <p className="mt-2 font-mono text-xs text-red-400">Submission failed — try again.</p>}
        </div>
      )}

      <div className="space-y-3">
        {writeups.length === 0 && <p className="font-mono text-[13px] text-faint">No writeups yet — be the first.</p>}
        {writeups.map((w) => (
          <div key={w.id} id={`writeup-${w.id}`} className={`rounded-lg border bg-surface/30 p-4 ${w.isAuthorPick ? 'border-acid/50' : 'border-line'}`}>
            <div className="font-mono text-[11px] text-faint">
              {w.isAuthorPick && <span className="mr-2 rounded border border-acid/50 px-1.5 py-px text-[10px] uppercase tracking-wider text-acid">★ intended solution</span>}
              {w.title ?? 'Writeup'} · {w.author} · <PermalinkDate anchor={`writeup-${w.id}`}>{formatDate(w.createdAt)}</PermalinkDate>
            </div>
            {wEditing === w.id ? (
              <div className="mt-2">
                <input value={wTitle} onChange={(e) => setWTitle(e.target.value)} maxLength={150} placeholder="title (optional)"
                  className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid" />
                <textarea value={wBody} onChange={(e) => setWBody(e.target.value)} rows={8} maxLength={40000}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid" />
                <div className="mt-1 flex gap-3">
                  <button onClick={() => setWEditing(null)} className="rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted transition-colors hover:border-acid hover:text-acid">cancel</button>
                  <button onClick={() => saveWEdit(w.id)} disabled={!wBody.trim()} className="btn-acid ml-auto px-3 py-1 text-[12px] disabled:opacity-50">save</button>
                </div>
              </div>
            ) : revealed.has(w.id) ? (
              <>
                <p className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90"><MentionText text={w.bodyMarkdown} /></p>
                {w.imageCount > 0 && <ImageGallery urls={Array.from({ length: w.imageCount }, (_, i) => writeupImageUrl(slug, w.id, i))} />}
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

            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[12px]">
              <Tooltip label={w.mine ? 'your writeup' : !me ? 'sign in to upvote' : 'upvote'}>
                <button
                  onClick={() => upvote(w)}
                  disabled={!me || w.mine}
                  className={`rounded-full border px-2.5 py-1 transition-colors ${w.myUpvoted ? 'border-acid bg-acid/15 text-acid' : 'border-line text-muted'} ${me && !w.mine ? 'hover:border-acid hover:text-acid' : 'cursor-not-allowed opacity-60'}`}
                >
                  ▲ {w.upvoteCount}
                </button>
              </Tooltip>

              {w.canMarkHelped ? (
                <Tooltip label="You solved this — vouch that this writeup helped">
                  <button
                    onClick={() => markHelped(w)}
                    className={`rounded-full border px-2.5 py-1 transition-colors ${w.myHelped ? 'border-acid bg-acid/15 text-acid' : 'border-line text-muted hover:border-acid hover:text-acid'}`}
                  >
                    ✓ helped{w.helpedCount > 0 && ` · ${w.helpedCount}`}
                  </button>
                </Tooltip>
              ) : w.helpedCount > 0 && (
                <Tooltip label="solvers who said this helped"><span className="rounded-full border border-line px-2.5 py-1 text-faint">✓ {w.helpedCount} helped</span></Tooltip>
              )}

              {w.mine && wEditing !== w.id && <button onClick={() => startWEdit(w)} className="rounded-full border border-line px-2.5 py-1 text-muted transition-colors hover:border-acid hover:text-acid">edit</button>}
              {w.mine && <button onClick={() => setConfirmDelW(w.id)} className="rounded-full border border-line px-2.5 py-1 text-faint transition-colors hover:border-red-400 hover:text-red-400">delete</button>}
              {isOwner && (
                <button
                  onClick={() => (w.isAuthorPick ? pin(w.id) : setConfirmPin(w.id))}
                  className={`ml-auto rounded-full border px-2.5 py-1 transition-colors ${w.isAuthorPick ? 'border-acid text-acid' : 'border-line text-faint hover:border-acid hover:text-acid'}`}
                >
                  {w.isAuthorPick ? 'unpin' : 'pin as intended'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!me && <p className="mt-3 font-mono text-[13px] text-muted">
        <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to submit a writeup.
      </p>}

      {confirmDelW && (
        <ConfirmDialog
          title="Delete writeup"
          message="This permanently removes your writeup from the gallery."
          confirmText="delete"
          danger
          onConfirm={() => { delW(confirmDelW); setConfirmDelW(null) }}
          onCancel={() => setConfirmDelW(null)}
        />
      )}

      {confirmPin && (
        <ConfirmDialog
          title="Pin as intended solution"
          message="Marks this as the author's intended solution and floats it to the top (replaces any current pick)."
          confirmText="pin"
          onConfirm={() => { pin(confirmPin); setConfirmPin(null) }}
          onCancel={() => setConfirmPin(null)}
        />
      )}
    </div>
  )
}

// Honor-based "I solved this" toggle — gated to logged-in non-owners. Flashes the points earned.
function SolveButton({ slug, initialSolved, canSolve, onCount }: { slug: string; initialSolved: boolean; canSolve: boolean; onCount: (n: number) => void }) {
  const [solved, setSolved] = useState(initialSolved)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  if (!canSolve) return null

  const toggle = async () => {
    setBusy(true)
    const r = solved ? await unmarkSolved(slug) : await markSolved(slug)
    setBusy(false)
    if (!r) return
    setSolved(r.solved)
    onCount(r.solvedCount)
    setFlash(r.solved && r.pointsAwarded > 0 ? (r.firstBlood ? `🩸 first blood · +${r.pointsAwarded}` : `+${r.pointsAwarded} pts`) : null)
  }

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-full border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50 ${solved ? 'border-acid bg-acid/15 text-acid' : 'border-line text-muted hover:border-acid hover:text-acid'}`}
      >
        {solved ? '✓ solved' : 'mark as solved'}
      </button>
      {flash && <span className="font-mono text-[13px] text-acid">{flash}</span>}
    </div>
  )
}

// Verified solve: the solver submits the answer (serial / keygen output / flag) and the server checks it.
// A wrong answer says so inline; a correct one flips to "solved" and flashes the points, like SolveButton.
function FlagSubmit({ slug, initialSolved, me, isOwner, onCount }: {
  slug: string; initialSolved: boolean; me: Me | null; isOwner: boolean; onCount: (n: number) => void
}) {
  const [solved, setSolved] = useState(initialSolved)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  if (solved) return (
    <div className="mt-6 flex items-center gap-3">
      <span className="rounded-full border border-acid bg-acid/15 px-4 py-2 font-mono text-sm text-acid">✓ solved — answer verified</span>
      {flash && <span className="font-mono text-[13px] text-acid">{flash}</span>}
    </div>
  )
  if (isOwner) return null
  if (!me) return (
    <p className="mt-6 font-mono text-[13px] text-muted">
      <Link to={`/login?returnUrl=/challenge/${slug}`} className="text-acid hover:underline">Sign in</Link> to submit your answer.
    </p>
  )

  const submit = async () => {
    if (!answer.trim()) return
    setBusy(true)
    const r = await submitFlag(slug, answer.trim())
    setBusy(false)
    if (!r) return
    if (r.correct) {
      setSolved(true)
      onCount(r.solvedCount)
      setFlash(r.firstBlood ? `🩸 first blood · +${r.pointsAwarded}` : r.pointsAwarded > 0 ? `+${r.pointsAwarded} pts` : 'solved!')
    } else {
      setWrong(true)
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Prove it — submit the answer</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); setWrong(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="serial / key / flag"
          className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
        />
        <button onClick={submit} disabled={busy || !answer.trim()} className="btn-acid disabled:opacity-50">{busy ? '…' : 'submit'}</button>
        {wrong && <span className="font-mono text-[13px] text-red-400">nope — try again</span>}
      </div>
    </div>
  )
}

// Owner-only: choose how solves are verified and set the secret answer. The answer is hashed server-side
// and never returned, so the field starts empty — blank + unchanged kind keeps the current one.
function VerificationSettings({ slug, current, onChange }: { slug: string; current: string; onChange: (kind: string) => void }) {
  const [kind, setKind] = useState(current)
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const needsAnswer = kind !== 'none'
  const isRegex = kind === 'regex'
  const mustProvideAnswer = needsAnswer && (kind !== current || current === 'none')

  const save = async () => {
    setPhase('saving'); setError(null)
    const res = await setVerification(slug, kind, needsAnswer ? answer.trim() : null)
    if (res.ok) { setPhase('saved'); setAnswer(''); onChange(kind) }
    else { setPhase('error'); setError(res.error) }
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-line bg-void/30 p-4">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Solve verification</div>
      <p className="mb-3 font-mono text-[12px] leading-relaxed text-muted">
        Make solvers submit the right answer — a serial, keygen output, or flag — instead of the honor button.
        It’s hashed on the server, never stored in plain text or shown again.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value); setPhase('idle') }}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-acid"
        >
          {VERIFICATION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        {needsAnswer && (
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isRegex ? 'regex, e.g. ^BITMONO-\\d{4}$' : current !== 'none' ? 'new answer (blank keeps current)' : 'the correct answer'}
            className="min-w-[15rem] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-acid"
          />
        )}
        <button
          onClick={save}
          disabled={phase === 'saving' || (mustProvideAnswer && !answer.trim())}
          className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-acid hover:text-acid disabled:opacity-50"
        >
          {phase === 'saving' ? '…' : 'save'}
        </button>
      </div>
      {phase === 'saved' && <p className="mt-2 font-mono text-[12px] text-acid">Saved.</p>}
      {phase === 'error' && <p className="mt-2 font-mono text-[12px] text-red-400">{error ?? 'Save failed.'}</p>}
      {current !== 'none' && <p className="mt-2 font-mono text-[11px] text-faint">An answer is set. Leave the field blank to keep it, or type a new one to replace it.</p>}
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
