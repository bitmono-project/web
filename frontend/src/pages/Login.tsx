import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { devLogin, getProviders, loginUrl, useAuth, type Providers } from '../lib/auth'

export default function Login() {
  const [providers, setProviders] = useState<Providers>({ discord: false, github: false, dev: false })
  const [params] = useSearchParams()
  const returnUrl = params.get('returnUrl') || '/crackmes'
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { getProviders().then(setProviders) }, [])

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        Accounts are OAuth-only — no passwords. You need one to upload, comment, or vote. Downloads stay anonymous.
      </p>

      <div className="mt-8 space-y-3">
        <a
          href={providers.discord ? loginUrl('discord', returnUrl) : undefined}
          aria-disabled={!providers.discord}
          className={`flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm transition-colors ${providers.discord ? 'text-ink hover:border-acid hover:text-acid' : 'cursor-not-allowed text-faint'}`}
        >
          Continue with Discord{!providers.discord && ' · not configured'}
        </a>
        <a
          href={providers.github ? loginUrl('github', returnUrl) : undefined}
          aria-disabled={!providers.github}
          className={`flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm transition-colors ${providers.github ? 'text-ink hover:border-acid hover:text-acid' : 'cursor-not-allowed text-faint'}`}
        >
          Continue with GitHub{!providers.github && ' · not configured'}
        </a>
      </div>

      {providers.dev && <DevLogin onDone={async () => { await refresh(); navigate(returnUrl) }} />}
    </main>
  )
}

function DevLogin({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState('dev')
  const [admin, setAdmin] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const go = async () => {
    setBusy(true)
    setErr('')
    const me = await devLogin(handle, admin)
    setBusy(false)
    if (me) onDone()
    else setErr('dev login failed')
  }

  return (
    <div className="mt-8 rounded-xl border border-dashed border-line bg-void/40 p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">dev login (development only)</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="min-w-[140px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="handle"
        />
        <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> admin
        </label>
        <button onClick={go} disabled={busy} className="btn-acid disabled:opacity-50">{busy ? '…' : 'sign in'}</button>
      </div>
      {err && <p className="mt-2 font-mono text-xs text-red-400">{err}</p>}
    </div>
  )
}
