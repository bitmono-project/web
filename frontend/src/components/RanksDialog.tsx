// The rank ladder — mirrors the server's Ranks.cs (static, single small table). Shown in a modal
// when you click your rank, with your current tier highlighted.
const RANKS = [
  { name: 'script kiddie', minPoints: 0 },
  { name: 'unpacker', minPoints: 250 },
  { name: 'patcher', minPoints: 750 },
  { name: 'disassembler', minPoints: 2_000 },
  { name: 'deobfuscator', minPoints: 5_000 },
  { name: 'devirtualizer', minPoints: 12_000 },
  { name: 'ghost in the IL', minPoints: 25_000 },
  { name: 'nop-sled legend', minPoints: 50_000 },
]

export function RanksDialog({ points, onClose }: { points: number; onClose: () => void }) {
  let currentIdx = 0
  RANKS.forEach((r, i) => { if (points >= r.minPoints) currentIdx = i })

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
              <li key={r.name} className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[13px] ${here ? 'border-acid/50 bg-acid/10' : 'border-transparent'}`}>
                <span className={here ? 'text-acid' : 'text-muted'}>{r.name}</span>
                {here && <span className="rounded-full border border-acid/50 px-2 py-px text-[10px] uppercase tracking-wider text-acid">you're here</span>}
                <span className="ml-auto text-faint">{r.minPoints.toLocaleString()}+</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
