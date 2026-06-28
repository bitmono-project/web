import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type UserProfile, type ProfileCrackme, getUserProfile, getUserCrackmes, difficultyLabel, formatDate } from '../lib/crackmes'
import { RanksDialog } from '../components/RanksDialog'
import { useTitle } from '../lib/useTitle'

export default function Profile() {
  const { handle = '' } = useParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [crackmes, setCrackmes] = useState<ProfileCrackme[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading')
  const [ranksOpen, setRanksOpen] = useState(false)

  useEffect(() => {
    let live = true
    setState('loading')
    getUserProfile(handle).then((p) => {
      if (!live) return
      setProfile(p)
      setState(p ? 'ok' : 'missing')
    })
    getUserCrackmes(handle).then((c) => { if (live) setCrackmes(c) })
    return () => { live = false }
  }, [handle])

  useTitle(profile ? `${profile.displayName} (@${profile.handle}) — BitMono` : 'Profile — BitMono')

  if (state === 'loading') return <main className="mx-auto max-w-3xl px-6 py-24 text-center font-mono text-sm text-muted">loading<span className="caret">_</span></main>
  if (state === 'missing' || !profile) return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center font-mono text-sm text-muted">
      no such user. <Link to="/leaderboard" className="text-acid hover:underline">leaderboard</Link>
    </main>
  )

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-4">
        {profile.avatar
          ? <img src={profile.avatar} alt="" className="h-16 w-16 rounded-full border border-line" />
          : <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface font-display text-2xl text-acid">{profile.displayName.slice(0, 1).toUpperCase()}</div>}
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">{profile.displayName}</h1>
          <p className="mt-1 font-mono text-[12px] text-faint">
            @{profile.handle}
            {profile.role !== 'User' && <span className="ml-2 rounded border border-acid/40 px-1.5 py-px text-[10px] uppercase text-acid">{profile.role}</span>}
            <span className="ml-2">· joined {formatDate(profile.joinedAt)}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="Points" value={profile.points.toLocaleString()} />
        <button
          onClick={() => setRanksOpen(true)}
          className="rounded-xl border border-line bg-surface/30 p-4 text-center transition-colors hover:border-acid/40"
        >
          <div className="truncate font-display text-base font-bold text-acid" title={profile.rankName}>{profile.rankName}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">Rank ↗</div>
        </button>
        <StatCard label="Solved" value={String(profile.solves)} />
        <StatCard label="Authored" value={String(profile.authored)} />
        <StatCard label="Writeups" value={String(profile.writeups)} />
        <StatCard label="Position" value={profile.position ? `#${profile.position}` : '—'} />
      </div>

      {ranksOpen && <RanksDialog points={profile.points} onClose={() => setRanksOpen(false)} />}

      {profile.badges.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {profile.badges.map((b) => (
            <span key={b.code} title={b.description} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12px] ${badgeClass(b.rarity)}`}>
              <span aria-hidden>●</span> {b.name}
            </span>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-12 font-display text-2xl font-bold text-ink">Authored crackmes</h2>
      {crackmes.length === 0 ? (
        <p className="font-mono text-[13px] text-faint">None yet.</p>
      ) : (
        <div className="space-y-2">
          {crackmes.map((c) => (
            <Link key={c.slug} to={`/challenge/${c.slug}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/30 p-3 transition-colors hover:border-acid/40">
              <span className="font-mono text-[13px] text-ink">{c.title}</span>
              <span className="font-mono text-[11px] text-faint">{difficultyLabel(c.difficulty)}</span>
              <span className="ml-auto font-mono text-[11px] text-faint">{c.solvedCount} solved · {c.downloadCount.toLocaleString()} dl · {formatDate(c.publishedAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

function badgeClass(rarity: string): string {
  switch (rarity) {
    case 'rare': return 'border-acid/50 text-acid'
    case 'epic': return 'border-violet-400/50 text-violet-300'
    case 'legendary': return 'border-amber-400/50 text-amber-300'
    default: return 'border-line text-muted'
  }
}

// Defensive truncate + title so an unexpectedly long value never blows out the fixed-width card.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/30 p-4 text-center">
      <div className="truncate font-display text-2xl font-bold text-ink" title={value}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">{label}</div>
    </div>
  )
}
