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

export async function startObfuscation(
  file: File,
  protections: string[],
  agree = true,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const id = crypto.randomUUID()
  let uploaded = 0
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
    const res = await fetch(`/obfuscate/chunks/${id}`, { method: 'PUT', body: chunk })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Upload failed (${res.status})`)
    uploaded += chunk.size
    onProgress?.(Math.min(100, (uploaded / file.size) * 100))
  }

  const form = new FormData()
  form.append('fileName', file.name)
  for (const p of protections) form.append('protections', p)
  form.append('agree', String(agree))
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
