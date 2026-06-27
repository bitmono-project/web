import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProtections, type ProtectionInfo } from '../lib/api'
import { PLATFORMS } from '../lib/crackmes'
import { getConfig } from '../lib/config'
import { useAuth } from '../lib/auth'

const LANGUAGES = [
  { value: 'CSharp', label: 'C#' },
  { value: 'FSharp', label: 'F#' },
  { value: 'VbNet', label: 'VB.NET' },
  { value: 'Cpp', label: 'C/C++' },
  { value: 'Other', label: 'Other' },
]
const DIFFICULTIES = [
  { value: 'VeryEasy', label: '1 · Very Easy' },
  { value: 'Easy', label: '2 · Easy' },
  { value: 'Medium', label: '3 · Medium' },
  { value: 'Hard', label: '4 · Hard' },
  { value: 'VeryHard', label: '5 · Very Hard' },
  { value: 'Insane', label: '6 · Insane' },
]

const TERMS = [
  'This is my own work, or I have the right to share it.',
  'It’s an educational crackme — not malware, not a commercial-software crack, no DRM bypass, no external network calls.',
  'It runs, and I understand obfuscated binaries may trip antivirus — that’s expected.',
]

const field = 'w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid'
const label = 'mb-1 block font-mono text-[11px] uppercase tracking-wider text-faint'

export default function Upload() {
  const { me, loading } = useAuth()
  const [catalog, setCatalog] = useState<ProtectionInfo[]>([])
  const [protections, setProtections] = useState<Set<string>>(new Set())
  const [accepted, setAccepted] = useState([false, false, false])
  const [reactionsEnabled, setReactionsEnabled] = useState(true)
  const [commentReactionsEnabled, setCommentReactionsEnabled] = useState(true)
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null)

  useEffect(() => { getProtections().then(setCatalog) }, [])
  useEffect(() => { getConfig().then((c) => setTurnstileSiteKey(c.turnstileSiteKey)) }, [])

  // Load the Turnstile script once the site key is known; it implicitly renders the .cf-turnstile div
  // (already in the DOM by then) and injects a hidden "cf-turnstile-response" input into the form.
  useEffect(() => {
    if (!turnstileSiteKey || document.querySelector('script[data-turnstile]')) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.setAttribute('data-turnstile', '')
    document.head.appendChild(script)
  }, [turnstileSiteKey])

  if (loading) return null
  if (!me) return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center font-mono text-sm text-muted">
      You need an account to submit. <Link to="/login?returnUrl=/upload" className="text-acid hover:underline">Sign in →</Link>
    </main>
  )

  const toggleProtection = (name: string) => setProtections((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!accepted.every(Boolean)) { setError('Please accept all three terms.'); return }
    const formEl = e.currentTarget
    const data = new FormData(formEl)
    if (!(data.get('File') as File)?.size) { setError('Choose a file to upload.'); return }
    for (const p of protections) data.append('Protections', p)
    data.set('AcceptOriginal', String(accepted[0]))
    data.set('AcceptLegal', String(accepted[1]))
    data.set('AcceptVm', String(accepted[2]))
    data.set('ReactionsEnabled', String(reactionsEnabled))
    data.set('CommentReactionsEnabled', String(commentReactionsEnabled))

    setPhase('sending')
    setError('')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: data })
      if (res.status === 202) { setPhase('done'); return }
      setError((await res.text().catch(() => '')) || `Upload failed (${res.status})`)
      setPhase('error')
    } catch {
      setError('Something broke during upload.')
      setPhase('error')
    }
  }

  if (phase === 'done') return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="font-display text-3xl font-bold text-acid">Submitted ✓</h1>
      <p className="mt-3 font-mono text-sm text-muted">
        Your crackme is in the review queue. A moderator approves every submission before it goes public —
        it’ll show up in the gallery once it’s through.
      </p>
      <Link to="/crackmes" className="btn-acid mt-6 inline-flex">back to the gallery</Link>
    </main>
  )

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Submit a crackme</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        Upload a single assembly (.dll/.exe) or a password-less .zip — we wrap it in a password-protected zip on download.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label className={label} htmlFor="Title">Title</label>
          <input id="Title" name="Title" required maxLength={150} className={field} placeholder="Keygen Me One" />
        </div>

        <div>
          <label className={label} htmlFor="Description">Description / goal</label>
          <textarea id="Description" name="Description" rows={4} maxLength={8000} className={field}
            placeholder="What should be solved? (find the serial, write a keygen, bypass the check…) Any hints or requirements." />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={label} htmlFor="Platform">Runtime</label>
            <select id="Platform" name="Platform" className={field} defaultValue="dotNet">
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={label} htmlFor="Runtime">Version</label>
            <input id="Runtime" name="Runtime" maxLength={40} className={field} placeholder=".NET 8" />
          </div>
          <div>
            <label className={label} htmlFor="Language">Language</label>
            <select id="Language" name="Language" className={field} defaultValue="CSharp">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="Difficulty">Difficulty</label>
            <select id="Difficulty" name="Difficulty" className={field} defaultValue="Medium">
              {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 font-mono text-[13px] text-muted">
          <input type="checkbox" name="IsBitMonoObfuscated" value="true" defaultChecked /> Obfuscated with BitMono
        </label>

        <div className="space-y-1">
          <label className="flex items-center gap-2 font-mono text-[13px] text-muted">
            <input type="checkbox" checked={reactionsEnabled} onChange={(e) => setReactionsEnabled(e.target.checked)} /> Allow reactions on this post
          </label>
          <label className="flex items-center gap-2 font-mono text-[13px] text-muted">
            <input type="checkbox" checked={commentReactionsEnabled} onChange={(e) => setCommentReactionsEnabled(e.target.checked)} /> Allow reactions on comments
          </label>
        </div>

        {catalog.length > 0 && (
          <div>
            <label className={label}>BitMono protections applied <span className="normal-case text-faint">(optional)</span></label>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-line bg-void/40 p-3">
              {catalog.map((p) => (
                <label key={p.name} className="flex items-center gap-2 font-mono text-[12px] text-muted">
                  <input type="checkbox" checked={protections.has(p.name)} onChange={() => toggleProtection(p.name)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={label} htmlFor="File">File <span className="normal-case text-faint">(.dll / .exe / .zip, ≤ 10 MB)</span></label>
          <label htmlFor="File" className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 transition-colors hover:border-acid">
            <span className="rounded bg-line px-3 py-1 font-mono text-[13px] text-ink">Choose file</span>
            <span className="truncate font-mono text-[13px] text-faint">{fileName || 'no file chosen'}</span>
          </label>
          <input id="File" name="File" type="file" accept=".dll,.exe,.zip" className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
        </div>

        <div className="space-y-2 rounded-lg border border-line bg-surface/30 p-4">
          {TERMS.map((t, i) => (
            <label key={i} className="flex items-start gap-2 font-mono text-[12px] leading-snug text-muted">
              <input type="checkbox" className="mt-0.5" checked={accepted[i]}
                onChange={(e) => setAccepted((a) => a.map((v, j) => (j === i ? e.target.checked : v)))} />
              {t}
            </label>
          ))}
        </div>

        {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark" />}

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}

        <button type="submit" disabled={phase === 'sending'} className="btn-acid disabled:opacity-50">
          {phase === 'sending' ? 'submitting…' : 'submit for review →'}
        </button>
      </form>
    </main>
  )
}
