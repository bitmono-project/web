// Render check for the OG cards — `node og.smoke.mjs` renders both and asserts valid PNG output.
// Pass --write to also drop og-*.preview.png for eyeballing.
import { crackmeCardPng, siteCardPng } from './og.mjs'

const isPng = (b) => b.length > 1000 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47

const crackme = crackmeCardPng({
  title: 'Keygen Me #4 — a deliberately long title to test wrapping',
  author: 'sunnamed', platform: 'dotNet', runtime: '.NET 8',
  avgDifficulty: 4.2, avgQuality: 4.8, downloadCount: 128,
  protections: ['ControlFlow', 'Renamer', 'AntiTamper', 'StringEncrypt', 'AntiDebug', 'CallHiding'],
  slug: 'keygen-me-4',
})
const site = siteCardPng()

if (!isPng(crackme) || !isPng(site)) { console.error('FAIL: invalid PNG output'); process.exit(1) }

if (process.argv.includes('--write')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync('og-crackme.preview.png', crackme)
  writeFileSync('og-site.preview.png', site)
}
console.log(`ok — crackme ${crackme.length}B, site ${site.length}B`)
