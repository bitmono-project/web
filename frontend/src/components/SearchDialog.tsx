import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { type SearchResults, EMPTY_RESULTS, searchSite } from '../lib/search'
import { difficultyLabel } from '../lib/crackmes'

// Site-wide quick search palette (opened from the header or Ctrl/⌘+K). Debounced type-ahead over
// crackmes, users and writeups; Enter jumps to the first hit, links keep native middle-click.
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ok'>('idle')
  const navigate = useNavigate()
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(EMPTY_RESULTS)
      setPhase('idle')
      return
    }
    setPhase('loading')
    const mine = ++seq.current
    const t = window.setTimeout(() => {
      searchSite(term).then((r) => {
        if (seq.current !== mine) return // a newer keystroke owns the box now
        setResults(r)
        setPhase('ok')
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [q])

  const first = results.crackmes[0] ? `/challenge/${results.crackmes[0].slug}`
    : results.users[0] ? `/user/${results.users[0].handle}`
    : results.writeups[0] ? `/challenge/${results.writeups[0].crackmeSlug}#writeup-${results.writeups[0].id}`
    : null
  const go = (to: string) => { onClose(); navigate(to) }
  const empty = phase === 'ok' && !results.crackmes.length && !results.users.length && !results.writeups.length

  return (
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-start justify-center bg-void/80 p-6 pt-[14vh] backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <span className="font-mono text-sm text-faint" aria-hidden>/</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && first) go(first)
            }}
            placeholder="search crackmes, users, writeups…"
            className="w-full bg-transparent py-3 font-mono text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {phase === 'idle' && <Hint>type at least 2 characters…</Hint>}
          {phase === 'loading' && <Hint>searching<span className="caret">_</span></Hint>}
          {empty && <Hint>nothing matched “{q.trim()}”.</Hint>}

          {results.crackmes.length > 0 && (
            <Group label="Crackmes">
              {results.crackmes.map((c) => (
                <Item key={c.slug} to={`/challenge/${c.slug}`} onPick={onClose}>
                  <span className="truncate text-ink">{c.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-faint">{difficultyLabel(c.difficulty)} · by {c.author}</span>
                </Item>
              ))}
            </Group>
          )}

          {results.users.length > 0 && (
            <Group label="Users">
              {results.users.map((u) => (
                <Item key={u.handle} to={`/user/${u.handle}`} onPick={onClose}>
                  {u.avatar
                    ? <img src={u.avatar} alt="" className="h-5 w-5 rounded-full border border-line" />
                    : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-void font-display text-[10px] text-acid">{u.displayName.slice(0, 1).toUpperCase()}</span>}
                  <span className="truncate text-ink">{u.displayName}</span>
                  <span className="truncate text-[11px] text-faint">@{u.handle}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-faint">{u.points.toLocaleString()} pts</span>
                </Item>
              ))}
            </Group>
          )}

          {results.writeups.length > 0 && (
            <Group label="Writeups">
              {results.writeups.map((w) => (
                <Item key={w.id} to={`/challenge/${w.crackmeSlug}#writeup-${w.id}`} onPick={onClose}>
                  <span className="truncate text-ink">{w.title}</span>
                  <span className="ml-auto shrink-0 truncate text-[11px] text-faint">on {w.crackmeTitle}</span>
                </Item>
              ))}
            </Group>
          )}
        </div>
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-faint">{label}</div>
      {children}
    </div>
  )
}

function Item({ to, onPick, children }: { to: string; onPick: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onPick}
      className="flex items-center gap-2 rounded-lg px-2 py-2 font-mono text-[13px] transition-colors hover:bg-void/60"
    >
      {children}
    </Link>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="px-2 py-6 text-center font-mono text-[12px] text-faint">{children}</p>
)
