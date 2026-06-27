export interface AppConfig {
  turnstileSiteKey: string | null
  zipPassword: string
}

const FALLBACK: AppConfig = { turnstileSiteKey: null, zipPassword: 'bitmono.dev' }

export async function getConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/api/config')
    if (!res.ok) return FALLBACK
    return (await res.json()) as AppConfig
  } catch {
    return FALLBACK
  }
}
