import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { getAppVersion } from '../lib/version'
import { isAdmin, isModerator, useAuth } from '../lib/auth'
import { getUnreadCount } from '../lib/notifications'
import { useT } from '../lib/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Tooltip } from './Tooltip'

export function Layout() {
  return (
    <div className="grain relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />
      <HashTarget />
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}

// Scrolls to and locks onto the element the URL hash points at (e.g. /ranks#nop-sled-legend).
// pushState navigation never updates CSS :target, so a .hash-target class stands in for it.
// The lock starts only once the smooth scroll settles — a flash mid-scroll plays to nobody.
function HashTarget() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const timers: number[] = []
    let el: HTMLElement | null = null
    let unlisten = () => {}
    let tries = 0
    const lock = () => {
      unlisten()
      el!.classList.add('hash-target')
      timers.push(window.setTimeout(() => el!.classList.remove('hash-target'), 2400))
    }
    const attempt = () => {
      el = document.getElementById(id)
      if (!el) {
        // ponytail: poll for anchors that render after a fetch (comments etc.); give up after ~6s
        if (++tries < 40) timers.push(window.setTimeout(attempt, 150))
        return
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // scroll-idle debounce: each scroll event pushes the lock back; fires at 250ms if no scroll happens
      let idle = window.setTimeout(lock, 250)
      const onScroll = () => { window.clearTimeout(idle); idle = window.setTimeout(lock, 140) }
      window.addEventListener('scroll', onScroll, { passive: true })
      unlisten = () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(idle) }
    }
    attempt()
    return () => {
      unlisten()
      timers.forEach(clearTimeout)
      el?.classList.remove('hash-target')
    }
  }, [pathname, hash])
  return null
}

function Header() {
  const { me, loading, signOut } = useAuth()
  const t = useT()
  return (
    <header className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
      <Link to="/" className="flex items-center gap-3">
        <img src="/mark.png" alt="BitMono" className="h-8 w-8" />
        <span className="font-mono text-sm font-bold tracking-tight">bitmono</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[13px] text-muted sm:gap-x-5">
        <Link to="/#obfuscate" className="hidden transition-colors hover:text-ink sm:inline">{t('nav.obfuscate')}</Link>
        <Link to="/download" className="transition-colors hover:text-ink">{t('nav.download')}</Link>
        <Link to="/crackmes" className="transition-colors hover:text-ink">{t('nav.crackmes')}</Link>
        <Link to="/leaderboard" className="transition-colors hover:text-ink">{t('nav.leaderboard')}</Link>
        <Link to="/blog" className="transition-colors hover:text-ink">{t('nav.blog')}</Link>
        {isModerator(me) && !isAdmin(me) && <Link to="/moderation" className="transition-colors hover:text-ink">{t('nav.review')}</Link>}
        {isAdmin(me) && <Link to="/admin" className="transition-colors hover:text-acid">{t('nav.admin')}</Link>}
        <a href="https://docs.bitmono.dev" className="hidden transition-colors hover:text-ink sm:inline">{t('nav.docs')}</a>
        {!loading && (me
          ? (
            <span className="flex items-center gap-3">
              <Link to="/submissions" className="hidden transition-colors hover:text-ink sm:inline">{t('nav.submissions')}</Link>
              <Link to="/upload" className="text-ink transition-colors hover:text-acid">{t('nav.submit')}</Link>
              <NotificationBell />
              {me.handle
                ? <Link to={`/user/${me.handle}`} className="hidden text-faint transition-colors hover:text-acid sm:inline">{me.name}</Link>
                : <span className="hidden text-faint sm:inline">{me.name}</span>}
              <button onClick={signOut} className="rounded-full border border-line px-3 py-1.5 text-ink transition-colors hover:border-acid hover:text-acid">
                {t('nav.logout')}
              </button>
            </span>
          )
          : (
            <Link to="/login" className="rounded-full border border-line px-4 py-1.5 text-ink transition-colors hover:border-acid hover:text-acid">
              {t('nav.login')}
            </Link>
          ))}
        <LanguageSwitcher />
      </nav>
    </header>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className="mx-auto max-w-6xl border-t border-line px-6 py-8 font-mono text-xs text-faint">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <span>{t('footer.copy', { version: getAppVersion() })}</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/faq" className="transition-colors hover:text-ink">{t('footer.faq')}</Link>
          <Link to="/privacy" className="transition-colors hover:text-ink">{t('footer.privacy')}</Link>
          <Link to="/terms" className="transition-colors hover:text-ink">{t('footer.terms')}</Link>
          <a href="mailto:hello@bitmono.dev" className="transition-colors hover:text-ink">{t('footer.contact')}</a>
          <a href="https://docs.bitmono.dev" className="transition-colors hover:text-ink">{t('footer.docs')}</a>
          <a href="https://github.com/bitmono-project/web" className="transition-colors hover:text-ink">{t('footer.source')}</a>
          <a href="https://github.com/bitmono-project/obfuscation-service" className="transition-colors hover:text-ink">{t('footer.obfuscation')}</a>
          <a href="https://github.com/bitmono-project/BitMono" className="transition-colors hover:text-ink">{t('footer.engine')}</a>
          <a href="https://discord.gg/sFDHd47St4" className="transition-colors hover:text-ink">{t('footer.discord')}</a>
        </div>
      </div>
    </footer>
  )
}

// Bell with an unread badge; polls the unread count on an interval + when the tab regains focus.
function NotificationBell() {
  const t = useT()
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
    <Tooltip label={t('nav.notifications')} placement="bottom">
      <Link to="/notifications" className="relative text-muted transition-colors hover:text-acid" aria-label={t('nav.notifications')}>
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
    </Tooltip>
  )
}
