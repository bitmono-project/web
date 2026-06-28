import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { devLogin, getProviders, loginUrl, useAuth, type Providers } from '../lib/auth'
import { DiscordIcon, GitHubIcon } from '../components/Icons'
import { useT } from '../lib/i18n'

export default function Login() {
  const t = useT()
  const [providers, setProviders] = useState<Providers>({ discord: false, github: false, dev: false })
  const [params] = useSearchParams()
  const returnUrl = params.get('returnUrl') || '/crackmes'
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { getProviders().then(setProviders) }, [])

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{t('login.title')}</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        {t('login.subtitle')}
      </p>

      <div className="mt-8 space-y-3">
        <a
          href={providers.discord ? loginUrl('discord', returnUrl) : undefined}
          aria-disabled={!providers.discord}
          className={`flex items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm transition-colors ${providers.discord ? 'text-ink hover:border-acid hover:text-acid' : 'cursor-not-allowed text-faint'}`}
        >
          <DiscordIcon className="h-5 w-5" /> {t('login.discord')}{!providers.discord && ` ${t('login.notConfigured')}`}
        </a>
        <a
          href={providers.github ? loginUrl('github', returnUrl) : undefined}
          aria-disabled={!providers.github}
          className={`flex items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm transition-colors ${providers.github ? 'text-ink hover:border-acid hover:text-acid' : 'cursor-not-allowed text-faint'}`}
        >
          <GitHubIcon className="h-5 w-5" /> {t('login.github')}{!providers.github && ` ${t('login.notConfigured')}`}
        </a>
      </div>

      {providers.dev && <DevLogin onDone={async () => { await refresh(); navigate(returnUrl) }} />}
    </main>
  )
}

function DevLogin({ onDone }: { onDone: () => void }) {
  const t = useT()
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
    else setErr(t('login.failed'))
  }

  return (
    <div className="mt-8 rounded-xl border border-dashed border-line bg-void/40 p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{t('login.devTitle')}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="min-w-[140px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={t('login.handle')}
        />
        <label className="flex items-center gap-2 font-mono text-[12px] text-muted">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> {t('login.admin')}
        </label>
        <button onClick={go} disabled={busy} className="btn-acid disabled:opacity-50">{busy ? '…' : t('login.signIn')}</button>
      </div>
      {err && <p className="mt-2 font-mono text-xs text-red-400">{err}</p>}
    </div>
  )
}
