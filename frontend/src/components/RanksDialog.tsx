import { Link } from 'react-router-dom'
import { RANKS, rankIndexForPoints } from '../lib/ranks'

// Shown in a modal when a rank is clicked, with the relevant tier highlighted. `self` is true when
// the highlighted rank is the viewer's own (leaderboard "my rank" or your own profile) — otherwise
// it's the profile owner's rank, so we don't claim "you're here".
export function RanksDialog({ points, self = true, onClose }: { points: number; self?: boolean; onClose: () => void }) {
  const currentIdx = rankIndexForPoints(points)

  return (
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-void/80 p-6 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Ranks</h2>
          <button onClick={onClose} className="font-mono text-sm text-faint transition-colors hover:text-ink">✕</button>
        </div>
        <p className="mb-4 font-mono text-[11px] text-faint">Earn points by solving crackmes — harder ones, and first blood, pay more.</p>
        <ol className="space-y-1">
          {RANKS.map((r, i) => {
            const here = i === currentIdx
            return (
              <li
                key={r.slug}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 font-mono text-[13px]"
                style={{ borderColor: here ? `${r.color}66` : 'transparent', background: here ? `${r.color}14` : 'transparent' }}
              >
                <img src={`/rank-${r.slug}.png`} alt="" className="h-10 w-10 shrink-0" />
                <Link
                  to={`/ranks#${r.slug}`}
                  onClick={onClose}
                  className={`hover:underline ${here ? '' : 'text-muted'}`}
                  style={here ? { color: r.color } : undefined}
                >
                  {r.name}
                </Link>
                {here && (
                  <span className="rounded-full border px-2 py-px text-[10px] uppercase tracking-wider" style={{ color: r.color, borderColor: `${r.color}80` }}>
                    {self ? "you're here" : 'current rank'}
                  </span>
                )}
                <span className="ml-auto text-faint">{r.minPoints.toLocaleString()}+</span>
              </li>
            )
          })}
        </ol>
        <Link to="/ranks" onClick={onClose} className="mt-4 block text-center font-mono text-[12px] text-acid hover:underline">
          See all ranks →
        </Link>
      </div>
    </div>
  )
}
