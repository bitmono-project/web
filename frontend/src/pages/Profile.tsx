import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type UserProfile, type ProfileCrackme, getUserProfile, getUserCrackmes,
  updateMyBio, reportProfile, toggleBioHide, REPORT_REASONS,
  difficultyLabel, formatDate,
} from '../lib/crackmes'
import { RanksDialog } from '../components/RanksDialog'
import { rankByName } from '../lib/ranks'
import { isModerator, useAuth, type Me } from '../lib/auth'
import { Tooltip } from '../components/Tooltip'
import { MentionText } from '../components/MentionText'
import { MentionTextarea } from '../components/MentionTextarea'
import { PromptDialog } from '../components/PromptDialog'
import { StaffTag } from '../components/StaffTag'
import { useTitle } from '../lib/useTitle'

export default function Profile() {
  const { handle = '' } = useParams()
  const { me } = useAuth()
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

  const rank = rankByName(profile.rankName)
  const isOwn = me?.handle === profile.handle

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

      <BioSection
        profile={profile}
        me={me}
        isOwn={isOwn}
        onPatch={(p) => setProfile({ ...profile, ...p })}
      />

      <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="Points" value={profile.points.toLocaleString()} />
        <Tooltip label={profile.rankName} className="w-full">
          <button
            onClick={() => setRanksOpen(true)}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-line bg-surface/30 p-4 text-center transition-colors hover:border-acid/40"
          >
            {rank
              ? <img src={`/rank-${rank.slug}.png`} alt={profile.rankName} className="h-11 w-11" style={{ filter: `drop-shadow(0 0 10px ${rank.color}55)` }} />
              : <div className="truncate font-display text-base font-bold text-acid">{profile.rankName}</div>}
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">Rank ↗</div>
          </button>
        </Tooltip>
        <StatCard label="Solved" value={String(profile.solves)} />
        <StatCard label="Authored" value={String(profile.authored)} />
        <StatCard label="Writeups" value={String(profile.writeups)} />
        <StatCard label="Position" value={profile.position ? `#${profile.position}` : '—'} />
      </div>

      {ranksOpen && <RanksDialog points={profile.points} self={isOwn} onClose={() => setRanksOpen(false)} />}

      {profile.badges.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {profile.badges.map((b) => (
            <Tooltip key={b.code} label={b.description}>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12px] ${badgeClass(b.rarity)}`}>
                <span aria-hidden>●</span> {b.name}
              </span>
            </Tooltip>
          ))}
        </div>
      )}

      {profile.authored > 0 && (
        <div className="mt-10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-faint">As an author</div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Solves earned" value={profile.authoredSolves.toLocaleString()} />
            <StatCard label="Downloads" value={profile.authoredDownloads.toLocaleString()} />
            <StatCard label="Median time to crack" value={formatCrackTime(profile.medianFirstSolveHours)} />
          </div>
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

      {!isOwn && <ReportProfileControl handle={profile.handle} />}
    </main>
  )
}

// Bio: everyone reads it, the owner edits it, moderators can soft-hide it (owner keeps seeing it,
// dimmed, with the reason — editing publishes a fixed version).
function BioSection({ profile, me, isOwn, onPatch }: {
  profile: UserProfile
  me: Me | null
  isOwn: boolean
  onPatch: (p: Partial<UserProfile>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [hidePrompt, setHidePrompt] = useState(false)
  const staff = isModerator(me)

  if (!profile.bio && !isOwn) return null

  const startEdit = () => { setDraft(profile.bio ?? ''); setEditing(true) }
  const save = async () => {
    setBusy(true)
    const ok = await updateMyBio(draft.trim())
    setBusy(false)
    if (ok) {
      onPatch({ bio: draft.trim() || null, bioHidden: false, bioHiddenReason: null })
      setEditing(false)
    }
  }
  const toggleHide = async (reason: string | null) => {
    setHidePrompt(false)
    const hidden = await toggleBioHide(profile.id, reason)
    if (hidden !== null) onPatch({ bioHidden: hidden, bioHiddenReason: hidden ? reason : null })
  }

  return (
    <div className="mt-5">
      {profile.bioHidden && (
        <p className="mb-2 rounded-lg border border-orange-400/40 bg-orange-400/10 px-3 py-2 font-mono text-[12px] text-orange-300">
          {isOwn
            ? <>Your bio was hidden by a moderator{profile.bioHiddenReason && <>: “{profile.bioHiddenReason}”</>} — only you and staff see it. Edit it to publish a fixed version.</>
            : <>Hidden from the public{profile.bioHiddenReason && <>: “{profile.bioHiddenReason}”</>} — visible to staff only.</>}
        </p>
      )}

      {editing ? (
        <div>
          <MentionTextarea
            autoFocus
            value={draft}
            onChange={setDraft}
            rows={3}
            maxLength={500}
            placeholder="a line about you — tools you like, what you reverse, @handle mentions work"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
          />
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-[11px] text-faint">{draft.length}/500</span>
            <button onClick={() => setEditing(false)} className="ml-auto font-mono text-[12px] text-faint transition-colors hover:text-ink">cancel</button>
            <button onClick={save} disabled={busy} className="btn-acid px-3 py-1 text-[12px] disabled:opacity-50">{busy ? '…' : 'save'}</button>
          </div>
        </div>
      ) : (
        <>
          {profile.bio
            ? <p className={`whitespace-pre-wrap font-mono text-[13px] leading-relaxed ${profile.bioHidden ? 'text-faint opacity-70' : 'text-ink/90'}`}><MentionText text={profile.bio} /></p>
            : <p className="font-mono text-[13px] italic text-faint">no bio yet.</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[12px]">
            {isOwn && <button onClick={startEdit} className="text-faint transition-colors hover:text-acid">✎ {profile.bio ? 'edit bio' : 'add a bio'}</button>}
            {staff && !isOwn && profile.bio && (
              <span className="inline-flex items-center gap-1.5">
                <StaffTag label="mod" />
                {profile.bioHidden
                  ? <button onClick={() => toggleHide(null)} className="text-faint transition-colors hover:text-acid">unhide bio</button>
                  : <button onClick={() => setHidePrompt(true)} className="text-faint transition-colors hover:text-red-400">hide bio</button>}
              </span>
            )}
          </div>
        </>
      )}

      {hidePrompt && (
        <PromptDialog
          title="Hide profile bio"
          label="The bio disappears for the public; the owner keeps seeing it with your reason and can edit it to publish a fixed version."
          placeholder="what's wrong with it?"
          confirmText="hide bio"
          danger
          presets={['Inappropriate content', 'Spam / advertising', 'Impersonation', 'Harassment']}
          onConfirm={(reason) => toggleHide(reason)}
          onCancel={() => setHidePrompt(false)}
        />
      )}
    </div>
  )
}

// "⚑ report this profile" — same flow as reporting a crackme; lands in the same moderation queue.
// Only the reasons that make sense for a profile (no malware/broken here).
const PROFILE_REASONS = REPORT_REASONS.filter((r) => ['Spam', 'Inappropriate', 'Other'].includes(r.value))

function ReportProfileControl({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(PROFILE_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done'>('idle')

  const send = async () => {
    setPhase('sending')
    const ok = await reportProfile(handle, reason, details)
    setPhase(ok ? 'done' : 'idle')
    if (ok) setOpen(false)
  }

  if (phase === 'done')
    return <p className="mt-10 font-mono text-[12px] text-faint">Thanks — a moderator will take a look.</p>

  return (
    <div className="mt-10">
      {!open ? (
        <button onClick={() => setOpen(true)} className="font-mono text-[12px] text-faint transition-colors hover:text-red-400">⚑ report this profile</button>
      ) : (
        <div className="rounded-lg border border-line bg-surface/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-acid">
              {PROFILE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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

// Median publish→first-solve, as a human span. "—" until at least one of their crackmes is cracked.
function formatCrackTime(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

function badgeClass(rarity: string): string {
  switch (rarity) {
    case 'rare': return 'border-acid/50 text-acid'
    case 'epic': return 'border-violet-400/50 text-violet-300'
    case 'legendary': return 'border-amber-400/50 text-amber-300'
    default: return 'border-line text-muted'
  }
}

// Defensive truncate so an unexpectedly long value never blows out the fixed-width card.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/30 p-4 text-center">
      <div className="truncate font-display text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">{label}</div>
    </div>
  )
}
