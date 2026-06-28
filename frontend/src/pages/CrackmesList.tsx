import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type CrackmeFilters, type CrackmeListItem, listCrackmes,
  PLATFORMS, platformLabel, difficultyNumber, formatSize, formatDate,
} from '../lib/crackmes'
import { useTitle } from '../lib/useTitle'

const SORTS = [
  { value: 'date', label: 'Newest' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'difficulty', label: 'Hardest' },
]

const input = 'rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid'

export default function CrackmesList() {
  const [filters, setFilters] = useState<CrackmeFilters>({ sort: 'date' })
  const [items, setItems] = useState<CrackmeListItem[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  // ponytail: refetch on every filter change — dataset is small. Add debounce when it grows.
  useEffect(() => {
    let live = true
    setState('loading')
    listCrackmes(filters)
      .then((r) => { if (live) { setItems(r.items); setTotal(r.total); setState('ok') } })
      .catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [filters])

  const set = (patch: Partial<CrackmeFilters>) => setFilters((f) => ({ ...f, ...patch }))

  useTitle('Crackmes — .NET reverse-engineering challenges — BitMono')

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Crackmes</h1>
          <p className="mt-2 font-mono text-sm text-muted">
            BitMono-obfuscated .NET challenges. Reverse them, write it up. {total > 0 && <span className="text-faint">· {total} total</span>}
          </p>
        </div>
        <Link to="/upload" className="btn-acid">submit a crackme →</Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <input
          className={`${input} min-w-[200px] flex-1`}
          placeholder="search by name…"
          value={filters.q ?? ''}
          onChange={(e) => set({ q: e.target.value })}
        />
        <select className={input} value={filters.platform ?? ''} onChange={(e) => set({ platform: e.target.value || undefined })}>
          <option value="">all runtimes</option>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className={input} value={filters.minDifficulty ?? ''} onChange={(e) => set({ minDifficulty: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">min diff</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>≥ {n}</option>)}
        </select>
        <select className={input} value={filters.maxDifficulty ?? ''} onChange={(e) => set({ maxDifficulty: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">max diff</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>≤ {n}</option>)}
        </select>
        <select className={input} value={filters.sort ?? 'date'} onChange={(e) => set({ sort: e.target.value })}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-muted">
          <input type="checkbox" checked={!!filters.bitMonoOnly} onChange={(e) => set({ bitMonoOnly: e.target.checked || undefined })} /> BitMono only
        </label>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] border-collapse font-mono text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-faint">
              <Th>Name</Th><Th>Author</Th><Th>Runtime</Th><Th>Diff</Th><Th>Quality</Th>
              <Th>Protections</Th><Th>Size</Th><Th>↓</Th><Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {state === 'ok' && items.map((c) => <Row key={c.slug} c={c} />)}
          </tbody>
        </table>
        {state === 'loading' && <Note>loading<span className="caret">_</span></Note>}
        {state === 'error' && <Note>couldn’t load crackmes — is the API up?</Note>}
        {state === 'ok' && items.length === 0 && <Note>no crackmes match those filters.</Note>}
      </div>
    </main>
  )
}

function Row({ c }: { c: CrackmeListItem }) {
  // ponytail: stretched-link — the title's ::after covers the whole <tr>, so a click anywhere on the
  // row opens the crackme while real links (author) stay clickable via z-10. CSS only; cmd/middle-click works.
  return (
    <tr className="relative cursor-pointer border-b border-line/60 transition-colors hover:bg-surface/50">
      <Td>
        <Link to={`/challenge/${c.slug}`} className="text-ink transition-colors after:absolute after:inset-0 hover:text-acid">{c.title}</Link>
      </Td>
      <Td className="text-muted">
        {c.authorHandle
          ? <Link to={`/user/${c.authorHandle}`} className="relative z-10 transition-colors hover:text-acid">{c.author}</Link>
          : c.author}
      </Td>
      <Td className="text-muted">{c.runtime ?? platformLabel(c.platform)}</Td>
      <Td className="text-acid">{(c.avgDifficulty ?? difficultyNumber(c.authorDifficulty)).toFixed(1)}</Td>
      <Td className="text-muted">{c.avgQuality != null ? c.avgQuality.toFixed(1) : '—'}</Td>
      <Td><Protections names={c.protections} /></Td>
      <Td className="text-faint">{formatSize(c.sizeBytes)}</Td>
      <Td className="text-faint">{c.downloadCount}</Td>
      <Td className="text-faint">{formatDate(c.publishedAt)}</Td>
    </tr>
  )
}

function Protections({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-faint">—</span>
  const shown = names.slice(0, 3)
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((n) => (
        <span key={n} className="rounded border border-line bg-void/60 px-1.5 py-px text-[11px] text-muted">{n}</span>
      ))}
      {names.length > shown.length && <span className="px-1 py-px text-[11px] text-faint">+{names.length - shown.length}</span>}
    </span>
  )
}

const Th = ({ children }: { children: ReactNode }) => <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-[11px]">{children}</th>
const Td = ({ children, className = '' }: { children: ReactNode; className?: string }) => <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
const Note = ({ children }: { children: ReactNode }) => <p className="px-4 py-10 text-center font-mono text-sm text-muted">{children}</p>
