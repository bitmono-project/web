import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Linkifies @handle mentions inside plain user text (comments, writeups, descriptions, bios).
// Pattern mirrors the server's Mentions.Parse (BitMono.Web.Api/Notifications/Mentions.cs) — keep in sync.
const MENTION = /(?<![\w.@-])@([a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?)/gi

export function MentionText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MENTION)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    parts.push(
      <Link key={i} to={`/user/${m[1].toLowerCase()}`} className="text-acid transition-colors hover:underline">
        @{m[1]}
      </Link>,
    )
    last = i + m[0].length
  }
  if (parts.length === 0) return <>{text}</>
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
