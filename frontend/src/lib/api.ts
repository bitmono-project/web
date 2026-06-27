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

// XHR (not fetch) so we can report real upload progress — fetch has no upload-progress event.
export async function startObfuscation(
  file: File,
  protections: string[],
  agree = true,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  for (const p of protections) form.append('protections', p)
  form.append('agree', String(agree))

  return await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/obfuscate')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status === 202) {
        try { resolve((JSON.parse(xhr.responseText) as AcceptedResponse).id) }
        catch { reject(new Error('Bad response from server.')) }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(form)
  })
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
