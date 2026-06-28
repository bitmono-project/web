// Minimal .NET assembly reader: extracts the simple names of an assembly's references (its
// AssemblyRef table) so the UI can tell users which dependency DLLs are still missing. It walks only
// enough of the PE + CLI metadata to reach the AssemblyRef table — it is NOT a general metadata reader.
//
// Fail-open by contract: any malformed or non-.NET input returns null and callers fall back to purely
// manual dependency entry. The reference hint is a convenience, never a gate.
//
// ponytail: hand-rolled (~1 schema table + a header walk) because no browser API does this and the
// npm options are heavier than the ~120 lines here. Ceiling: reads the #~/#- tables stream and
// #Strings heap only; extend the schema if a future need wants versions/public keys.

// ECMA-335 II.22 row schemas for tables 0x00..0x23 (Module..AssemblyRef) — all we must size to reach
// AssemblyRef. Column codes: '1'/'2'/'4' fixed bytes; 's'/'g'/'b' heap indexes (String/Guid/Blob);
// 'I:n' simple index into table n (decimal); 'C:Name' coded index. Tables >0x23 need no schema (only
// their row counts, read from the Valid mask, feed coded-index sizing).
const TABLE_SCHEMA: Record<number, string[]> = {
  0x00: ['2', 's', 'g', 'g', 'g'], // Module
  0x01: ['C:ResolutionScope', 's', 's'], // TypeRef
  0x02: ['4', 's', 's', 'C:TypeDefOrRef', 'I:4', 'I:6'], // TypeDef
  0x03: ['I:4'], // FieldPtr
  0x04: ['2', 's', 'b'], // Field
  0x05: ['I:6'], // MethodPtr
  0x06: ['4', '2', '2', 's', 'b', 'I:8'], // MethodDef
  0x07: ['I:8'], // ParamPtr
  0x08: ['2', '2', 's'], // Param
  0x09: ['I:2', 'C:TypeDefOrRef'], // InterfaceImpl
  0x0a: ['C:MemberRefParent', 's', 'b'], // MemberRef
  0x0b: ['2', 'C:HasConstant', 'b'], // Constant (Type + 1-byte pad = 2 fixed bytes)
  0x0c: ['C:HasCustomAttribute', 'C:CustomAttributeType', 'b'], // CustomAttribute
  0x0d: ['C:HasFieldMarshal', 'b'], // FieldMarshal
  0x0e: ['2', 'C:HasDeclSecurity', 'b'], // DeclSecurity
  0x0f: ['2', '4', 'I:2'], // ClassLayout
  0x10: ['4', 'I:4'], // FieldLayout
  0x11: ['b'], // StandAloneSig
  0x12: ['I:2', 'I:20'], // EventMap
  0x13: ['I:20'], // EventPtr
  0x14: ['2', 's', 'C:TypeDefOrRef'], // Event
  0x15: ['I:2', 'I:23'], // PropertyMap
  0x16: ['I:23'], // PropertyPtr
  0x17: ['2', 's', 'b'], // Property
  0x18: ['2', 'I:6', 'C:HasSemantics'], // MethodSemantics
  0x19: ['I:2', 'C:MethodDefOrRef', 'C:MethodDefOrRef'], // MethodImpl
  0x1a: ['s'], // ModuleRef
  0x1b: ['b'], // TypeSpec
  0x1c: ['2', 'C:MemberForwarded', 's', 'I:26'], // ImplMap
  0x1d: ['4', 'I:4'], // FieldRVA
  0x1e: ['4', '4'], // EncLog
  0x1f: ['4'], // EncMap
  0x20: ['4', '2', '2', '2', '2', '4', 'b', 's', 's'], // Assembly
  0x21: ['4'], // AssemblyProcessor
  0x22: ['4', '4', '4'], // AssemblyOS
  0x23: ['2', '2', '2', '2', '4', 'b', 's', 's', 'b'], // AssemblyRef
}

// Coded index → [referenced tables (decimal; -1 = unused tag slot), tag bits]. ECMA-335 II.24.2.6.
const CODED: Record<string, [number[], number]> = {
  TypeDefOrRef: [[2, 1, 27], 2],
  HasConstant: [[4, 8, 23], 2],
  HasCustomAttribute: [[6, 4, 1, 2, 8, 9, 10, 0, 14, 23, 20, 17, 26, 27, 32, 35, 38, 39, 40, 42, 44, 43], 5],
  HasFieldMarshal: [[4, 8], 1],
  HasDeclSecurity: [[2, 6, 32], 2],
  MemberRefParent: [[2, 1, 26, 6, 27], 3],
  HasSemantics: [[20, 23], 1],
  MethodDefOrRef: [[6, 10], 1],
  MemberForwarded: [[4, 6], 1],
  Implementation: [[38, 35, 39], 2],
  CustomAttributeType: [[-1, -1, 6, 10, -1], 3],
  ResolutionScope: [[0, 26, 35, 1], 2],
  TypeOrMethodDef: [[2, 6], 1],
}

const ASSEMBLYREF_TABLE = 0x23

/** Referenced assembly simple names (incl. framework — filter with isFrameworkRef), or null if the
 *  bytes aren't a parseable managed assembly. */
export function parseAssemblyRefs(buffer: ArrayBuffer): string[] | null {
  try {
    const v = new DataView(buffer)
    const u16 = (o: number) => v.getUint16(o, true)
    const u32 = (o: number) => v.getUint32(o, true)

    // --- PE headers ---
    if (buffer.byteLength < 0x40) return null
    const peOff = u32(0x3c)
    if (u32(peOff) !== 0x0000_4550) return null // "PE\0\0"
    const coff = peOff + 4
    const numSections = u16(coff + 2)
    const opt = coff + 20
    const magic = u16(opt)
    const dirsAt = opt + (magic === 0x20b ? 112 : 96) // PE32+ vs PE32
    const cliRva = u32(dirsAt + 14 * 8) // data directory 14 = CLI header
    if (cliRva === 0) return null // not a managed assembly

    // --- section table → RVA-to-file-offset ---
    const sections: { va: number; size: number; ptr: number }[] = []
    const secStart = opt + u16(coff + 16) // optSize
    for (let i = 0; i < numSections; i++) {
      const s = secStart + i * 40
      sections.push({ va: u32(s + 12), size: Math.max(u32(s + 8), u32(s + 16)), ptr: u32(s + 20) })
    }
    const toOffset = (rva: number): number => {
      for (const s of sections) if (rva >= s.va && rva < s.va + s.size) return rva - s.va + s.ptr
      return -1
    }

    // --- CLI header → metadata root ("BSJB") ---
    const cliOff = toOffset(cliRva)
    if (cliOff < 0) return null
    const metaRoot = toOffset(u32(cliOff + 8))
    if (metaRoot < 0 || u32(metaRoot) !== 0x424a_5342) return null

    // --- stream headers (#~ / #-, #Strings) ---
    let p = metaRoot + 16 + ((u32(metaRoot + 12) + 3) & ~3) // skip version string (padded to 4)
    const streamCount = u16(p + 2)
    p += 4
    const streams: Record<string, number> = {} // name → offset from metaRoot
    for (let i = 0; i < streamCount; i++) {
      const off = u32(p)
      let n = p + 8
      let name = ''
      while (v.getUint8(n) !== 0) name += String.fromCharCode(v.getUint8(n++))
      streams[name] = off
      p = ((n + 1) + 3) & ~3 // past NUL, pad to 4
    }
    const tablesOff = streams['#~'] ?? streams['#-']
    const stringsOff = streams['#Strings']
    if (tablesOff === undefined || stringsOff === undefined) return null

    const stringsBase = metaRoot + stringsOff
    const readString = (idx: number): string => {
      const bytes: number[] = []
      let n = stringsBase + idx
      let b: number
      while ((b = v.getUint8(n++)) !== 0) bytes.push(b)
      return new TextDecoder().decode(new Uint8Array(bytes))
    }

    // --- tables header: heap index sizes, Valid mask, row counts ---
    const t = metaRoot + tablesOff
    const heap = v.getUint8(t + 6)
    const sIdx = heap & 0x01 ? 4 : 2
    const gIdx = heap & 0x02 ? 4 : 2
    const bIdx = heap & 0x04 ? 4 : 2
    const valid = v.getBigUint64(t + 8, true)
    const rows: Record<number, number> = {}
    let rp = t + 24
    for (let i = 0; i < 64; i++)
      if ((valid >> BigInt(i)) & 1n) {
        rows[i] = u32(rp)
        rp += 4
      }
    if (!rows[ASSEMBLYREF_TABLE]) return [] // parsed fine, no references

    // --- row sizing ---
    const codedSize = (which: string): number => {
      const [tables, bits] = CODED[which]
      let max = 0
      for (const tbl of tables) if (tbl >= 0 && rows[tbl]) max = Math.max(max, rows[tbl])
      return max < 1 << (16 - bits) ? 2 : 4
    }
    const colSize = (col: string): number => {
      switch (col) {
        case '1': return 1
        case '2': return 2
        case '4': return 4
        case 's': return sIdx
        case 'g': return gIdx
        case 'b': return bIdx
      }
      if (col.startsWith('I:')) return (rows[Number(col.slice(2))] ?? 0) < 65536 ? 2 : 4
      return codedSize(col.slice(2)) // 'C:Name'
    }
    const rowSize = (table: number): number =>
      (TABLE_SCHEMA[table] ?? []).reduce((n, c) => n + colSize(c), 0)

    // --- offset to AssemblyRef rows, then read each Name (column 7: after 2,2,2,2,4,blob) ---
    let base = rp
    for (let table = 0; table < ASSEMBLYREF_TABLE; table++)
      if (rows[table]) base += rows[table] * rowSize(table)
    const refRowSize = rowSize(ASSEMBLYREF_TABLE)
    const nameOff = 12 + bIdx
    const refs: string[] = []
    for (let i = 0; i < rows[ASSEMBLYREF_TABLE]; i++) {
      const at = base + i * refRowSize + nameOff
      const name = readString(sIdx === 2 ? u16(at) : u32(at))
      if (name) refs.push(name)
    }
    return [...new Set(refs)]
  } catch {
    return null // fail-open
  }
}

// Framework/BCL assemblies BitMono resolves from disk itself — never ask users to upload these.
// Heuristic and deliberately conservative: under-filtering (nagging about System.*) is worse than
// over-listing a stray Microsoft.* the user can ignore.
const FRAMEWORK_EXACT = new Set([
  'mscorlib', 'System', 'netstandard', 'WindowsBase', 'PresentationCore', 'PresentationFramework',
  'System.Private.CoreLib', 'Microsoft.CSharp', 'Microsoft.VisualBasic',
])
export function isFrameworkRef(name: string): boolean {
  return FRAMEWORK_EXACT.has(name) || name.startsWith('System.') || name.startsWith('Microsoft.Win32.')
}

const stripExt = (fileName: string): string => fileName.replace(/\.(dll|exe)$/i, '')

// Non-framework refs not covered by a provided dependency file (matched by filename sans extension —
// the common case where a DLL is named after its assembly). ponytail: filename match, not a re-parse
// of every dep; a dep named differently from its assembly just stays listed (harmless, non-blocking).
export function missingRefs(refs: string[], providedFileNames: string[]): string[] {
  const provided = new Set(providedFileNames.map((f) => stripExt(f).toLowerCase()))
  return refs.filter((r) => !isFrameworkRef(r) && !provided.has(r.toLowerCase()))
}
