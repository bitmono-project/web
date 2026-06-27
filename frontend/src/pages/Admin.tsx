import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAdmin, useAuth } from '../lib/auth'
import {
  type ModerationStats, type AdminCrackmeRow,
  getModerationStats, getAdminCrackmes, takedownCrackme, restoreCrackme,
  statusLabel, statusBadgeClass, formatDate,
} from '../lib/crackmes'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'TakenDown', label: 'Taken down' },
]

export default function Admin() {
  const { me, loading } = useAuth()
  const [stats, setStats] = useState<ModerationStats | null>(null)

  useEffect(() => {
    if (loading || !isAdmin(me)) return
    getModerationStats().then(setStats)
  }, [loading, me])

  if (loading) return null
  if (!isAdmin(me)) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      Admins only. <Link to="/" className="text-acid hover:underline">home</Link>
    </main>
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Admin</h1>
      <p className="mt-2 font-mono text-sm text-muted">Analytics, the review queue, and crackme takedowns.</p>

      {!stats ? (
        <p className="mt-10 font-mono text-sm text-muted">loading<span className="caret">_</span></p>
      ) : (
        <>
          <StatCards stats={stats} />
          <QueueCta stats={stats} />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <SubmissionsChart byDay={stats.submissionsByDay} />
            <TopDownloaded items={stats.topDownloaded} />
          </div>
          <CrackmeManager />
        </>
      )}
    </main>
  )
}

function StatCards({ stats }: { stats: ModerationStats }) {
  const cards = [
    { label: 'Total crackmes', value: stats.totalCrackmes, accent: false },
    { label: 'Pending', value: stats.pendingCrackmes, accent: stats.pendingCrackmes > 0 },
    { label: 'Approved', value: stats.approvedCrackmes, accent: false },
    { label: 'Rejected', value: stats.rejectedCrackmes, accent: false },
    { label: 'Taken down', value: stats.takenDownCrackmes, accent: false },
    { label: 'Users', value: stats.users, accent: false },
    { label: 'Downloads', value: stats.totalDownloads, accent: false },
    { label: 'Open reports', value: stats.openReports, accent: stats.openReports > 0 },
  ]
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-line bg-surface/30 p-4">
          <div className={`font-display text-3xl font-bold ${c.accent ? 'text-acid' : 'text-ink'}`}>{c.value.toLocaleString()}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-faint">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function QueueCta({ stats }: { stats: ModerationStats }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface/30 p-5">
      <div className="font-mono text-[13px] text-muted">
        <span className="text-ink">{stats.pendingCrackmes}</span> crackmes · <span className="text-ink">{stats.pendingWriteups}</span> writeups ·{' '}
        <span className="text-ink">{stats.openReports}</span> reports awaiting review
      </div>
      <Link to="/moderation" className="btn-acid ml-auto">open review queue →</Link>
    </div>
  )
}

function SubmissionsChart({ byDay }: { byDay: ModerationStats['submissionsByDay'] }) {
  const days = last14Days(byDay)
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="rounded-xl border border-line bg-surface/30 p-5">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-faint">Submissions · last 14 days</div>
      <div className="flex h-28 items-end gap-1">
        {days.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.count}`}>
            <div
              className="w-full rounded-t bg-acid/70 transition-colors hover:bg-acid"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '3px' : '0' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  )
}

function TopDownloaded({ items }: { items: ModerationStats['topDownloaded'] }) {
  return (
    <div className="rounded-xl border border-line bg-surface/30 p-5">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-faint">Top downloaded</div>
      {items.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">No data yet.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((c, i) => (
            <li key={c.slug} className="flex items-center gap-3 font-mono text-[13px]">
              <span className="w-4 text-faint">{i + 1}</span>
              <Link to={`/challenge/${c.slug}`} className="truncate text-ink transition-colors hover:text-acid">{c.title}</Link>
              <span className={statusBadgeClass(c.status)}>{statusLabel(c.status)}</span>
              <span className="ml-auto text-muted">{c.downloadCount.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function CrackmeManager() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<AdminCrackmeRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => { getAdminCrackmes(q, status).then(setRows) }, [q, status])
  useEffect(() => {
    const t = setTimeout(load, 250) // debounce search typing
    return () => clearTimeout(t)
  }, [load])

  const takedown = async (row: AdminCrackmeRow) => {
    const reason = window.prompt(`Takedown reason for “${row.title}” (shown publicly):`) ?? ''
    if (!reason.trim()) return
    setBusy(row.id)
    const ok = await takedownCrackme(row.id, reason.trim())
    setBusy(null)
    if (ok) load()
  }
  const restore = async (row: AdminCrackmeRow) => {
    setBusy(row.id)
    const ok = await restoreCrackme(row.id)
    setBusy(null)
    if (ok) load()
  }

  return (
    <div className="mt-12">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">Crackmes</h2>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="search title or slug…"
          className="ml-auto w-48 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-acid"
        />
        <select
          value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-acid"
        >
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <p className="font-mono text-[13px] text-faint">No crackmes match.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/30 p-3">
            <Link to={`/challenge/${r.slug}`} className="font-mono text-[13px] text-ink transition-colors hover:text-acid">{r.title}</Link>
            <span className="font-mono text-[11px] text-faint">{r.author}</span>
            <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
            <span className="font-mono text-[11px] text-faint">{r.downloadCount.toLocaleString()} dl · {formatDate(r.createdAt)}</span>
            {r.isTakenDown ? (
              <button onClick={() => restore(r)} disabled={busy === r.id} className="ml-auto rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted transition-colors hover:border-acid hover:text-acid disabled:opacity-50">restore</button>
            ) : (
              <button onClick={() => takedown(r)} disabled={busy === r.id} className="ml-auto rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50">take down</button>
            )}
            {r.isTakenDown && r.takedownReason && <p className="w-full font-mono text-[11px] text-orange-400/80">reason: {r.takedownReason}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Fill a 14-day window so the chart has a bar per day even when nothing was submitted.
function last14Days(byDay: ModerationStats['submissionsByDay']): { label: string; count: number }[] {
  const map = new Map(byDay.map((p) => [p.day.slice(0, 10), p.count]))
  const out: { label: string; count: number }[] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ label: key.slice(5), count: map.get(key) ?? 0 })
  }
  return out
}
