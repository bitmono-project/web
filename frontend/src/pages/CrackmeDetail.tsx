import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type CrackmeDetail as Detail, getCrackme,
  platformLabel, languageLabel, difficultyNumber, formatSize, formatDate,
} from '../lib/crackmes'

export default function CrackmeDetail() {
  const { slug = '' } = useParams()
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

      <p className="mt-6 font-mono text-xs text-faint">Comments &amp; writeups — coming soon.</p>
    </main>
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
