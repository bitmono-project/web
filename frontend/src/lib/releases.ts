// Data + helpers for the guided download chooser. The backend (/api/releases/latest) fetches the latest
// GitHub release, parses every asset into a structured shape, and hands back stable /download/… proxy URLs
// plus running download counts. The client stays dumb: it just filters that list by the user's picks.

export type ReleaseAssetKind = 'cli' | 'unityPackage' | 'unityUpm'
export type Os = 'win' | 'linux' | 'osx'
export type Arch = 'x64' | 'arm64' | 'x86'

export interface ReleaseAsset {
  kind: ReleaseAssetKind
  name: string
  size: number
  sha256: string | null
  downloadUrl: string
  downloads: number
  tfm: string | null
  os: string | null
  arch: string | null
  unityVersion: string | null
  unityMajor: string | null
  format: string | null
  vt: { status: string; flagged: number; total: number } | null
}

export interface Release {
  version: string
  tag: string
  publishedAt: string
  htmlUrl: string
  assets: ReleaseAsset[]
}

export interface ReleasesResponse {
  latest: string
  releases: Release[]   // newest first; releases[0] is the latest
}

// Every downloadable release (>= 0.43.0), newest first — one fetch powers both the version picker and the
// per-version asset chooser, so switching versions is instant and needs no extra round-trip.
export async function getReleases(): Promise<ReleasesResponse | null> {
  try {
    const res = await fetch('/api/releases')
    if (!res.ok) return null
    return (await res.json()) as ReleasesResponse
  } catch {
    return null
  }
}

// Browser OS detection — good enough to pre-select, always overridable (rustup does the same). Arch can't
// be read reliably from a browser, so we default to x64 and let the user switch.
export function detectOs(): Os {
  const s = `${navigator.userAgent} ${navigator.platform ?? ''}`.toLowerCase()
  if (s.includes('win')) return 'win'
  if (s.includes('mac') || s.includes('darwin') || s.includes('iphone') || s.includes('ipad')) return 'osx'
  return 'linux'
}

export const OS_LABEL: Record<Os, string> = { win: 'Windows', linux: 'Linux', osx: 'macOS' }
export const ARCH_LABEL: Record<Arch, string> = { x64: 'x64', arm64: 'ARM64', x86: 'x86' }

// Ordered TFM catalogue: full label (for the resolved card / tooltip) + compact chip label + optional badge.
// Only TFMs actually present in the release are shown; this controls their order and how they read. net8.0 is
// the recommended default (current LTS, tiny framework-dependent build — the common case for a .NET dev).
// `lib` marks a class-library target (netstandard): it's for building a custom BitMono engine or a
// plugin — NOT a runnable obfuscator, there's no executable inside. See GitHub issue #272.
export const TFMS: { id: string; label: string; chip: string; note?: string; lib?: boolean }[] = [
  { id: 'net10.0', label: '.NET 10', chip: '.NET 10' },
  { id: 'net9.0', label: '.NET 9', chip: '.NET 9' },
  { id: 'net8.0', label: '.NET 8', chip: '.NET 8', note: 'LTS' },
  { id: 'net7.0', label: '.NET 7', chip: '.NET 7' },
  { id: 'net6.0', label: '.NET 6', chip: '.NET 6' },
  { id: 'net462', label: '.NET Framework 4.6.2', chip: '.NET FW 4.6.2' },
  { id: 'netstandard2.0', label: '.NET Standard 2.0', chip: 'netstd 2.0', lib: true },
  { id: 'netstandard2.1', label: '.NET Standard 2.1', chip: 'netstd 2.1', lib: true },
]
export const RECOMMENDED_TFM = 'net8.0'

export const tfmLabel = (id: string): string => TFMS.find((t) => t.id === id)?.label ?? id
export const tfmChip = (id: string): string => TFMS.find((t) => t.id === id)?.chip ?? id
// A netstandard (library) target — no runnable obfuscator inside; for extending BitMono only.
export const isLibTfm = (id: string): boolean => TFMS.find((t) => t.id === id)?.lib === true

// Stable display order for the OS/arch chips, independent of asset order from the API.
export const OS_ORDER: Os[] = ['win', 'linux', 'osx']
export const ARCH_ORDER: Arch[] = ['x64', 'arm64', 'x86']

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export const shortSha = (sha: string): string => `${sha.slice(0, 8)}…${sha.slice(-6)}`

export const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)]
