import { useCallback, useEffect, useRef, useState } from 'react'
import { startObfuscation, waitForResult, downloadUrl, getProtections, type ProtectionInfo } from '../lib/api'

type Phase = 'idle' | 'ready' | 'working' | 'done' | 'error'

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
    if (!/\.(dll|exe)$/i.test(f.name)) return fail('Only .dll / .exe assemblies.')
    if (f.size > 30 * 1024 * 1024) return fail('Assembly is over 30 MB.')
    setFile(f)
    setError('')
    setPhase('ready')
  }

  const fail = (msg: string) => {
    setError(msg)
    setPhase('error')
  }

  const run = useCallback(async () => {
    if (!file) return
    setPhase('working')
    setError('')
    try {
      const id = await startObfuscation(file, [...selected], agreed)
      const status = await waitForResult(id)
      if (status === 'done') {
        setResult({ id, name: file.name })
        setPhase('done')
      } else if (status === 'failed') {
        fail('Obfuscation failed — try a lower level, or the assembly may need its dependencies alongside it.')
      } else {
        fail('Timed out waiting for the result.')
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something broke.')
    }
  }, [file, selected, agreed])   // agreed MUST be here — without it run() sends a stale agree=false

  const reset = () => {
    setPhase('idle')
    setFile(null)
    setResult(null)
    setError('')
  }

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
              <div className="mt-1 font-mono text-[13px] text-muted">or click to browse — .dll / .exe, up to 30&nbsp;MB</div>
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

            {phase === 'working' && (
              <div className="font-mono text-sm text-acid">
                scrambling<span className="caret">_</span>
              </div>
            )}

            {phase === 'done' && result && (
              <div className="flex flex-col items-center gap-3">
                <div className="font-mono text-sm text-acid">✓ protected · input wiped</div>
                <a href={downloadUrl(result.id, result.name)} className="btn-acid" download={result.name}>download ↓</a>
              </div>
            )}
          </div>
        )}

        <input ref={inputRef} type="file" accept=".dll,.exe" hidden onChange={(e) => pick(e.target.files?.[0])} />
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
