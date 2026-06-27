import { Link, Outlet } from 'react-router-dom'
import { getAppVersion } from '../lib/version'
import { isModerator, useAuth } from '../lib/auth'

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
        {isModerator(me) && <Link to="/moderation" className="transition-colors hover:text-ink">Review</Link>}
        <a href="https://docs.bitmono.dev" className="hidden transition-colors hover:text-ink sm:inline">Docs</a>
        {!loading && (me
          ? (
            <span className="flex items-center gap-3">
              <Link to="/upload" className="text-ink transition-colors hover:text-acid">submit</Link>
              <span className="hidden text-faint sm:inline">{me.name}</span>
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
          <a href="https://github.com/sunnamed434/BitMono" className="transition-colors hover:text-ink">github</a>
          <a href="https://discord.gg/sFDHd47St4" className="transition-colors hover:text-ink">discord</a>
        </div>
      </div>
    </footer>
  )
}
