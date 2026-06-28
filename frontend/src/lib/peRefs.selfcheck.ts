// Self-check for peRefs (run: `npm test`, or pass DLL paths to dump their refs for manual checking).
// ponytail: assert-based, no framework, no committed binary fixture. The full PE/metadata parse was
// verified against real assemblies (Sample / AsmResolver.DotNet / BitMono.*) spanning PE32/PE32+ and
// 1..28 refs; the deterministic logic below is asserted on every run, and the binary parse is
// re-checked opportunistically against the locally-built Sample.dll when present.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAssemblyRefs, isFrameworkRef, missingRefs } from './peRefs.ts'

const asArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)

// Manual mode: `node --experimental-strip-types peRefs.selfcheck.ts <a.dll> <b.dll>`
const paths = process.argv.slice(2)
if (paths.length) {
  for (const path of paths) {
    const refs = parseAssemblyRefs(asArrayBuffer(readFileSync(path)))
    const name = path.split(/[\\/]/).pop()
    console.log(name, '→', refs === null ? '(null)' : refs.filter((r) => !isFrameworkRef(r)).join(', ') || '(no non-framework refs)')
  }
  process.exit(0)
}

// fail-open: anything that isn't a parseable managed PE returns null, never throws
assert.equal(parseAssemblyRefs(new ArrayBuffer(8)), null, 'too-short input → null')
assert.equal(parseAssemblyRefs(new ArrayBuffer(128)), null, 'no PE signature → null')

// framework filter: BCL is hidden, third-party (incl. Microsoft.Extensions.*) is kept
assert.ok(isFrameworkRef('System.Runtime') && isFrameworkRef('mscorlib') && isFrameworkRef('System'))
assert.ok(!isFrameworkRef('Newtonsoft.Json') && !isFrameworkRef('Microsoft.Extensions.DependencyInjection'))

// missingRefs: drop framework + already-provided (matched by filename sans ext, case-insensitive)
assert.deepEqual(missingRefs(['Newtonsoft.Json', 'System.Text.Json', 'Dapper'], ['newtonsoft.json.dll']), ['Dapper'])
assert.deepEqual(missingRefs(['Serilog'], ['Serilog.dll']), [])

// opportunistic full-parse check against the locally-built sample assembly
try {
  const sample = readFileSync(new URL('../../../test-assets/out/Sample.dll', import.meta.url))
  assert.ok(parseAssemblyRefs(asArrayBuffer(sample))?.includes('System.Runtime'), 'Sample.dll should reference System.Runtime')
  console.log('peRefs self-check passed (+ parsed test-assets/out/Sample.dll)')
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  console.log('peRefs self-check passed (Sample.dll fixture absent — skipped binary parse)')
}
