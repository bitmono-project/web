export type JobStatus = 'pending' | 'done' | 'failed' | 'notFound'

interface AcceptedResponse { id: string }
interface StatusResponse { id: string; status: JobStatus }

export interface ProtectionInfo {
  name: string
  description: string
  category: string
  stable: boolean
  note: string | null
  minLevel: string | null
}

export async function getProtections(): Promise<ProtectionInfo[]> {
  try {
    const res = await fetch('/protections')
    if (!res.ok) return []
    return (await res.json()) as ProtectionInfo[]
  } catch {
    return []
  }
}

export async function getEngineVersion(): Promise<string> {
  try {
    const res = await fetch('/version')
    if (!res.ok) return ''
    return ((await res.json()) as { bitMono: string }).bitMono
  } catch {
    return ''
  }
}

// Chunked upload: slice into pieces under Cloudflare's 100 MB per-request cap, append them
// server-side, then finalize. Progress is reported per chunk (granularity = CHUNK_SIZE).
const CHUNK_SIZE = 5 * 1024 * 1024

async function uploadChunked(file: Blob, id: string, onChunk: (bytes: number) => void): Promise<void> {
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
    const res = await fetch(`/obfuscate/chunks/${id}`, { method: 'PUT', body: chunk })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Upload failed (${res.status})`)
    onChunk(chunk.size)
  }
}

export async function startObfuscation(
  file: File,
  protections: string[],
  agree = true,
  deps: File[] = [],
  signingKey: File | null = null,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const id = crypto.randomUUID()
  // Each dependency is its own chunked upload under its own id; the finalize lists those ids. The
  // signing key is tiny, so it rides inline in the finalize form. Progress spans every uploaded byte.
  const total = file.size + deps.reduce((n, d) => n + d.size, 0)
  let uploaded = 0
  const tick = (bytes: number) => { uploaded += bytes; onProgress?.(Math.min(100, (uploaded / (total || 1)) * 100)) }

  await uploadChunked(file, id, tick)
  const dependencyIds: string[] = []
  for (const dep of deps) {
    const depId = crypto.randomUUID()
    await uploadChunked(dep, depId, tick)
    dependencyIds.push(depId)
  }

  const form = new FormData()
  form.append('fileName', file.name)
  for (const p of protections) form.append('protections', p)
  form.append('agree', String(agree))
  for (const depId of dependencyIds) form.append('dependencyIds', depId)
  if (signingKey) form.append('signingKey', signingKey)
  const fin = await fetch(`/obfuscate/chunks/${id}/finalize`, { method: 'POST', body: form })
  if (fin.status !== 202) throw new Error((await fin.text().catch(() => '')) || `Finalize failed (${fin.status})`)
  return ((await fin.json()) as AcceptedResponse).id
}

export async function getStatus(id: string): Promise<JobStatus> {
  const res = await fetch(`/obfuscate/${id}`)
  if (!res.ok) throw new Error(`Status check failed (${res.status})`)
  return ((await res.json()) as StatusResponse).status
}

export function downloadUrl(id: string, name: string): string {
  return `/obfuscate/${id}/download?name=${encodeURIComponent(name)}`
}

/** Polls until the job leaves "pending" or the timeout elapses. */
export async function waitForResult(id: string, timeoutMs = 120_000): Promise<JobStatus> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await getStatus(id)
    if (status !== 'pending') return status
    await new Promise((r) => setTimeout(r, 1100))
  }
  return 'pending'
}
