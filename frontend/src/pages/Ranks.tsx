import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RANKS, rankIndexForPoints, rankRange } from '../lib/ranks'
import { useAuth } from '../lib/auth'
import { getMyRank, type MyRank } from '../lib/crackmes'
import { useTitle } from '../lib/useTitle'

export default function Ranks() {
  useTitle('Ranks — BitMono')
  const { me } = useAuth()
  const { hash } = useLocation()
  const [mine, setMine] = useState<MyRank | null>(null)

  useEffect(() => { if (me) getMyRank().then(setMine) }, [me])

  // Deep-link support: the ranks modal links here as /ranks#<slug>.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [hash])

  const currentIdx = mine ? rankIndexForPoints(mine.points) : -1

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Ranks</h1>
      <p className="mt-3 max-w-xl font-mono text-[13px] leading-relaxed text-muted">
        Eight tiers stand between a fresh account and the crown. You climb by solving crackmes — harder
        challenges and first-blood solves pay the most. Here’s the whole road.
      </p>

      <div className="mt-10 space-y-4">
        {RANKS.map((r, i) => {
          const here = i === currentIdx
          return (
            <section
              key={r.slug}
              id={r.slug}
              className="scroll-mt-24 flex flex-col gap-5 rounded-2xl border p-6 sm:flex-row sm:items-center"
              style={{
                borderColor: here ? `${r.color}80` : `${r.color}26`,
                background: `linear-gradient(100deg, ${r.color}0f, transparent 55%)`,
              }}
            >
              <img
                src={`/rank-${r.slug}.png`}
                alt={`${r.name} badge`}
                className="h-28 w-28 shrink-0 self-center sm:self-start"
                style={{ filter: `drop-shadow(0 0 22px ${r.color}55)` }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="font-display text-2xl font-bold" style={{ color: r.color }}>{r.name}</h2>
                  {here && (
                    <span className="rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-wider" style={{ color: r.color, borderColor: `${r.color}80` }}>
                      you’re here
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{r.tag}</p>
                <p className="mt-1 font-mono text-[12px] text-muted">{rankRange(i)} pts</p>
                <p className="mt-3 font-mono text-[13px] leading-relaxed text-muted">{r.story}</p>
                {here && mine?.nextRankName && mine.pointsToNext != null && (
                  <p className="mt-3 font-mono text-[12px]" style={{ color: r.color }}>
                    {mine.pointsToNext.toLocaleString()} pts → {mine.nextRankName}
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-10 font-mono text-[12px] text-faint">
        Points scale with difficulty and decay as a crackme gets over-solved. Track yours on the{' '}
        <Link to="/leaderboard" className="text-acid hover:underline">leaderboard</Link>.
      </p>
    </main>
  )
}
