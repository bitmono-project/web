import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type CrackmeDetail as Detail, type CommentItem, type MyRating,
  getCrackme, getComments, postComment, getMyRating, rateCrackme,
  platformLabel, languageLabel, difficultyNumber, formatSize, formatDate,
} from '../lib/crackmes'
import { type Me, useAuth } from '../lib/auth'

export default function CrackmeDetail() {
  const { slug = '' } = useParams()
  const { me } = useAuth()
  const [c, setC] = useState<Detail | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')

  useEffect(() => {
    let live = true
    setState('loading')
    getCrackme(slug)
      .then((r) => { if (live) { setC(r); setState(r ? 'ok' : 'missing') } })
      .catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [slug])

  if (state === 'loading') return <Center>loading<span className="caret">_</span></Center>
  if (state === 'error') return <Center>couldn’t load this crackme.</Center>
  if (state === 'missing' || !c) return (
    <Center>
      not found. <Link to="/crackmes" className="text-acid hover:underline">back to the gallery</Link>
    </Center>
  )

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
          <p className="mt-2 font-mono text-[11px] text-faint">zip password: <span className="text-muted">bitmono.dev</span></p>
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

      {c.description && (
        <div className="mt-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Description</div>
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink/90">{c.description}</p>
        </div>
      )}

      <p className="mt-10 rounded-lg border border-line bg-surface/30 p-4 font-mono text-[12px] leading-relaxed text-muted">
        ⚠ Run crackmes only inside a VM. Obfuscated binaries often trip antivirus by design — that’s expected, not malware.
      </p>

      <RatingsPanel slug={c.slug} me={me} initial={c} />
      <CommentsPanel slug={c.slug} me={me} />
    </main>
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

function CommentsPanel({ slug, me }: { slug: string; me: Me | null }) {
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

      <p className="mt-8 font-mono text-xs text-faint">Writeups — coming soon.</p>
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
