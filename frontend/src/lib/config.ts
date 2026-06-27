export interface AppConfig {
  turnstileSiteKey: string | null
}

export async function getConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/api/config')
    if (!res.ok) return { turnstileSiteKey: null }
    return (await res.json()) as AppConfig
  } catch {
    return { turnstileSiteKey: null }
  }
}
