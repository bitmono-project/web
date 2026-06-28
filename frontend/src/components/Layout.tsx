import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { getAppVersion } from '../lib/version'
import { isAdmin, isModerator, useAuth } from '../lib/auth'
import { getUnreadCount } from '../lib/notifications'

export function Layout() {
  return (
    <div className="grain relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}

function Header() {
  const { me, loading, signOut } = useAuth()
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/" className="flex items-center gap-3">
        <img src="/mark.png" alt="BitMono" className="h-8 w-8" />
        <span className="font-mono text-sm font-bold tracking-tight">bitmono</span>
      </Link>
      <nav className="flex items-center gap-5 font-mono text-[13px] text-muted">
        <Link to="/#obfuscate" className="hidden transition-colors hover:text-ink sm:inline">Obfuscate</Link>
        <Link to="/crackmes" className="transition-colors hover:text-ink">Crackmes</Link>
        <Link to="/leaderboard" className="transition-colors hover:text-ink">Leaderboard</Link>
        {isModerator(me) && !isAdmin(me) && <Link to="/moderation" className="transition-colors hover:text-ink">Review</Link>}
        {isAdmin(me) && <Link to="/admin" className="transition-colors hover:text-acid">Admin</Link>}
        <a href="https://docs.bitmono.dev" className="hidden transition-colors hover:text-ink sm:inline">Docs</a>
        {!loading && (me
          ? (
            <span className="flex items-center gap-3">
              <Link to="/submissions" className="hidden transition-colors hover:text-ink sm:inline">submissions</Link>
              <Link to="/upload" className="text-ink transition-colors hover:text-acid">submit</Link>
              <NotificationBell />
              {me.handle
                ? <Link to={`/user/${me.handle}`} className="hidden text-faint transition-colors hover:text-acid sm:inline">{me.name}</Link>
                : <span className="hidden text-faint sm:inline">{me.name}</span>}
              <button onClick={signOut} className="rounded-full border border-line px-3 py-1.5 text-ink transition-colors hover:border-acid hover:text-acid">
                logout
              </button>
            </span>
          )
          : (
            <Link to="/login" className="rounded-full border border-line px-4 py-1.5 text-ink transition-colors hover:border-acid hover:text-acid">
              login
            </Link>
          ))}
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl border-t border-line px-6 py-8 font-mono text-xs text-faint">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <span>© bitmono — free &amp; open-source obfuscator for .NET &amp; Mono · web {getAppVersion()}</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacy" className="transition-colors hover:text-ink">privacy</Link>
          <Link to="/terms" className="transition-colors hover:text-ink">terms</Link>
          <a href="mailto:hello@bitmono.dev" className="transition-colors hover:text-ink">contact</a>
          <a href="https://docs.bitmono.dev" className="transition-colors hover:text-ink">docs</a>
          <a href="https://github.com/bitmono-project/web" className="transition-colors hover:text-ink">source</a>
          <a href="https://github.com/bitmono-project/obfuscation-service" className="transition-colors hover:text-ink">obfuscation</a>
          <a href="https://github.com/bitmono-project/BitMono" className="transition-colors hover:text-ink">engine</a>
          <a href="https://discord.gg/sFDHd47St4" className="transition-colors hover:text-ink">discord</a>
        </div>
      </div>
    </footer>
  )
}

// Bell with an unread badge; polls the unread count on an interval + when the tab regains focus.
function NotificationBell() {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let live = true
    const load = () => getUnreadCount().then((n) => { if (live) setUnread(n) })
    load()
    const id = setInterval(load, 60_000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { live = false; clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [])
  return (
    <Link to="/notifications" className="relative text-muted transition-colors hover:text-acid" title="Notifications" aria-label="Notifications">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-acid px-1 text-[10px] font-bold text-void">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
