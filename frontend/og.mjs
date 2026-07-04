// Open Graph card renderer — hand-built SVG in the void/acid design system, rasterized to PNG with resvg.
// Monospace (JetBrains Mono) throughout, so line widths are predictable enough to wrap/truncate by char count.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const FONTS = [
  path.join(dir, 'og/fonts/JetBrainsMono-Regular.ttf'),
  path.join(dir, 'og/fonts/JetBrainsMono-Bold.ttf'),
]

// The bitmono mark, embedded once as a data URI. Built output puts public/* in dist/; fall back to public/ for dev.
let MARK = ''
for (const p of ['dist/mark.png', 'public/mark.png']) {
  try { MARK = `data:image/png;base64,${readFileSync(path.join(dir, p)).toString('base64')}`; break } catch { /* try next */ }
}

const C = { void: '#08080a', line: '#23232b', ink: '#ededef', muted: '#8a8a94', faint: '#4c4c56', acid: '#c6ff3d' }
const PLATFORM = { dotNet: '.NET', mono: 'Mono', netFramework: '.NET Framework', unity: 'Unity', iL2CPP: 'IL2CPP', native: 'Native', other: 'Other' }
const DIFFNUM = { veryEasy: '1', easy: '2', medium: '3', hard: '4', veryHard: '5', insane: '6' }

const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
const fit = (s, n) => (s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).trimEnd() + '…')

// Greedy word-wrap into at most maxLines lines of ~cols chars; the last line ellipsizes if it overflows.
function wrap(text, cols, maxLines) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const nx = line ? `${line} ${w}` : w
    if (nx.length <= cols || !line) { line = nx; continue }
    lines.push(line); line = w
    if (lines.length === maxLines) { line = ''; break }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.map((l) => fit(l, cols))
}

function shell(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${C.line}" stroke-opacity="0.55"/>
    </pattern>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 70) scale(820)">
      <stop offset="0" stop-color="${C.acid}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${C.acid}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.void}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="3" y="3" width="1194" height="624" rx="20" fill="none" stroke="${C.line}"/>
  ${inner}
</svg>`
}

// mark + "bitmono" wordmark, baseline at y.
function brand(x, y, size) {
  const m = MARK ? `<image href="${MARK}" x="${x}" y="${y - size + 4}" width="${size}" height="${size}"/>` : ''
  const tx = MARK ? x + size + 16 : x
  return `${m}<text x="${tx}" y="${y}" font-family="JetBrains Mono" font-weight="700" font-size="${Math.round(size * 0.72)}" fill="${C.ink}">bitmono</text>`
}

export function crackmeSvg(c) {
  const title = (c.title || 'crackme').trim()
  const oneLine = title.length <= 20
  const tSize = oneLine ? 82 : 60
  const lines = oneLine ? [title] : wrap(title, 28, 2)

  let svg = brand(72, 96, 46)
  svg += `<text x="1128" y="94" text-anchor="end" font-family="JetBrains Mono" font-weight="700" font-size="20" letter-spacing="7" fill="${C.acid}">CRACKME</text>`

  let y = oneLine ? 250 : 228
  for (const l of lines) {
    svg += `<text x="72" y="${y}" font-family="JetBrains Mono" font-weight="700" font-size="${tSize}" fill="${C.ink}">${esc(l)}</text>`
    y += tSize + 8
  }

  y += 18
  svg += `<text x="72" y="${y}" font-family="JetBrains Mono" font-size="28" fill="${C.muted}">by ${esc(fit(c.author || 'anonymous', 46))}</text>`

  // stat chips
  y += 46
  const chips = [c.runtime || PLATFORM[c.platform] || '.NET']
  const diff = c.avgDifficulty != null ? c.avgDifficulty.toFixed(1) : DIFFNUM[c.authorDifficulty]
  if (diff) chips.push(`DIFF ${diff}`)
  if (c.avgQuality != null) chips.push(`QUAL ${c.avgQuality.toFixed(1)}`)
  chips.push(`${c.downloadCount ?? 0} ↓`)
  let cx = 72
  for (const label of chips) {
    const w = Math.round(label.length * 13.2 + 32)
    svg += `<g><rect x="${cx}" y="${y}" width="${w}" height="46" rx="9" fill="${C.acid}" fill-opacity="0.08" stroke="${C.acid}" stroke-opacity="0.5"/>`
    svg += `<text x="${cx + w / 2}" y="${y + 30}" text-anchor="middle" font-family="JetBrains Mono" font-size="22" fill="${C.acid}">${esc(label)}</text></g>`
    cx += w + 16
  }

  // protections
  const prots = c.protections || []
  if (prots.length) {
    const shown = prots.slice(0, 5)
    let line = shown.join('  ·  ')
    if (prots.length > shown.length) line += `   +${prots.length - shown.length}`
    svg += `<text x="72" y="${y + 86}" font-family="JetBrains Mono" font-size="22" fill="${C.faint}">${esc(fit(line, 78))}</text>`
  }

  // footer
  svg += `<line x1="72" y1="556" x2="1128" y2="556" stroke="${C.line}"/>`
  svg += `<text x="72" y="596" font-family="JetBrains Mono" font-size="22" fill="${C.muted}">${esc(fit('bitmono.dev/challenge/' + (c.slug || ''), 52))}</text>`
  svg += `<text x="1128" y="596" text-anchor="end" font-family="JetBrains Mono" font-size="22" fill="${C.faint}">reverse it · prove it</text>`
  return shell(svg)
}

export function siteSvg() {
  let svg = ''
  const m = 92
  if (MARK) svg += `<image href="${MARK}" x="${600 - m / 2}" y="118" width="${m}" height="${m}"/>`
  svg += `<text x="600" y="278" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="44" fill="${C.ink}">bitmono</text>`
  svg += `<text x="600" y="374" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="46" fill="${C.ink}">obfuscate your .NET</text>`
  svg += `<text x="600" y="432" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="46" fill="${C.acid}">in the browser</text>`
  svg += `<text x="600" y="496" text-anchor="middle" font-family="JetBrains Mono" font-size="24" fill="${C.muted}">free &amp; open-source obfuscator for .NET &amp; Mono</text>`
  svg += `<text x="600" y="558" text-anchor="middle" font-family="JetBrains Mono" font-size="24" fill="${C.faint}">bitmono.dev  ·  drop your assembly, get it protected</text>`
  return shell(svg)
}

function toPng(svg) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'JetBrains Mono' },
    background: C.void,
  }).render().asPng()
}

export function blogSvg(p) {
  const title = (p.title || 'post').trim()
  const oneLine = title.length <= 24
  const tSize = oneLine ? 72 : 52
  const lines = oneLine ? [title] : wrap(title, 32, 3)

  let svg = brand(72, 96, 46)
  svg += `<text x="1128" y="94" text-anchor="end" font-family="JetBrains Mono" font-weight="700" font-size="20" letter-spacing="7" fill="${C.acid}">BLOG</text>`

  let y = oneLine ? 250 : 216
  for (const l of lines) {
    svg += `<text x="72" y="${y}" font-family="JetBrains Mono" font-weight="700" font-size="${tSize}" fill="${C.ink}">${esc(l)}</text>`
    y += tSize + 10
  }

  y += 16
  // Pre-ellipsize so a two-line cut never ends mid-sentence without the '…'.
  for (const l of wrap(fit(p.description || '', 115), 62, 2)) {
    svg += `<text x="72" y="${y}" font-family="JetBrains Mono" font-size="26" fill="${C.muted}">${esc(l)}</text>`
    y += 38
  }

  svg += `<text x="72" y="${y + 26}" font-family="JetBrains Mono" font-size="22" fill="${C.acid}">${esc(p.date)}  ·  ${p.minutes} min read  ·  by ${esc(fit(p.author || 'BitMono', 30))}</text>`

  svg += `<line x1="72" y1="556" x2="1128" y2="556" stroke="${C.line}"/>`
  // Blog slugs run long — fit to 42 chars so the URL never collides with the right-side tag.
  svg += `<text x="72" y="596" font-family="JetBrains Mono" font-size="22" fill="${C.muted}">${esc(fit('bitmono.dev/blog/' + (p.slug || ''), 42))}</text>`
  svg += `<text x="1128" y="596" text-anchor="end" font-family="JetBrains Mono" font-size="22" fill="${C.faint}">free &amp; open-source obfuscator</text>`
  return shell(svg)
}

let siteCache = null
export function siteCardPng() { return (siteCache ??= toPng(siteSvg())) }
export function crackmeCardPng(c) { return toPng(crackmeSvg(c)) }
export function blogCardPng(p) { return toPng(blogSvg(p)) }
