import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Tooltip } from '../components/Tooltip'
import { useTitle } from '../lib/useTitle'
import {
  getReleases, detectOs, formatSize, shortSha, uniq, unityLabel, cmpUnityLine,
  OS_LABEL, ARCH_LABEL, OS_ORDER, ARCH_ORDER, TFMS, RECOMMENDED_TFM, tfmLabel, tfmChip, isLibTfm,
  type Release, type ReleaseAsset, type Os, type Arch,
} from '../lib/releases'

// One-liner the netstandard chips + library card share, so the "it's a library, not a tool" message
// is worded identically everywhere. The exact phrase ("no executable") mirrors issue #272.
const LIB_NOTE = 'A class library for building a custom BitMono engine or a plugin — not an obfuscator. No executable inside; to protect an app, pick a runnable runtime like .NET 8.'

const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` } as CSSProperties)
const order = <T,>(xs: T[], by: T[]): T[] => by.filter((v) => xs.includes(v))
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

type Path = 'cli' | 'unity' | 'nuget'
type UnityFormat = 'unitypackage' | 'upm'

export default function Download() {
  useTitle('Download BitMono')
  // Shareable selection: every pick seeds from the query string, and a mirror effect below keeps the
  // URL current — the address bar is always a link to this exact version/runtime/OS/arch.
  const [init] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)))
  const [releases, setReleases] = useState<Release[]>([])
  const [ver, setVer] = useState('')
  const [loading, setLoading] = useState(true)
  const [path, setPath] = useState<Path>(init.path === 'unity' || init.path === 'nuget' ? (init.path as Path) : 'cli')

  // CLI selections
  const [tfm, setTfm] = useState(init.tfm ?? RECOMMENDED_TFM)
  const [os, setOs] = useState<Os>((init.os as Os) ?? 'win')
  const [arch, setArch] = useState<Arch>((init.arch as Arch) ?? 'x64')
  const [showOsArch, setShowOsArch] = useState(Boolean(init.os || init.arch))
  const [showAll, setShowAll] = useState(false)

  // Unity selections
  const [unityMajor, setUnityMajor] = useState(init.unity ?? '')
  const [unityFormat, setUnityFormat] = useState<UnityFormat>(init.format === 'upm' ? 'upm' : 'unitypackage')

  useEffect(() => {
    if (!init.os) setOs(detectOs()) // a shared link's OS wins over detection
    getReleases().then((r) => {
      if (r) {
        setReleases(r.releases)
        setVer(init.v && r.releases.some((x) => x.version === init.v) ? init.v : r.latest)
      }
      setLoading(false)
    })
  }, [])

  // The selected release drives everything below; default to (and fall back to) the latest.
  const rel = releases.find((r) => r.version === ver) ?? releases[0] ?? null
  const latest = releases[0]?.version ?? ''
  const assets = rel?.assets ?? []
  const cli = assets.filter((a) => a.kind === 'cli')

  // Clamp every selection to something that actually resolves, so the download card is never a dead end:
  // pick the recommended/first available at each level, falling back down the chain.
  const cliTfms = TFMS.map((t) => t.id).filter((id) => cli.some((a) => a.tfm === id))
  // Auto-selection must never land on a netstandard (library) build — only an explicit click / shared
  // link does. So the final fallback is the first *runnable* TFM, not just cliTfms[0] (issue #272).
  const runnableTfms = cliTfms.filter((id) => !isLibTfm(id))
  const curTfm = cliTfms.includes(tfm) ? tfm
    : cliTfms.includes(RECOMMENDED_TFM) ? RECOMMENDED_TFM
    : (runnableTfms[0] ?? cliTfms[0] ?? '')
  const isLib = isLibTfm(curTfm)
  // Where "switch to a runnable build" sends you: net8.0 if present, else the first runnable TFM.
  const switchTfm = cliTfms.includes(RECOMMENDED_TFM) ? RECOMMENDED_TFM : (runnableTfms[0] ?? '')
  const cliOss = order(uniq(cli.filter((a) => a.tfm === curTfm).map((a) => a.os as Os)), OS_ORDER)
  const curOs = cliOss.includes(os) ? os : (cliOss[0] ?? 'win')
  const cliArchs = order(uniq(cli.filter((a) => a.tfm === curTfm && a.os === curOs).map((a) => a.arch as Arch)), ARCH_ORDER)
  const curArch = cliArchs.includes(arch) ? arch : cliArchs.includes('x64') ? 'x64' : (cliArchs[0] ?? 'x64')
  const cliAsset = cli.find((a) => a.tfm === curTfm && a.os === curOs && a.arch === curArch) ?? null

  const unityPkg = assets.filter((a) => a.kind === 'unityPackage')
  const unityUpm = assets.filter((a) => a.kind === 'unityUpm')
  const unityMajors = uniq([...unityPkg, ...unityUpm].map((a) => a.unityMajor as string)).sort(cmpUnityLine)
  const curMajor = unityMajors.includes(unityMajor) ? unityMajor : (unityMajors[unityMajors.length - 1] ?? '')
  const unityAsset = (unityFormat === 'upm' ? unityUpm : unityPkg).find((a) => a.unityMajor === curMajor) ?? null

  // Mirror the effective (clamped) picks into the query string — replaceState, so chip clicks don't spam history.
  useEffect(() => {
    if (!rel) return
    const p = new URLSearchParams({ v: rel.version, path })
    // A library build has no OS/arch — writing them would produce a dead link. Emit tfm only.
    if (path === 'cli' && curTfm && isLib) p.set('tfm', curTfm)
    else if (path === 'cli' && curTfm) { p.set('tfm', curTfm); p.set('os', curOs); p.set('arch', curArch) }
    if (path === 'unity' && curMajor) { p.set('unity', curMajor); p.set('format', unityFormat) }
    history.replaceState(null, '', `${location.pathname}?${p}${location.hash}`)
  }, [rel, path, curTfm, curOs, curArch, curMajor, unityFormat])

  // Deep-link "assembly" effect: when arriving on a shared link (selection in the query), sweep a border
  // trace around each chosen selector chip in order, then land the normal target-lock on the file card —
  // so the page visibly reconstructs the choice box by box. Runs once, only for shared links.
  const cascadeRan = useRef(false)
  useEffect(() => {
    if (loading || cascadeRan.current) return
    if (!(init.tfm || init.os || init.arch || init.unity)) return // bare visit → no theatrics
    const card = document.getElementById('download')
    if (!card) return
    cascadeRan.current = true

    const chips = [1, 2, 3]
      .map((n) => document.querySelector<HTMLElement>(`[data-trace="${n}"]`))
      .filter((el): el is HTMLElement => el != null)
    // If the URL literally carries #download, Layout's generic lock would fire immediately and jump the
    // queue — pull the id while the chips trace, restore it so Layout locks the card last.
    const viaHash = decodeURIComponent(window.location.hash) === '#download'
    if (viaHash) card.removeAttribute('id')

    const timers: number[] = []
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    chips.forEach((el, i) => {
      timers.push(window.setTimeout(() => {
        el.classList.add('trace-box')
        timers.push(window.setTimeout(() => el.classList.remove('trace-box'), 760))
      }, 260 + i * 360))
    })
    timers.push(window.setTimeout(() => {
      if (viaHash) {
        card.setAttribute('id', 'download') // Layout's poll now finds it and lands the lock
      } else {
        card.classList.add('hash-target')
        timers.push(window.setTimeout(() => card.classList.remove('hash-target'), 2400))
      }
    }, 260 + chips.length * 360 + 140))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      {/* z-30: every `.rise` section below settles at transform:translateY(0) — a permanent stacking context —
          so without lifting the header the version dropdown renders behind (and can't be clicked through). */}
      <section className="relative z-30 pt-12 text-center md:pt-16">
        <h1 className="rise font-display text-4xl font-extrabold tracking-tight text-ink md:text-5xl" style={d(0)}>
          Download <span className="text-acid acid-glow">BitMono</span>
        </h1>
        <p className="rise mx-auto mt-4 max-w-lg font-mono text-sm leading-relaxed text-muted" style={d(80)}>
          The real engine — the same build that ships on NuGet and runs in CI. Answer one question, get the
          exact file for your setup.
        </p>
        <div className="rise mt-4 flex justify-center" style={d(140)}>
          {loading ? (
            <span className="font-mono text-[12px] text-faint">—</span>
          ) : rel ? (
            <VersionPicker releases={releases} value={rel.version} latest={latest} onChange={setVer} />
          ) : (
            <a href="https://github.com/bitmono-project/BitMono/releases/latest" target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted hover:text-acid">
              releases on GitHub ↗
            </a>
          )}
        </div>
      </section>

      {!loading && !rel && (
        <p className="mt-8 rounded-xl border border-line bg-surface/30 p-4 text-center font-mono text-[13px] text-muted">
          Couldn't reach the release feed. Grab the latest build straight from{' '}
          <a href="https://github.com/bitmono-project/BitMono/releases/latest" target="_blank" rel="noreferrer" className="text-acid hover:underline">GitHub Releases ↗</a>.
        </p>
      )}

      <section className="rise mt-10" style={d(200)}>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">What are you protecting?</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <PathCard on={path === 'cli'} onClick={() => setPath('cli')} icon={<DotNetLogo />}
            title=".NET app / .dll" sub="Command-line tool for any .exe or .dll — zip or dotnet tool." />
          <PathCard on={path === 'unity'} onClick={() => setPath('unity')} icon={<UnityMark />}
            title="Unity game" sub="Drop-in editor package — protect your build in Unity." />
          <PathCard on={path === 'nuget'} onClick={() => setPath('nuget')} icon={<NuGetLogo />}
            title="Embed · CI" sub="GitHub Action, .NET tool or NuGet — obfuscate in your pipeline." />
        </div>
      </section>

      <section className="mt-8">
        {path === 'cli' && (
          <div className="space-y-5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Runtime you'll run it on</span>
                {cliTfms.length > 0 && <HelpMeChoose switchTfm={switchTfm} libTfm={cliTfms.find(isLibTfm) ?? null} onPick={setTfm} />}
              </div>
              <p className="mb-2.5 font-mono text-[11px] leading-relaxed text-faint">
                Match the .NET your app runs on. The <span className="text-muted">netstd</span> builds are libraries for
                extending BitMono — not obfuscators.
              </p>
              {cliTfms.length === 0 ? (
                <Skeleton />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {cliTfms.map((id) => (
                    <Chip key={id} on={id === curTfm} onClick={() => setTfm(id)} title={isLibTfm(id) ? LIB_NOTE : tfmLabel(id)} trace={1}>
                      {tfmChip(id)}
                      {id === RECOMMENDED_TFM ? <span className="ml-1 text-[9px] text-acid/80">LTS</span> : null}
                      {isLibTfm(id) ? <span className="ml-1 text-[10px] text-faint">ⓘ</span> : null}
                    </Chip>
                  ))}
                </div>
              )}

              {/* OS/arch only apply to a runnable build — a library has neither. */}
              {cliTfms.length > 0 && !isLib && (!showOsArch ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[12px] text-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-acid/70" />
                  detected:&nbsp;<span className="text-muted">{OS_LABEL[curOs]} · {ARCH_LABEL[curArch]}</span>
                  <button onClick={() => setShowOsArch(true)} className="underline-offset-2 transition-colors hover:text-acid hover:underline">change</button>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  <ChipRow label="OS">
                    {cliOss.map((o) => <Chip key={o} on={o === curOs} onClick={() => setOs(o)} trace={2}>{OS_LABEL[o]}</Chip>)}
                  </ChipRow>
                  <ChipRow label="Arch">
                    {cliArchs.map((a) => <Chip key={a} on={a === curArch} onClick={() => setArch(a)} trace={3}>{ARCH_LABEL[a]}</Chip>)}
                  </ChipRow>
                </div>
              ))}
            </div>

            {cliAsset ? <DownloadCard asset={cliAsset} library={isLib ? { switchLabel: tfmChip(switchTfm), onSwitch: () => setTfm(switchTfm) } : undefined} /> : cliTfms.length > 0 ? (
              <p className="font-mono text-[12px] text-muted">No build for that combination — try x64.</p>
            ) : null}

            {/* The dotnet-tool one-liner runs the obfuscator — irrelevant for a library build. */}
            {cliTfms.length > 0 && !isLib && (
              <div className="space-y-2">
                <div className="font-mono text-[11px] text-faint">Prefer a one-liner? Install as a .NET global tool —</div>
                <CommandBox cmd="dotnet tool install --global BitMono.GlobalTool" />
                <div className="font-mono text-[11px] leading-relaxed text-faint">
                  then <span className="text-muted">bitmono.console -f MyApp.dll --preset Maximum</span>
                </div>
              </div>
            )}

            <AntivirusNote asset={cliAsset} />

            {cli.length > 0 && (
              <div>
                <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-2 font-mono text-[12px] text-faint transition-colors hover:text-muted">
                  <span className="text-acid">{showAll ? '▾' : '▸'}</span> all {cli.length} CLI builds
                </button>
                {showAll && <AllBuilds assets={cli} />}
              </div>
            )}
          </div>
        )}

        {path === 'unity' && (
          <div className="space-y-5">
            {unityMajors.length === 0 ? <Skeleton /> : (
              <>
                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Unity version</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {unityMajors.map((m) => (
                      <Chip key={m} on={m === curMajor} onClick={() => setUnityMajor(m)} trace={1}>{unityLabel(m)}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Format</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip on={unityFormat === 'unitypackage'} onClick={() => setUnityFormat('unitypackage')} title="Double-click to import into the editor" trace={2}>.unitypackage</Chip>
                    <Chip on={unityFormat === 'upm'} onClick={() => setUnityFormat('upm')} title="Add via the Package Manager (tarball)" trace={2}>UPM · .tgz</Chip>
                  </div>
                </div>
                {unityAsset
                  ? <DownloadCard asset={unityAsset} />
                  : <p className="font-mono text-[12px] text-muted">No {unityFormat === 'upm' ? 'UPM' : '.unitypackage'} build for that Unity version.</p>}
                <AntivirusNote asset={unityAsset} />
              </>
            )}
          </div>
        )}

        {path === 'nuget' && <CiCard version={rel?.version ?? ''} />}
      </section>
    </main>
  )
}

// Version selector for the download page. Collapses to plain text when there's only one release to pick
// (the common case today), and opens a themed dropdown once older versions exist. Latest is badged; each
// row links nowhere — selecting swaps the whole chooser to that version's assets client-side.
function VersionPicker({ releases, value, latest, onChange }: {
  releases: Release[]; value: string; latest: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const sel = releases.find((r) => r.version === value)
  if (!sel) return null
  const many = releases.length > 1

  return (
    <div ref={ref} className="relative flex items-center gap-2 font-mono text-[12px]">
      {many ? (
        <button onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-muted transition-colors hover:border-acid/40 hover:text-acid">
          v{sel.version}
          {sel.version === latest && <span className="text-[9px] text-acid/80">latest</span>}
          <span className={`text-acid transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
      ) : (
        <span className="text-muted">v{sel.version}</span>
      )}
      <span className="text-faint">
        released {fmtDate(sel.publishedAt)} ·{' '}
        <a href={sel.htmlUrl} target="_blank" rel="noreferrer" className="text-muted transition-colors hover:text-acid hover:underline">notes ↗</a>
      </span>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-void/95 p-1 text-left shadow-xl backdrop-blur">
          {releases.map((r) => (
            <button key={r.version} onClick={() => { onChange(r.version); setOpen(false) }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors ${r.version === value ? 'bg-surface/60 text-acid' : 'text-muted hover:bg-surface/40 hover:text-ink'}`}>
              <span>v{r.version}{r.version === latest && <span className="ml-1.5 text-[9px] text-acid/70">latest</span>}</span>
              <span className="text-faint">{fmtDate(r.publishedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PathCard({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; sub: string }) {
  return (
    <button onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-colors ${on ? 'border-acid bg-surface/60' : 'border-line bg-surface/25 hover:border-acid/40'}`}>
      <div className={on ? 'text-acid' : 'text-muted group-hover:text-ink'}>{icon}</div>
      <div className="mt-3 font-display text-base font-bold text-ink">{title}</div>
      <div className="mt-1 font-mono text-[12px] leading-snug text-muted">{sub}</div>
    </button>
  )
}

// trace: when this chip is the selected one, tag it data-trace={n} so the deep-link cascade can sweep
// its border in order (1 runtime → 2 os → 3 arch).
function Chip({ on, onClick, title, trace, children }: { on: boolean; onClick: () => void; title?: string; trace?: number; children: ReactNode }) {
  const btn = (
    <button onClick={onClick} data-trace={on && trace ? trace : undefined}
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs transition-colors ${on ? 'border-acid text-acid' : 'border-line text-muted hover:text-ink'}`}>
      {children}
    </button>
  )
  return title ? <Tooltip label={title}>{btn}</Tooltip> : btn
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-10 font-mono text-[11px] uppercase tracking-wider text-faint">{label}</span>
      {children}
    </div>
  )
}

// library (set only for a netstandard build): reframes the card as "a library, not a tool" — the
// switch action jumps to a runnable runtime, and the literal download is demoted to a quiet link so
// the plugin/engine authors who genuinely want the .dll can still grab it. (issue #272)
function DownloadCard({ asset, library }: { asset: ReleaseAsset; library?: { switchLabel: string; onSwitch: () => void } }) {
  const [copied, setCopied] = useState<'sha' | 'link' | null>(null)
  const copy = (what: 'sha' | 'link', text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
  }
  const meta = asset.kind !== 'cli'
    ? `Unity ${asset.unityVersion} · ${asset.format === 'upm' ? 'UPM package' : '.unitypackage'}`
    : library
      ? `${tfmLabel(asset.tfm ?? '')} · class library`
      : `${tfmLabel(asset.tfm ?? '')} · ${OS_LABEL[asset.os as Os]} · ${ARCH_LABEL[asset.arch as Arch]}`

  return (
    // id="download": shared links carry #download so the target lock lands on this exact build.
    <div id="download" className={`relative overflow-hidden rounded-2xl border bg-surface/40 p-6 ${library ? 'border-amber-400/40' : 'border-acid/30'}`}>
      <Corners />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {library && <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400">⚑ library · no executable</div>}
          <Tooltip label={asset.name} className="max-w-full">
            <span className="min-w-0 truncate font-mono text-sm text-ink">{asset.name}</span>
          </Tooltip>
          <div className="mt-1 font-mono text-[12px] text-muted">
            {meta} · {formatSize(asset.size)}
            {asset.downloads > 0 && <span className="text-faint"> · {asset.downloads.toLocaleString()} downloads</span>}
          </div>
        </div>
        {library ? (
          <button onClick={library.onSwitch} className="btn-acid shrink-0">switch to {library.switchLabel} →</button>
        ) : (
          <a href={asset.downloadUrl} download className="btn-acid shrink-0">Download ↓</a>
        )}
      </div>

      {library && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 font-mono text-[12px] leading-relaxed text-amber-200/90">
          <span aria-hidden>⚙</span>
          <span>
            {LIB_NOTE}{' '}
            <a href={asset.downloadUrl} download className="whitespace-nowrap text-faint transition-colors hover:text-amber-300">still want the library? download it anyway ↓</a>
          </span>
        </p>
      )}

      {asset.sha256 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 font-mono text-[11px]">
          <span className="text-faint">sha256</span>
          <span className="text-ink/80">{shortSha(asset.sha256)}</span>
          <button onClick={() => copy('sha', asset.sha256 as string)} className="text-faint transition-colors hover:text-acid">
            {copied === 'sha' ? '✓ copied' : '⧉ copy'}
          </button>
          <Tooltip label="Copy a link to this exact build — version, runtime, OS and arch included">
            <button onClick={() => copy('link', `${location.origin}${location.pathname}${location.search}#download`)}
              className="text-faint transition-colors hover:text-acid">
              {copied === 'link' ? '✓ copied' : '⧉ share'}
            </button>
          </Tooltip>
          <VirusTotal asset={asset} />
        </div>
      )}
    </div>
  )
}

// "help me choose" — the affordance the user asked for. A tiny popover: pick what you're doing and it
// selects the right runtime, so nobody has to know net8.0 from netstandard. Mirrors VersionPicker's shell.
function HelpMeChoose({ switchTfm, libTfm, onPick }: { switchTfm: string; libTfm: string | null; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const pick = (id: string) => { onPick(id); setOpen(false) }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="font-mono text-[11px] text-faint transition-colors hover:text-acid">
        not sure? · help me choose →
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-line bg-void/95 p-1.5 text-left shadow-xl backdrop-blur">
          <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">What are you doing?</div>
          <HelpOption title="Protecting my own app" sub="Obfuscate an .exe or .dll I built" onClick={() => pick(switchTfm)} />
          {libTfm && <HelpOption title="Building on top of BitMono" sub="A plugin or my own engine (library)" onClick={() => pick(libTfm)} />}
          <HelpOption title="Not sure what my app targets" sub="Check the .csproj <TargetFramework>, or take .NET 8" onClick={() => pick(switchTfm)} />
        </div>
      )}
    </div>
  )
}

function HelpOption({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface/50">
      <div className="font-mono text-[12px] text-ink">→ {title}</div>
      <div className="font-mono text-[11px] text-faint">{sub}</div>
    </button>
  )
}

function AntivirusNote({ asset }: { asset?: ReleaseAsset | null }) {
  // Deep-link to this build's VirusTotal analysis (file report once scanned, else a hash search); only fall
  // back to VT's home if no asset resolved — then there's no "file above" to check anyway.
  const href = asset?.sha256 ? vtUrl(asset) : 'https://www.virustotal.com'
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-void/40 p-3.5 font-mono text-[11px] leading-relaxed text-muted">
      <span className="mt-px text-acid">⚠</span>
      <span>
        Obfuscators and packers trip antivirus <em className="text-ink/80 not-italic">by design</em> — a Defender flag
        isn't proof of anything. Verify the SHA-256 above, and check the file on{' '}
        <a href={href} target="_blank" rel="noreferrer" className="text-acid hover:underline">VirusTotal</a>{' '}
        if you're unsure. BitMono is open-source and built in public CI.
      </span>
    </div>
  )
}

function AllBuilds({ assets }: { assets: ReleaseAsset[] }) {
  const rows = [...assets].sort((a, b) =>
    (a.tfm ?? '').localeCompare(b.tfm ?? '') || (a.os ?? '').localeCompare(b.os ?? '') || (a.arch ?? '').localeCompare(b.arch ?? ''),
  )
  return (
    <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-line">
      <table className="w-full border-collapse font-mono text-[12px]">
        <thead className="sticky top-0 bg-void">
          <tr className="border-b border-line text-left text-faint">
            <th className="px-3 py-2 font-normal">runtime</th>
            <th className="px-3 py-2 font-normal">os · arch</th>
            <th className="px-3 py-2 text-right font-normal">size</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.downloadUrl} className="border-b border-line/50 last:border-0 hover:bg-surface/40">
              <td className="whitespace-nowrap px-3 py-1.5 text-ink">{tfmChip(a.tfm ?? '')}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-muted">{OS_LABEL[a.os as Os]} · {ARCH_LABEL[a.arch as Arch]}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-faint">{formatSize(a.size)}</td>
              <td className="px-3 py-1.5 text-right">
                <a href={a.downloadUrl} download className="text-acid transition-colors hover:underline">↓</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Three ways to obfuscate in a pipeline instead of downloading a binary: the GitHub Action (CI), the .NET
// global tool, and NuGet (MSBuild / engine embedding). The action is versioned by the repo's release tags,
// so we pin it to the current release.
function CiCard({ version }: { version: string }) {
  const tag = version || 'latest'
  const action = `- uses: sunnamed434/BitMono@${tag}\n  with:\n    file: bin/Release/net8.0/MyApp.dll\n    preset: Maximum`
  const pkgs = ['BitMono.Integration', 'BitMono.Core', 'BitMono.Obfuscation', 'BitMono.Runtime']
  return (
    <div className="space-y-6 rounded-2xl border border-line bg-surface/30 p-6">
      <Section label="GitHub Action · CI" body="Build, then point the action at your artifact — no source or .csproj changes. Inputs map 1:1 to the CLI.">
        <CodeBlock text={action} />
      </Section>
      <Section label=".NET global tool" body="Install once, run anywhere — locally or in CI.">
        <CommandBox cmd="dotnet tool install --global BitMono.GlobalTool" />
      </Section>
      <Section label="MSBuild · NuGet" body="Wire it into your build, or reference the engine to build your own tooling on top of it.">
        <CommandBox cmd="dotnet add package BitMono.Integration" />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[12px] text-faint">
          {pkgs.map((p) => (
            <a key={p} href={`https://www.nuget.org/packages/${p}`} target="_blank" rel="noreferrer" className="transition-colors hover:text-acid">{p} ↗</a>
          ))}
          <a href="https://docs.bitmono.dev" target="_blank" rel="noreferrer" className="transition-colors hover:text-acid">docs ↗</a>
        </div>
      </Section>
    </div>
  )
}

function Section({ label, body, children }: { label: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{label}</div>
      <p className="mb-3 font-mono text-[13px] leading-relaxed text-muted">{body}</p>
      {children}
    </div>
  )
}

// VirusTotal link that never 404s: the live /gui/file report only exists once our scan job has submitted the
// file, so deep-link there only when the scan is "done"; otherwise fall back to a hash search. Shared with the
// AntivirusNote so both point at the same build. See VirusTotalScanner on the backend.
function vtUrl(asset: ReleaseAsset): string {
  const path = asset.vt?.status === 'done' ? 'gui/file' : 'gui/search'
  return `https://www.virustotal.com/${path}/${asset.sha256}`
}

function VirusTotal({ asset }: { asset: ReleaseAsset }) {
  const vt = asset.vt
  if (vt?.status === 'done') {
    const clean = vt.flagged === 0
    return (
      <Tooltip label="VirusTotal report" className="ml-auto">
        <a href={vtUrl(asset)} target="_blank" rel="noreferrer"
          className={`transition-colors hover:underline ${clean ? 'text-acid' : 'text-amber-400'}`}>
          {clean ? '✓' : '⚠'} {vt.flagged}/{vt.total} VirusTotal ↗
        </a>
      </Tooltip>
    )
  }
  return (
    <a href={vtUrl(asset)} target="_blank" rel="noreferrer"
      className="ml-auto text-faint transition-colors hover:text-acid">
      {vt?.status === 'pending' ? 'VirusTotal · scanning…' : 'VirusTotal ↗'}
    </a>
  )
}

function CommandBox({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-void/60 px-3 py-2 font-mono text-[13px]">
      <span className="text-faint">$</span>
      <span className="min-w-0 flex-1 truncate text-ink">{cmd}</span>
      <button aria-label="Copy command"
        onClick={() => navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})}
        className="shrink-0 text-faint transition-colors hover:text-acid">{copied ? '✓' : '⧉'}</button>
    </div>
  )
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative rounded-lg border border-line bg-void/60 p-3">
      <button aria-label="Copy snippet"
        onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})}
        className="absolute right-2 top-2 font-mono text-[11px] text-faint transition-colors hover:text-acid">{copied ? '✓' : '⧉'}</button>
      <pre className="overflow-x-auto pr-6 font-mono text-[12px] leading-relaxed text-ink/90"><code>{text}</code></pre>
    </div>
  )
}

// Official brand marks (exact simple-icons paths — not redrawn), tinted for the dark UI. Used nominatively to
// signal compatibility. Unity's trademark is stricter, so its card uses a neutral cube, not the Unity logo.
function DotNetLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="#9B7BEA" d="M24 8.77h-2.468v7.565h-1.425V8.77h-2.462V7.53H24zm-6.852 7.565h-4.821V7.53h4.63v1.24h-3.205v2.494h2.953v1.234h-2.953v2.604h3.396zm-6.708 0H8.882L4.78 9.863a2.896 2.896 0 0 1-.258-.51h-.036c.032.189.048.592.048 1.21v5.772H3.157V7.53h1.659l3.965 6.32c.167.261.275.442.323.54h.024c-.04-.233-.06-.629-.06-1.185V7.529h1.372zm-8.703-.693a.868.829 0 0 1-.869.829.868.829 0 0 1-.868-.83.868.829 0 0 1 .868-.828.868.829 0 0 1 .869.829Z" />
    </svg>
  )
}

function NuGetLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="#4C9BD6" d="M1.998.342a1.997 1.997 0 1 0 0 3.995 1.997 1.997 0 0 0 0-3.995zm9.18 4.34a6.156 6.156 0 0 0-6.153 6.155v6.667c0 3.4 2.756 6.154 6.154 6.154h6.667c3.4 0 6.154-2.755 6.154-6.154v-6.667a6.154 6.154 0 0 0-6.154-6.155zm-1.477 2.8a2.496 2.496 0 1 1 0 4.993 2.496 2.496 0 0 1 0-4.993zm7.968 6.16a3.996 3.996 0 1 1-.002 7.992 3.996 3.996 0 0 1 .002-7.992z" />
    </svg>
  )
}

// Neutral isometric cube (generic 3D-box mark) — deliberately NOT Unity's logo.
function UnityMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.6l8.2 4.7v9.4L12 21.4 3.8 16.7V7.3z" />
      <path d="M12 12l8.2-4.7M12 12v9.4M12 12L3.8 7.3" />
    </svg>
  )
}

function Skeleton() {
  return <div className="h-8 w-64 animate-pulse rounded-full bg-line/60" />
}

function Corners() {
  const c = 'absolute h-3 w-3 border-acid/40'
  return (
    <>
      <span className={`${c} left-2.5 top-2.5 border-l border-t`} />
      <span className={`${c} right-2.5 top-2.5 border-r border-t`} />
      <span className={`${c} bottom-2.5 left-2.5 border-b border-l`} />
      <span className={`${c} bottom-2.5 right-2.5 border-b border-r`} />
    </>
  )
}
