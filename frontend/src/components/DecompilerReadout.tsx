import { useState } from 'react'
import { type DecompilePreview, getPreview } from '../lib/api'

// Opt-in "what a decompiler sees" reveal, shown in the obfuscate done state. Click to load: a clean C#
// sample of the input on the left, and on the right the obfuscated output — or, when protections broke
// the decompiler, the "defeated" state (a PE-only tree + the real error). Renders nothing unless opted in.
export function DecompilerReadout({ jobId, optedIn }: { jobId: string; optedIn: boolean }) {
  const [view, setView] = useState<'collapsed' | 'loading' | 'ready' | 'unavailable'>('collapsed')
  const [data, setData] = useState<DecompilePreview | null>(null)

  if (!optedIn) return null

  const reveal = async () => {
    setView('loading')
    const p = await getPreview(jobId)
    if (p) { setData(p); setView('ready') } else setView('unavailable')
  }

  if (view === 'collapsed') {
    return (
      <button onClick={reveal} className="mt-2 font-mono text-[12px] text-acid transition-colors hover:underline">
        ▶ show me what a decompiler sees — before → after
      </button>
    )
  }
  if (view === 'loading') {
    return <p className="mt-3 font-mono text-[12px] text-faint">decompiling a sample<span className="caret">_</span></p>
  }
  if (view === 'unavailable' || !data) {
    return <p className="mt-3 font-mono text-[12px] text-faint">Preview didn’t come back this time — your file’s fine, the download is above.</p>
  }

  return (
    <div id="decompiler-readout" className="mt-6 w-full text-left">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">what a decompiler sees</span>
        <span className="font-mono text-[11px] text-faint">before ─▶ after</span>
        {data.protectionsApplied.length > 0 && (
          <span className="ml-auto flex flex-wrap gap-1">
            {data.protectionsApplied.slice(0, 5).map((p) => (
              <span key={p} className="rounded-full border border-line px-1.5 py-px font-mono text-[10px] text-faint">{p}</span>
            ))}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CodePane header="INPUT · clean" tint="clean" code={data.before ?? '// nothing recognizable to decompile in the sample'} />
        {data.outcome === 'defeated'
          ? <DefeatedPane data={data} />
          : <CodePane
              header={data.outcome === 'degraded' ? 'OUTPUT · unreadable' : 'OUTPUT · obfuscated'}
              tint="obf"
              code={data.after ?? ''} />}
      </div>

      <p className="mt-3 font-mono text-[11px] leading-relaxed text-faint">
        A sample of one type — not the whole assembly, which is affected the same way. What a decompiler
        recovers depends on what you picked: renaming alone still decompiles; control-flow &amp; anti-tamper
        degrade it; anti-ILdasm can stop it opening at all.
      </p>
    </div>
  )
}

function CodePane({ header, tint, code }: { header: string; tint: 'clean' | 'obf'; code: string }) {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const border = tint === 'obf' ? 'border-orange-400/25' : 'border-line'
  const text = tint === 'obf' ? 'text-orange-300/90' : 'text-acid/80'
  const bg = tint === 'obf' ? 'bg-orange-400/[0.03]' : 'bg-void/40'
  return (
    <div className={`overflow-hidden rounded-xl border ${border} ${bg}`}>
      <div className={`border-b ${border} px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tint === 'obf' ? 'text-orange-300/80' : 'text-acid/70'}`}>{header}</div>
      <div className="max-h-80 overflow-auto px-3 py-2">
        <pre className={`font-mono text-[11.5px] leading-[1.55] ${text}`}>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-6 shrink-0 select-none text-right text-faint tabular-nums">{i + 1}</span>
              <span className="whitespace-pre">{l || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

// The money shot: the decompiler couldn't read the output. Mimic a real decompiler that can still parse
// the PE container but dead-ends at the managed metadata — everything below Metadata is locked.
function DefeatedPane({ data }: { data: DecompilePreview }) {
  const culprits = data.responsibleProtections.length > 0 ? data.responsibleProtections.join(' + ') : 'the applied protection set'
  const err = data.errorType ? `${data.errorType}: ${data.errorMessage ?? 'no .NET metadata found in image.'}` : 'no .NET metadata found in image.'
  return (
    <div className="hash-target overflow-hidden rounded-xl border border-amber-400/40 bg-amber-400/[0.03]" style={{ ['--hash-flash' as string]: '#fbbf24' }}>
      <div className="flex items-center justify-between border-b border-amber-400/30 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">OUTPUT</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">⛌ decompilation failed</span>
      </div>
      <div className="px-3 py-2 font-mono text-[11.5px] leading-[1.6]">
        <div className="text-muted">▾ 📦 <span className="text-ink">obfuscated.dll</span> <span className="text-faint">[ PE image ]</span></div>
        <div className="pl-4 text-muted">▾ 📁 PE</div>
        <div className="pl-8 text-faint">▸ ▦ DOS Header <span className="float-right">64 B</span></div>
        <div className="pl-8 text-faint">▸ ▦ COFF Header <span className="float-right">20 B</span></div>
        <div className="pl-8 text-faint">▸ ▦ Optional Header (PE32) <span className="float-right">224 B</span></div>
        <div className="pl-8 text-faint">▾ 📁 Sections</div>
        <div className="pl-12 text-faint">.text 0x2000 <span className="text-amber-400/70">RWX</span></div>
        <div className="pl-12 text-faint">.rsrc 0x0800 R--</div>
        <div className="mt-1 pl-4 text-amber-300/90">▸ 🔒 Metadata <span className="text-amber-400">✕ unreadable</span></div>
        <div className="pl-4 text-amber-300/60">▸ 🔒 References ▓▓▓▓▓▓▓▓▓▓▓ <span className="text-faint">locked</span></div>
        <div className="pl-4 text-amber-300/50">▸ 🔒 ▓▓▓▓▓▓▓ · ▓▓▓▓▓ · ▓▓▓▓▓▓▓▓▓▓</div>
        <div className="mt-2 border-t border-line pt-2 text-faint">ILSpy · CSharpDecompiler</div>
        <div className="text-red-400">⛌ {err}</div>
        <div className="text-red-400/80">This assembly exposes a PE wrapper only — the managed body could not be read. 0 types recovered.<span className="text-red-400/50"> _</span></div>
      </div>
      <p className="border-t border-amber-400/30 bg-amber-400/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200/90">
        <span className="font-bold">BitMono defeated the decompiler.</span> {culprits} stripped what ILSpy/dnSpy need —
        they fall back to raw PE headers and the managed code is gone from view. This is the point.
      </p>
    </div>
  )
}
