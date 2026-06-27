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
  id: string
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
  isOwner: boolean
  reactionsEnabled: boolean
  commentReactionsEnabled: boolean
  reactions: Record<string, number>
  myReactions: string[]
  status: string
  takedownReason: string | null
  takenDownAt: string | null
}

// Crackme lifecycle status (camelCased from the server enum).
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', takenDown: 'Taken down',
}
export const statusLabel = (v: string): string => STATUS_LABEL[v] ?? v

export function statusBadgeClass(status: string): string {
  const base = 'rounded border px-1.5 py-px font-mono text-[11px] uppercase tracking-wider'
  switch (status) {
    case 'approved': return `${base} border-acid/40 text-acid`
    case 'pending': return `${base} border-yellow-400/40 text-yellow-400`
    case 'rejected': return `${base} border-red-400/40 text-red-400`
    case 'takenDown': return `${base} border-orange-400/40 text-orange-400`
    default: return `${base} border-line text-faint`
  }
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

// --- my submissions (the uploader's own view, including pending/rejected/taken-down) ---

export interface MySubmission {
  slug: string
  title: string
  status: string
  moderatorMessage: string | null
  isTakenDown: boolean
  takedownReason: string | null
  takenDownAt: string | null
  downloadCount: number
  solvedCount: number
  createdAt: string
  publishedAt: string | null
}

export async function getMySubmissions(): Promise<MySubmission[]> {
  const res = await fetch('/api/crackmes/mine')
  if (!res.ok) return []
  return (await res.json()) as MySubmission[]
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

// --- takedown / restore + admin dashboard (admin only) ---

export async function takedownCrackme(id: string, reason: string): Promise<boolean> {
  const res = await fetch(`/api/moderation/${id}/takedown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  return res.ok
}

export async function restoreCrackme(id: string): Promise<boolean> {
  return (await fetch(`/api/moderation/${id}/restore`, { method: 'POST' })).ok
}

export interface ModerationStats {
  totalCrackmes: number
  pendingCrackmes: number
  approvedCrackmes: number
  rejectedCrackmes: number
  takenDownCrackmes: number
  pendingWriteups: number
  openReports: number
  users: number
  totalDownloads: number
  totalSolved: number
  submissionsLast7Days: number
  submissionsLast30Days: number
  submissionsByDay: { day: string; count: number }[]
  topDownloaded: { slug: string; title: string; downloadCount: number; status: string }[]
}

export async function getModerationStats(): Promise<ModerationStats | null> {
  const res = await fetch('/api/moderation/stats')
  if (!res.ok) return null
  return (await res.json()) as ModerationStats
}

export interface AdminCrackmeRow {
  id: string
  slug: string
  title: string
  author: string
  status: string
  isTakenDown: boolean
  takedownReason: string | null
  downloadCount: number
  createdAt: string
  publishedAt: string | null
}

export async function getAdminCrackmes(q: string, status: string): Promise<AdminCrackmeRow[]> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  const res = await fetch(`/api/moderation/crackmes?${params.toString()}`)
  if (!res.ok) return []
  return (await res.json()) as AdminCrackmeRow[]
}

// --- comments + ratings ---

export interface CommentItem {
  id: string
  author: string
  body: string
  isSpoiler: boolean
  createdAt: string
  reactions: Record<string, number>
  myReactions: string[]
}

// Reaction palette — keep in sync with the backend ReactionEmojis.Allowed.
export const REACTIONS = ['👍', '❤️', '🔥', '🤯', '😂']

export interface ReactionSummary {
  counts: Record<string, number>
  mine: string[]
}

export async function toggleCrackmeReaction(slug: string, emoji: string): Promise<ReactionSummary | null> {
  const res = await fetch(`/api/reactions/crackme/${encodeURIComponent(slug)}/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
  })
  return res.ok ? ((await res.json()) as ReactionSummary) : null
}

export async function toggleCommentReaction(commentId: string, emoji: string): Promise<ReactionSummary | null> {
  const res = await fetch(`/api/reactions/comment/${commentId}/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
  })
  return res.ok ? ((await res.json()) as ReactionSummary) : null
}

export async function updateCrackmeSettings(slug: string, reactionsEnabled: boolean, commentReactionsEnabled: boolean): Promise<boolean> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/settings`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reactionsEnabled, commentReactionsEnabled }),
  })
  return res.ok
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

// --- writeups (moderated; each is a full solution / spoiler) ---

export interface WriteupItem {
  id: string
  author: string
  title: string | null
  bodyMarkdown: string
  hasAttachment: boolean
  upvoteCount: number
  createdAt: string
}

export interface PendingWriteup {
  id: string
  crackmeSlug: string
  crackmeTitle: string
  author: string
  title: string | null
  bodyMarkdown: string
  hasAttachment: boolean
  createdAt: string
}

export async function getWriteups(slug: string): Promise<WriteupItem[]> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups`)
  if (!res.ok) return []
  return (await res.json()) as WriteupItem[]
}

export async function submitWriteup(slug: string, title: string, body: string, attachment: File | null): Promise<boolean> {
  const fd = new FormData()
  if (title.trim()) fd.set('Title', title.trim())
  fd.set('BodyMarkdown', body)
  if (attachment) fd.set('Attachment', attachment)
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups`, { method: 'POST', body: fd })
  return res.status === 202
}

export const writeupAttachmentUrl = (slug: string, id: string): string =>
  `/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/attachment`

export async function getWriteupQueue(): Promise<PendingWriteup[]> {
  const res = await fetch('/api/moderation/writeups')
  if (!res.ok) throw new Error(`Failed to load writeup queue (${res.status})`)
  return (await res.json()) as PendingWriteup[]
}

export async function approveWriteup(id: string): Promise<boolean> {
  return (await fetch(`/api/moderation/writeups/${id}/approve`, { method: 'POST' })).ok
}

export async function rejectWriteup(id: string): Promise<boolean> {
  return (await fetch(`/api/moderation/writeups/${id}/reject`, { method: 'POST' })).ok
}

export const modWriteupAttachmentUrl = (id: string): string => `/api/moderation/writeups/${id}/attachment`

// --- reports ---

export const REPORT_REASONS = [
  { value: 'Malware', label: 'Malware / harmful' },
  { value: 'Stolen', label: 'Stolen / not original' },
  { value: 'Broken', label: 'Broken / doesn’t run' },
  { value: 'Spam', label: 'Spam' },
  { value: 'Inappropriate', label: 'Inappropriate' },
  { value: 'Other', label: 'Other' },
]

export interface PendingReport {
  id: string
  crackmeSlug: string
  crackmeTitle: string
  reason: string
  details: string | null
  reporter: string
  createdAt: string
}

export async function reportCrackme(slug: string, reason: string, details: string): Promise<boolean> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, details: details || null }),
  })
  return res.ok
}

export async function getReportQueue(): Promise<PendingReport[]> {
  const res = await fetch('/api/moderation/reports')
  if (!res.ok) throw new Error(`Failed to load reports (${res.status})`)
  return (await res.json()) as PendingReport[]
}

export async function resolveReport(id: string): Promise<boolean> {
  return (await fetch(`/api/moderation/reports/${id}/resolve`, { method: 'POST' })).ok
}
