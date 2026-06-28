import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

let loader: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  loader ??= new Promise<void>((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
  return loader
}

// Cloudflare Turnstile widget. Calls onToken with the solved token (or null on expire/error).
// Tokens are single-use — remount via a changing `key` to get a fresh one after each submit.
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id: string | null = null
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return
      id = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    })
    return () => {
      cancelled = true
      if (id && window.turnstile) { try { window.turnstile.remove(id) } catch { /* already gone */ } }
    }
    // onToken intentionally omitted — re-rendering the widget on every parent render would reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])
  return <div ref={ref} className="cf-turnstile mt-2" />
}
