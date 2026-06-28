import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface Me { id: string; name: string; handle: string | null; role: string; avatar: string | null }
export interface Providers { discord: boolean; github: boolean; dev: boolean }

export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return null
    return (await res.json()) as Me | null
  } catch {
    return null
  }
}

export async function getProviders(): Promise<Providers> {
  try {
    const res = await fetch('/api/auth/providers')
    if (!res.ok) return { discord: false, github: false, dev: false }
    return (await res.json()) as Providers
  } catch {
    return { discord: false, github: false, dev: false }
  }
}

export function loginUrl(provider: 'discord' | 'github', returnUrl = '/crackmes'): string {
  return `/api/auth/login/${provider}?returnUrl=${encodeURIComponent(returnUrl)}`
}

export async function devLogin(handle: string, admin: boolean): Promise<Me | null> {
  const res = await fetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, admin }),
  })
  if (!res.ok) return null
  return (await res.json()) as Me
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export const isModerator = (me: Me | null): boolean => me?.role === 'Moderator' || me?.role === 'Admin'
export const isAdmin = (me: Me | null): boolean => me?.role === 'Admin'

interface AuthState {
  me: Me | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthCtx = createContext<AuthState>({ me: null, loading: true, refresh: async () => {}, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setMe(await fetchMe())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const signOut = useCallback(async () => {
    await logout()
    await refresh()
  }, [refresh])

  return <AuthCtx.Provider value={{ me, loading, refresh, signOut }}>{children}</AuthCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx)
