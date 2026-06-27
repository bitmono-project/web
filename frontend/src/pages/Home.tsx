import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { ObfuscatePanel } from '../components/ObfuscatePanel'
import { TextScramble } from '../components/TextScramble'
import { getEngineVersion } from '../lib/api'

const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` } as CSSProperties)

// Real BitMono protections (verified against src/BitMono.Protections). Web MVP enables
// the first three; the rest ship in the engine and arrive on the site with presets.
const PROTECTIONS = [
  'FullRenamer', 'NoNamespaces', 'StringsEncryption', 'AntiDe4dot', 'AntiILdasm',
  'CallToCalli', 'DotNetHook', 'AntiDebugBreakpoints', 'BillionNops', 'UnmanagedString',
]

const PILLARS: [string, string, string][] = [
  ['01', 'Static, never run', 'BitMono rewrites the IL with AsmResolver. Your assembly is analyzed, never executed — safe by construction.'],
  ['02', 'Nothing is kept', 'Your upload is deleted the instant it’s obfuscated, and the result is wiped the moment you download it.'],
  ['03', 'The real engine', 'The same BitMono that ships on NuGet and runs in CI pipelines — not a watered-down web port.'],
]

export default function Home() {
  const [version, setVersion] = useState('')
  useEffect(() => { getEngineVersion().then(setVersion) }, [])
  return (
    <main className="mx-auto max-w-6xl px-6">
      <section className="pt-14 pb-10 text-center md:pt-24">
        <a href="https://github.com/bitmono-project" target="_blank" rel="noopener noreferrer" className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition-colors hover:border-acid/40 hover:text-ink" style={d(0)}>
          <span className="h-1.5 w-1.5 rounded-full bg-acid" /> free &amp; open-source ↗
        </a>

        <h1 className="rise mx-auto mt-7 max-w-4xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl" style={d(80)}>
          Obfuscate your <span className="text-acid acid-glow"><TextScramble text=".NET" durationMs={1200} /></span>
          <br className="hidden sm:block" /> right in the browser.
        </h1>

        <p className="rise mx-auto mt-6 max-w-xl font-mono text-sm leading-relaxed text-muted md:text-base" style={d(160)}>
          Drop a .dll — get it back with renamed symbols, stripped namespaces
          and encrypted strings. No install, nothing stored.
        </p>
      </section>

      <section id="obfuscate" className="rise scroll-mt-24 pb-10" style={d(240)}>
        <ObfuscatePanel />
        <p className="mt-4 text-center font-mono text-[11px] text-faint">
          engine · BitMono{' '}
          {version ? (
            <a
              href={`https://github.com/bitmono-project/BitMono/releases/tag/${version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-acid hover:underline"
            >
              v{version}
            </a>
          ) : '—'}
        </p>
      </section>

      <section className="rise border-y border-line py-5" style={d(320)}>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-faint">
          <span className="text-muted">protections //</span>
          {PROTECTIONS.map((p) => (
            <span key={p} className="transition-colors hover:text-acid">{p}</span>
          ))}
        </div>
      </section>

      <section className="my-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {PILLARS.map(([n, t, body]) => (
          <div key={n} className="bg-void p-7">
            <div className="font-mono text-xs text-acid">{n}</div>
            <h3 className="mt-3 font-display text-lg font-bold text-ink">{t}</h3>
            <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
