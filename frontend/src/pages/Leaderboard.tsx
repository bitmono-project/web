import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { type LeaderboardEntry, type MyRank, getLeaderboard, getMyRank } from '../lib/crackmes'

const SCOPES = [
  { value: '', label: 'Overall' },
  { value: 'dotnet', label: '.NET' },
  { value: 'monthly', label: 'This month' },
]

const medal = (rank: number): string => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`)

export default function Leaderboard() {
  const { me } = useAuth()
  const [scope, setScope] = useState('')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState<MyRank | null>(null)

  useEffect(() => {
    setLoading(true)
    getLeaderboard(scope).then((r) => { setItems(r.items); setLoading(false) })
  }, [scope])

  useEffect(() => {
    if (me) getMyRank().then(setMine)
  }, [me])

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Leaderboard</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        Points scale with difficulty and decay as a crackme gets over-solved. First blood pays double.
      </p>

      {me && mine && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-acid/30 bg-acid/5 p-4 font-mono text-[13px]">
          <span className="text-acid">{mine.rankName}</span>
          <span className="text-muted">{mine.points.toLocaleString()} pts</span>
          <span className="text-faint">{mine.solves} solved</span>
          {mine.position && <span className="text-faint">· #{mine.position}</span>}
          {mine.nextRankName && mine.pointsToNext != null && (
            <span className="ml-auto text-faint">{mine.pointsToNext.toLocaleString()} pts → {mine.nextRankName}</span>
          )}
        </div>
      )}

      <div className="mb-3 mt-6 flex flex-wrap gap-2 font-mono text-xs">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className={`rounded-full border px-3 py-1 transition-colors ${scope === s.value ? 'border-acid text-acid' : 'border-line text-muted hover:text-ink'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 font-mono text-sm text-muted">loading<span className="caret">_</span></p>
      ) : items.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          No solves yet — be the first to <Link to="/crackmes" className="text-acid hover:underline">crack something</Link>.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full font-mono text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface/40 text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-normal">#</th>
                <th className="px-4 py-2 font-normal">Hacker</th>
                <th className="px-4 py-2 font-normal">Rank</th>
                <th className="px-4 py-2 text-right font-normal">Solved</th>
                <th className="px-4 py-2 text-right font-normal">Points</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.userId} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-faint">{medal(e.rank)}</td>
                  <td className="px-4 py-2 text-ink">
                    {e.handle ? (
                      <Link to={`/user/${e.handle}`} className="flex items-center gap-2 transition-colors hover:text-acid">
                        {e.avatar && <img src={e.avatar} alt="" className="h-5 w-5 rounded-full" />}
                        {e.displayName}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2">
                        {e.avatar && <img src={e.avatar} alt="" className="h-5 w-5 rounded-full" />}
                        {e.displayName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{e.rankName}</td>
                  <td className="px-4 py-2 text-right text-faint">{e.solves}</td>
                  <td className="px-4 py-2 text-right text-acid">{e.points.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
