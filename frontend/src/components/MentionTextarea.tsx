import { useEffect, useRef, useState } from 'react'
import { searchSite, type SearchUser } from '../lib/search'

// A <textarea> that autocompletes @handle mentions: type "@su" and it offers matching users
// (arrows/enter/tab to pick, esc to dismiss). Reused anywhere mentions are typed — bio, comments.
// The dropdown drops under the box (no caret-mirror gymnastics); the token detection mirrors
// MentionText's linkify rule so what you complete is what gets linked.

// The @token ending at the caret: leading boundary, '@', then the partial handle we're typing.
const TOKEN = /(?:^|[^\w.@-])@([a-z0-9-]*)$/i

// The @token under the caret, or null. `at` is the index of the char right after '@'.
export function mentionToken(text: string, caret: number): { at: number; query: string } | null {
  const m = TOKEN.exec(text.slice(0, caret))
  return m ? { at: caret - m[1].length, query: m[1] } : null
}

// Replace the partial handle with the chosen one (keeping the '@'), then a space — unless the
// caret already sits before whitespace (mid-text insert), which would double it up.
export function applyMention(value: string, token: { at: number; query: string }, handle: string) {
  const end = token.at + token.query.length
  const space = /^\s/.test(value.slice(end)) ? '' : ' '
  const next = value.slice(0, token.at) + handle + space + value.slice(end)
  return { next, caret: token.at + handle.length + space.length }
}

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (value: string) => void
}

export function MentionTextarea({ value, onChange, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [users, setUsers] = useState<SearchUser[]>([])
  const [active, setActive] = useState(0)
  // { at: index of the char right after '@'; query: partial handle } while a token is under the caret.
  const [token, setToken] = useState<{ at: number; query: string } | null>(null)
  const seq = useRef(0)

  const detect = (el: HTMLTextAreaElement, text: string) => {
    if (el.selectionStart !== el.selectionEnd) return setToken(null) // a range selection isn't a token
    setToken(mentionToken(text, el.selectionStart))
  }

  // Search needs >= 2 chars (matches /api/search); shorter tokens just wait.
  useEffect(() => {
    if (!token || token.query.length < 2) { setUsers([]); return }
    const mine = ++seq.current
    const t = window.setTimeout(() => {
      searchSite(token.query).then((r) => {
        if (seq.current !== mine) return
        setUsers(r.users)
        setActive(0)
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [token?.query])

  const open = token !== null && users.length > 0

  const pick = (u: SearchUser) => {
    if (!token) return
    const { next, caret } = applyMention(value, token, u.handle)
    onChange(next)
    setToken(null)
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(caret, caret) })
  }

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => { onChange(e.target.value); detect(e.target, e.target.value) }}
        onKeyUp={(e) => detect(e.currentTarget, e.currentTarget.value)}
        onClick={(e) => detect(e.currentTarget, e.currentTarget.value)}
        onBlur={() => setToken(null)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % users.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + users.length) % users.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(users[active]); return }
            if (e.key === 'Escape') { e.preventDefault(); setToken(null); return }
          }
          onKeyDown?.(e)
        }}
      />
      {open && (
        // preventDefault on mousedown keeps the textarea focused so onBlur doesn't close us mid-click.
        <ul
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl"
        >
          {users.map((u, i) => (
            <li key={u.handle}>
              <button
                type="button"
                onClick={() => pick(u)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[13px] transition-colors ${i === active ? 'bg-void/70' : 'hover:bg-void/50'}`}
              >
                {u.avatar
                  ? <img src={u.avatar} alt="" className="h-5 w-5 shrink-0 rounded-full border border-line" />
                  : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-void font-display text-[10px] text-acid">{u.displayName.slice(0, 1).toUpperCase()}</span>}
                <span className="truncate text-ink">{u.displayName}</span>
                <span className="truncate text-[11px] text-faint">@{u.handle}</span>
                <span className="ml-auto shrink-0 text-[11px] text-faint">{u.points.toLocaleString()} pts</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
