// Gallery API + display helpers. Enum values arrive camelCased (server uses JsonStringEnumConverter).

export interface CrackmeListItem {
  slug: string
  title: string
  author: string
  platform: string
  runtime: string | null
  language: string
  authorDifficulty: string
  avgDifficulty: number | null
  avgQuality: number | null
  sizeBytes: number
  downloadCount: number
  solvedCount: number
  solutionCount: number
  commentCount: number
  isBitMonoObfuscated: boolean
  protections: string[]
  publishedAt: string
}

export interface CrackmeListResponse {
  items: CrackmeListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CrackmeDetail {
  slug: string
  title: string
  description: string | null
  author: string
  platform: string
  runtime: string | null
  language: string
  authorDifficulty: string
  avgDifficulty: number | null
  difficultyCount: number
  avgQuality: number | null
  qualityCount: number
  sizeBytes: number
  originalFileName: string | null
  downloadCount: number
  solvedCount: number
  isBitMonoObfuscated: boolean
  preset: string
  protections: string[]
  publishedAt: string
}

export interface CrackmeFilters {
  q?: string
  platform?: string
  minDifficulty?: number
  maxDifficulty?: number
  protection?: string
  sort?: string
  page?: number
}

export const PLATFORMS: { value: string; label: string }[] = [
  { value: 'dotNet', label: '.NET' },
  { value: 'mono', label: 'Mono' },
  { value: 'netFramework', label: '.NET Framework' },
  { value: 'unity', label: 'Unity' },
  { value: 'iL2CPP', label: 'IL2CPP' },
  { value: 'native', label: 'Native' },
  { value: 'other', label: 'Other' },
]

const PLATFORM_LABELS = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]))
export const platformLabel = (v: string): string => PLATFORM_LABELS[v] ?? v

const DIFFICULTY: Record<string, number> = {
  veryEasy: 1, easy: 2, medium: 3, hard: 4, veryHard: 5, insane: 6,
}
const DIFFICULTY_LABEL: Record<string, string> = {
  veryEasy: 'Very Easy', easy: 'Easy', medium: 'Medium', hard: 'Hard', veryHard: 'Very Hard', insane: 'Insane',
}
export const difficultyNumber = (v: string): number => DIFFICULTY[v] ?? 0
export const difficultyLabel = (v: string): string => DIFFICULTY_LABEL[v] ?? v

const LANGUAGE: Record<string, string> = {
  cSharp: 'C#', fSharp: 'F#', vbNet: 'VB.NET', cpp: 'C/C++', other: 'Other',
}
export const languageLabel = (v: string): string => LANGUAGE[v] ?? v

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${bytes} B`
}

export function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export async function listCrackmes(f: CrackmeFilters): Promise<CrackmeListResponse> {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.platform) params.set('platform', f.platform)
  if (f.minDifficulty) params.set('minDifficulty', String(f.minDifficulty))
  if (f.maxDifficulty) params.set('maxDifficulty', String(f.maxDifficulty))
  if (f.protection) params.set('protection', f.protection)
  if (f.sort) params.set('sort', f.sort)
  if (f.page && f.page > 1) params.set('page', String(f.page))
  const res = await fetch(`/api/crackmes?${params.toString()}`)
  if (!res.ok) throw new Error(`Failed to load crackmes (${res.status})`)
  return (await res.json()) as CrackmeListResponse
}

export async function getCrackme(slug: string): Promise<CrackmeDetail | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to load crackme (${res.status})`)
  return (await res.json()) as CrackmeDetail
}

// --- moderation (moderator/admin only) ---

export interface PendingItem {
  id: string
  slug: string
  title: string
  description: string | null
  author: string
  platform: string
  runtime: string | null
  language: string
  difficulty: string
  sizeBytes: number
  sha256: string
  isBitMonoObfuscated: boolean
  protections: string[]
  createdAt: string
}

export async function getQueue(): Promise<PendingItem[]> {
  const res = await fetch('/api/moderation/queue')
  if (!res.ok) throw new Error(`Failed to load the queue (${res.status})`)
  return (await res.json()) as PendingItem[]
}

export async function approveCrackme(id: string): Promise<boolean> {
  const res = await fetch(`/api/moderation/${id}/approve`, { method: 'POST' })
  return res.ok
}

export async function rejectCrackme(id: string, message: string): Promise<boolean> {
  const res = await fetch(`/api/moderation/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  return res.ok
}

export const moderationFileUrl = (id: string): string => `/api/moderation/${id}/file`

// --- comments + ratings ---

export interface CommentItem {
  id: string
  author: string
  body: string
  isSpoiler: boolean
  createdAt: string
}

export interface RatingResult {
  avgDifficulty: number | null
  difficultyCount: number
  avgQuality: number | null
  qualityCount: number
}

export interface MyRating {
  difficulty: number | null
  quality: number | null
}

export async function getComments(slug: string): Promise<CommentItem[]> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments`)
  if (!res.ok) return []
  return (await res.json()) as CommentItem[]
}

export async function postComment(slug: string, body: string, isSpoiler: boolean): Promise<CommentItem | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, isSpoiler }),
  })
  if (!res.ok) return null
  return (await res.json()) as CommentItem
}

export async function getMyRating(slug: string): Promise<MyRating | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/my-rating`)
  if (!res.ok) return null
  return (await res.json()) as MyRating
}

export async function rateCrackme(slug: string, difficulty: number, quality: number): Promise<RatingResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty, quality }),
  })
  if (!res.ok) return null
  return (await res.json()) as RatingResult
}
