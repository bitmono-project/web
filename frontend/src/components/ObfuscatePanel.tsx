import { useCallback, useEffect, useRef, useState } from 'react'
import { startObfuscation, waitForResult, downloadUrl, getProtections, type ProtectionInfo } from '../lib/api'
import { parseAssemblyRefs, missingRefs } from '../lib/peRefs'

type Phase = 'idle' | 'ready' | 'working' | 'done' | 'error'

const MAX_DEPS_BYTES = 100 * 1024 * 1024 // total across attached dependencies (mirrors the API cap)
const isAssembly = (name: string) => /\.(dll|exe)$/i.test(name)
const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

// Cumulative strength ladder (ConfuserEx-style): picking a level enables every protection whose
// minLevel is at or below it. Mono-only/packer protections have no level — opt-in via the checklist.
const LEVELS = ['Minimum', 'Normal', 'Aggressive', 'Maximum']
const DEFAULT_LEVEL = 'Normal'
const LEVEL_DESC: Record<string, string> = {
  Minimum: 'Basic — rename + flatten namespaces + block ildasm.',
  Normal: 'Recommended — adds string encryption + anti-de4dot.',
  Aggressive: 'Stronger — adds anti-debug, return-type & call hiding (some runtime cost).',
  Maximum: 'Strongest — adds JIT hooks, native strings, nop bloat (may break some assemblies).',
}

function cumulative(catalog: ProtectionInfo[], level: string): Set<string> {
  const ceiling = LEVELS.indexOf(level)
  return new Set(
    catalog.filter((p) => p.minLevel !== null && LEVELS.indexOf(p.minLevel) <= ceiling).map((p) => p.name),
  )
}

export function ObfuscatePanel() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ id: string; name: string } | null>(null)
  const [catalog, setCatalog] = useState<ProtectionInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [level, setLevel] = useState<string>(DEFAULT_LEVEL)
  const [agreed, setAgreed] = useState(false)
  const [progress, setProgress] = useState<{ stage: 'uploading' | 'obfuscating'; pct: number }>({ stage: 'uploading', pct: 0 })
  const [deps, setDeps] = useState<File[]>([])
  const [signingKey, setSigningKey] = useState<File | null>(null)
  const [refs, setRefs] = useState<string[] | null>(null) // the main assembly's references, for gap detection
  const [notice, setNotice] = useState('')
  const [extrasOpen, setExtrasOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProtections().then((c) => {
      setCatalog(c)
      setSelected(cumulative(c, DEFAULT_LEVEL))
    })
  }, [])

  const applyLevel = (lvl: string) => {
    setLevel(lvl)
    setSelected(cumulative(catalog, lvl))
  }

  const toggle = (name: string) => {
    setLevel('Custom')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const pick = (f: File | null | undefined) => {
    if (!f) return
    if (!isAssembly(f.name)) return fail('Only .dll / .exe assemblies.')
    if (f.size > 100 * 1024 * 1024) return fail('Assembly is over 100 MB.')
    setFile(f)
    setError('')
    setPhase('ready')
    setDeps([]); setSigningKey(null); setRefs(null); setNotice(''); setExtrasOpen(false)
    // Reference-gap detection: read the assembly's references so we can flag missing dependencies.
    // Fail-open — a parse failure just means no hint. ponytail: reads the whole file into memory,
    // which is fine for typical assemblies; switch to slice reads only if huge files become common.
    f.arrayBuffer().then((buf) => setRefs(parseAssemblyRefs(buf) ?? [])).catch(() => setRefs([]))
  }

  const addDeps = (incoming: FileList | File[] | null) => {
    if (!incoming) return
    const list = Array.from(incoming)
    const kept = new Map(deps.map((d) => [d.name.toLowerCase(), d]))
    let total = deps.reduce((n, d) => n + d.size, 0)
    let skippedKind = 0, skippedDupe = 0, skippedMain = 0, skippedSize = 0
    for (const f of list) {
      if (!isAssembly(f.name)) { skippedKind++; continue }
      const key = f.name.toLowerCase()
      if (file && key === file.name.toLowerCase()) { skippedMain++; continue }
      if (kept.has(key)) { skippedDupe++; continue }
      if (total + f.size > MAX_DEPS_BYTES) { skippedSize++; continue }
      kept.set(key, f); total += f.size
    }
    setDeps([...kept.values()])
    const parts = [
      skippedKind && `${skippedKind} non-assembly`,
      skippedDupe && `${skippedDupe} already added`,
      skippedMain && `${skippedMain} is your main file`,
      skippedSize && `${skippedSize} over the ${MAX_DEPS_BYTES / 1024 / 1024} MB cap`,
    ].filter(Boolean)
    setNotice(parts.length ? `Skipped ${parts.join(' · ')}.` : '')
  }

  const pickKey = (f: File | null | undefined) => {
    if (!f) return
    if (!/\.snk$/i.test(f.name)) return setNotice('Signing key must be a .snk file.')
    setSigningKey(f)
    setNotice('')
  }

  const fail = (msg: string) => {
    setError(msg)
    setPhase('error')
  }

  const run = useCallback(async () => {
    if (!file) return
    setPhase('working')
    setProgress({ stage: 'uploading', pct: 0 })
    setError('')
    try {
      const id = await startObfuscation(file, [...selected], agreed, deps, signingKey, (pct) => setProgress({ stage: 'uploading', pct }))
      setProgress({ stage: 'obfuscating', pct: 100 })
      const status = await waitForResult(id)
      if (status === 'done') {
        setResult({ id, name: file.name })
        setPhase('done')
      } else if (status === 'failed') {
        fail('Obfuscation failed — try a lower level, or add the assembly’s dependencies below and retry.')
      } else {
        fail('Timed out waiting for the result.')
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something broke.')
    }
  }, [file, selected, agreed, deps, signingKey])   // agreed MUST be here — without it run() sends a stale agree=false

  const reset = () => {
    setPhase('idle')
    setFile(null)
    setResult(null)
    setError('')
    setDeps([]); setSigningKey(null); setRefs(null); setNotice(''); setExtrasOpen(false)
  }

  const missing = refs ? missingRefs(refs, deps.map((d) => d.name)) : []
  const hasThirdPartyRefs = refs ? missingRefs(refs, []).length > 0 : false
  const showDrop = phase === 'idle' || phase === 'error'

  return (
    <div className="mx-auto max-w-2xl">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
        className={`relative overflow-hidden rounded-2xl border bg-surface/40 p-8 transition-colors duration-200 ${drag ? 'border-acid bg-surface' : 'border-line'}`}
      >
        <Corners />

        {phase === 'working' && (
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid to-transparent"
            style={{ animation: 'sweep 1.1s ease-in-out infinite' }}
          />
        )}

        {showDrop && (
          <button onClick={() => inputRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center gap-4 py-6 text-center">
            <Glyph />
            <div>
              <div className="font-display text-xl font-bold text-ink">Drop your assembly</div>
              <div className="mt-1 font-mono text-[13px] text-muted">or click to browse — .dll / .exe, up to 100&nbsp;MB</div>
            </div>
          </button>
        )}

        {!showDrop && file && (
          <div className="flex flex-col items-center gap-5 py-1 text-center">
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-faint">~/</span>
              <span className="text-ink">{file.name}</span>
              <span className="text-faint">· {(file.size / 1024).toFixed(0)} KB</span>
            </div>

            {phase === 'ready' && (
              <>
                <ExtrasSection
                  open={extrasOpen || missing.length > 0} onToggle={() => setExtrasOpen(true)}
                  deps={deps} onAddDeps={addDeps} onRemoveDep={(name) => setDeps((p) => p.filter((d) => d.name !== name))}
                  onClearDeps={() => { setDeps([]); setNotice('') }}
                  missing={missing} hasThirdPartyRefs={hasThirdPartyRefs}
                  signingKey={signingKey} onPickKey={pickKey} onRemoveKey={() => setSigningKey(null)}
                  notice={notice}
                />
                <ProtectionPicker catalog={catalog} selected={selected} level={level} onLevel={applyLevel} onToggle={toggle} />
                <label className="flex items-start gap-2 text-left font-mono text-[11px] leading-snug text-muted">
                  <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    I own this assembly (or I’m authorized to obfuscate it) and it isn’t malware. I agree to the{' '}
                    <a href="/terms" className="text-acid hover:underline">terms</a>.
                  </span>
                </label>
                <button onClick={run} disabled={selected.size === 0 || !agreed} className="btn-acid disabled:cursor-not-allowed disabled:opacity-40">
                  obfuscate{selected.size > 0 ? ` · ${selected.size}` : ''} →
                </button>
              </>
            )}

            {phase === 'working' && <WorkingView stage={progress.stage} pct={progress.pct} />}

            {phase === 'done' && result && (
              <div className="flex flex-col items-center gap-3">
                <div className="font-mono text-sm text-acid">✓ protected · input wiped</div>
                <a href={downloadUrl(result.id, result.name)} className="btn-acid" download={result.name}>download ↓</a>
              </div>
            )}
          </div>
        )}

        {/* Reset value so re-picking the SAME file (e.g. retry after a failure) fires change again. */}
        <input ref={inputRef} type="file" accept=".dll,.exe" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {phase === 'error' && error && <p className="mt-3 text-center font-mono text-xs text-red-400">{error}</p>}
      {(phase === 'done' || phase === 'error') && (
        <button onClick={reset} className="mx-auto mt-3 block font-mono text-xs text-faint transition-colors hover:text-muted">
          ↺ obfuscate another
        </button>
      )}
    </div>
  )
}

// Optional inputs that ride along with the assembly: dependency assemblies (so BitMono can resolve
// references) and a strong-name key (.snk) to re-sign the output. Collapsed by default — it
// auto-expands when reference-gap detection finds a dependency the user hasn't added yet.
function ExtrasSection({
  open, onToggle, deps, onAddDeps, onRemoveDep, onClearDeps, missing, hasThirdPartyRefs,
  signingKey, onPickKey, onRemoveKey, notice,
}: {
  open: boolean
  onToggle: () => void
  deps: File[]
  onAddDeps: (files: FileList | File[] | null) => void
  onRemoveDep: (name: string) => void
  onClearDeps: () => void
  missing: string[]
  hasThirdPartyRefs: boolean
  signingKey: File | null
  onPickKey: (f: File | null | undefined) => void
  onRemoveKey: () => void
  notice: string
}) {
  const [drag, setDrag] = useState(false)
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)
  const expanded = open || deps.length > 0
  const total = deps.reduce((n, d) => n + d.size, 0)

  return (
    <div className="w-full space-y-2 text-left">
      {!expanded ? (
        <button onClick={onToggle} aria-expanded={false}
          className="flex w-full items-center gap-2 font-mono text-[11px] text-faint transition-colors hover:text-muted">
          <span className="text-acid">+</span> add dependencies
          <span className="ml-auto">optional · resolves references</span>
        </button>
      ) : (
        <div className="rounded-xl border border-line bg-void/40 p-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px]">
            <span className="uppercase tracking-[0.18em] text-faint">dependencies</span>
            {deps.length > 0 && <span className="text-muted">{deps.length} · {formatSize(total)}</span>}
            {deps.length > 0 && (
              <button onClick={onClearDeps} className="ml-auto text-faint transition-colors hover:text-red-400">clear all</button>
            )}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onAddDeps(e.dataTransfer.files) }}
            className={`rounded-lg border border-dashed px-3 py-3 text-center font-mono text-[11px] transition-colors ${drag ? 'border-acid bg-surface' : 'border-line'}`}
          >
            <span className="text-muted">drop .dll files, or </span>
            <button onClick={() => filesRef.current?.click()} className="text-acid hover:underline">browse</button>
            <span className="text-muted"> · </span>
            <button onClick={() => folderRef.current?.click()} className="text-acid hover:underline">pick a folder</button>
          </div>

          {deps.length > 0 && (
            <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
              {deps.map((d) => (
                <div key={d.name} className="flex items-center gap-2 rounded px-1.5 py-1 font-mono text-[12px] hover:bg-surface/60">
                  <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
                  <span className="shrink-0 tabular-nums text-faint">{formatSize(d.size)}</span>
                  <button onClick={() => onRemoveDep(d.name)} aria-label={`Remove ${d.name}`}
                    className="shrink-0 text-faint transition-colors hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          )}

          {missing.length > 0 ? (
            <p className="mt-2 font-mono text-[11px] leading-snug text-muted" aria-live="polite">
              {missing.length} referenced {missing.length === 1 ? 'assembly isn’t' : 'assemblies aren’t'} here —{' '}
              <span className="text-ink">{missing.slice(0, 6).join(', ')}{missing.length > 6 ? '…' : ''}</span>. Add them for full coverage.
            </p>
          ) : hasThirdPartyRefs && deps.length > 0 ? (
            <p className="mt-2 font-mono text-[11px] text-acid" aria-live="polite">✓ all references resolved</p>
          ) : null}
        </div>
      )}

      {signingKey ? (
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-faint">signing //</span>
          <span className="min-w-0 flex-1 truncate text-ink">{signingKey.name}</span>
          <button onClick={onRemoveKey} aria-label="Remove signing key" className="text-faint transition-colors hover:text-red-400">✕</button>
        </div>
      ) : (
        <button onClick={() => keyRef.current?.click()}
          className="flex w-full items-center gap-2 font-mono text-[11px] text-faint transition-colors hover:text-muted">
          <span className="text-acid">+</span> sign the output with a strong-name key
          <span className="ml-auto">optional · .snk</span>
        </button>
      )}

      {notice && <p className="font-mono text-[11px] leading-snug text-faint" aria-live="polite">{notice}</p>}

      <input ref={filesRef} type="file" accept=".dll,.exe" multiple hidden
        onChange={(e) => { onAddDeps(e.target.files); e.target.value = '' }} />
      <input ref={(el) => { folderRef.current = el; el?.setAttribute('webkitdirectory', '') }} type="file" multiple hidden
        onChange={(e) => { onAddDeps(e.target.files); e.target.value = '' }} />
      <input ref={keyRef} type="file" accept=".snk" hidden
        onChange={(e) => { onPickKey(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

function ProtectionPicker({ catalog, selected, level, onLevel, onToggle }: {
  catalog: ProtectionInfo[]
  selected: Set<string>
  level: string
  onLevel: (level: string) => void
  onToggle: (name: string) => void
}) {
  if (catalog.length === 0) return null
  const categories = [...new Set(catalog.map((p) => p.category))]
  return (
    <div className="w-full text-left">
      <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-faint">level //</span>
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => onLevel(l)}
            className={`rounded-full border px-3 py-1 transition-colors ${level === l ? 'border-acid text-acid' : 'border-line text-muted hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
        {level === 'Custom' && <span className="rounded-full border border-acid/60 px-3 py-1 text-acid">custom</span>}
        <span className="ml-auto text-faint">{selected.size} on</span>
      </div>
      <p className="mb-3 font-mono text-[11px] leading-snug text-faint">
        {level === 'Custom' ? 'Custom — tweak any protection below.' : LEVEL_DESC[level]}{' '}
        Levels cover .NET-safe protections; Mono-only ones are opt-in.
      </p>

      <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-line bg-void/40 p-4">
        {categories.map((cat) => (
          <div key={cat}>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">{cat}</div>
            <div className="space-y-1">
              {catalog.filter((p) => p.category === cat).map((p) => (
                <ProtectionRow key={p.name} p={p} checked={selected.has(p.name)} onToggle={() => onToggle(p.name)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProtectionRow({ p, checked, onToggle }: { p: ProtectionInfo; checked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface/60">
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${checked ? 'border-acid bg-acid text-void' : 'border-line text-transparent'}`}>✓</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-ink">
          {p.name}
          {!p.stable && <span className="rounded bg-surface px-1.5 py-px text-[10px] uppercase tracking-wide text-faint">experimental</span>}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] leading-snug text-muted">{p.description}</span>
        {p.note && <span className="mt-0.5 block font-mono text-[11px] leading-snug text-faint">⚠ {p.note}</span>}
      </span>
    </button>
  )
}

// Honest progress: a real bar while bytes upload (the only thing we can measure), then an
// indeterminate "obfuscating" state with a live elapsed timer — no fabricated percentage.
function WorkingView({ stage, pct }: { stage: 'uploading' | 'obfuscating'; pct: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (stage !== 'obfuscating') return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250)
    return () => clearInterval(id)
  }, [stage])

  if (stage === 'uploading') {
    return (
      <div className="w-full max-w-xs">
        <div className="mb-2 flex items-center justify-between font-mono text-[12px]">
          <span className="text-muted">uploading</span>
          <span className="tabular-nums text-acid">{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-acid transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="font-mono text-sm text-acid">obfuscating<span className="caret">_</span></div>
      <div className="font-mono text-[11px] tabular-nums text-faint">{formatElapsed(elapsed)} · static analysis, no execution</div>
    </div>
  )
}

const formatElapsed = (s: number): string => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`
}

function Corners() {
  const c = 'absolute h-3 w-3 border-acid/40'
  return (
    <>
      <span className={`${c} left-3 top-3 border-l border-t`} />
      <span className={`${c} right-3 top-3 border-r border-t`} />
      <span className={`${c} bottom-3 left-3 border-b border-l`} />
      <span className={`${c} bottom-3 right-3 border-b border-r`} />
    </>
  )
}

function Glyph() {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" fill="none" className="text-acid">
      <path d="M20 5 L34 13 V27 L20 35 L6 27 V13 Z" stroke="currentColor" strokeWidth="1.25" opacity="0.45" />
      <path d="M20 12.5 v10 m0 0 l-4.5 -4.5 m4.5 4.5 l4.5 -4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
