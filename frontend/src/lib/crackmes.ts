// Gallery API + display helpers. Enum values arrive camelCased (server uses JsonStringEnumConverter).

// Cloudflare Turnstile form-field name — keep in sync with TurnstileVerifier.FormField on the server.
const TURNSTILE_FIELD = 'cf-turnstile-response'

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
  authorHandle: string | null
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
  commentsLocked: boolean
  reactions: Record<string, number>
  myReactions: string[]
  status: string
  takedownReason: string | null
  takenDownAt: string | null
  solvedByMe: boolean
  authorHandle: string | null
  verificationKind: string // none | exactCaseInsensitive | exactCaseSensitive | regex
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
  bitMonoOnly?: boolean
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

// Local-time `YYYY-MM-DD HH:MM UTC±H` — labeled with the viewer's UTC offset so the zone is never ambiguous.
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset() // minutes east of UTC
  const tz = `UTC${off >= 0 ? '+' : '-'}${Math.floor(Math.abs(off) / 60)}${off % 60 ? ':' + p(Math.abs(off) % 60) : ''}`
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} ${tz}`
}

export async function listCrackmes(f: CrackmeFilters): Promise<CrackmeListResponse> {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.platform) params.set('platform', f.platform)
  if (f.minDifficulty) params.set('minDifficulty', String(f.minDifficulty))
  if (f.maxDifficulty) params.set('maxDifficulty', String(f.maxDifficulty))
  if (f.protection) params.set('protection', f.protection)
  if (f.bitMonoOnly) params.set('bitMonoOnly', 'true')
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

// --- progression: solves, points, ranks, leaderboard ---

export interface SolveResult { solved: boolean; solvedCount: number; firstBlood: boolean; pointsAwarded: number }

export async function markSolved(slug: string): Promise<SolveResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/solve`, { method: 'POST' })
  return res.ok ? ((await res.json()) as SolveResult) : null
}

export async function unmarkSolved(slug: string): Promise<SolveResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/solve`, { method: 'DELETE' })
  return res.ok ? ((await res.json()) as SolveResult) : null
}

// --- solve verification (keygen / flag oracle) ---

// Pick list for the owner's verification config. Values are the camelCased server enum names.
export const VERIFICATION_KINDS = [
  { value: 'none', label: 'Honor system — no answer required' },
  { value: 'exactCaseInsensitive', label: 'Exact answer (ignore case)' },
  { value: 'exactCaseSensitive', label: 'Exact answer (case-sensitive)' },
  { value: 'regex', label: 'Regex pattern' },
]

export interface FlagResult { correct: boolean; solvedCount: number; firstBlood: boolean; pointsAwarded: number }

// A wrong answer still returns 200 { correct:false }; only transport/auth failures return null.
export async function submitFlag(slug: string, answer: string): Promise<FlagResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/submit-flag`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }),
  })
  return res.ok ? ((await res.json()) as FlagResult) : null
}

// Owner/admin sets or clears the answer. answer is the serial (Exact*) or pattern (Regex); null/blank
// keeps the existing one when the kind is unchanged. Surfaces the server's validation message on failure.
export async function setVerification(slug: string, kind: string, answer: string | null): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/verification`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, answer }),
  })
  if (res.ok) return { ok: true, error: null }
  const text = (await res.text().catch(() => '')).replace(/^"|"$/g, '')
  return { ok: false, error: text || `Failed (${res.status})` }
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  handle: string | null
  displayName: string
  avatar: string | null
  points: number
  solves: number
  rankName: string
}
export interface LeaderboardResponse { items: LeaderboardEntry[]; total: number; page: number; pageSize: number }

export async function getLeaderboard(scope: string, page = 1): Promise<LeaderboardResponse> {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (page > 1) params.set('page', String(page))
  const res = await fetch(`/api/progression/leaderboard?${params.toString()}`)
  if (!res.ok) return { items: [], total: 0, page: 1, pageSize: 50 }
  return (await res.json()) as LeaderboardResponse
}

export interface MyRank {
  points: number
  solves: number
  rankName: string
  nextRankName: string | null
  pointsToNext: number | null
  position: number | null
}

export async function getMyRank(): Promise<MyRank | null> {
  const res = await fetch('/api/progression/my-rank')
  return res.ok ? ((await res.json()) as MyRank) : null
}

// --- public profiles ---

export interface ProfileBadge {
  code: string
  name: string
  description: string
  rarity: string
  awardedAt: string
}

export interface UserProfile {
  handle: string
  displayName: string
  avatar: string | null
  role: string
  joinedAt: string
  points: number
  rankName: string
  position: number | null
  solves: number
  authored: number
  writeups: number
  badges: ProfileBadge[]
}

export interface ProfileCrackme {
  slug: string
  title: string
  difficulty: string
  downloadCount: number
  solvedCount: number
  publishedAt: string
}

export async function getUserProfile(handle: string): Promise<UserProfile | null> {
  const res = await fetch(`/api/users/${encodeURIComponent(handle)}`)
  return res.ok ? ((await res.json()) as UserProfile) : null
}

export async function getUserCrackmes(handle: string): Promise<ProfileCrackme[]> {
  const res = await fetch(`/api/users/${encodeURIComponent(handle)}/crackmes`)
  return res.ok ? ((await res.json()) as ProfileCrackme[]) : []
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

export async function restoreCrackme(id: string, reason: string): Promise<boolean> {
  return (await fetch(`/api/moderation/${id}/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
  })).ok
}

// Public takedown/restore trail for a crackme. `moderator` is a real name only for admin viewers;
// otherwise null and the UI shows "a moderator".
export interface ModerationEvent {
  action: 'takenDown' | 'restored'
  reason: string | null
  at: string
  moderator: string | null
}

export async function getModerationHistory(slug: string): Promise<ModerationEvent[]> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/moderation-history`)
  if (!res.ok) return []
  return (await res.json()) as ModerationEvent[]
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
  authorHandle: string | null
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
  authorHandle: string | null
  body: string
  isSpoiler: boolean
  isDeleted: boolean
  isHidden: boolean
  edited: boolean
  mine: boolean
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

// Moderator: hide a comment (toggle) and lock/unlock new comments on a crackme.
// Toggles Comment.IsHidden; returns the new hidden state (or null on failure).
export async function hideComment(id: string): Promise<boolean | null> {
  const res = await fetch(`/api/moderation/comments/${id}/hide`, { method: 'POST' })
  return res.ok ? ((await res.json()) as { isHidden: boolean }).isHidden : null
}
export async function setCommentsLock(crackmeId: string): Promise<boolean | null> {
  const res = await fetch(`/api/moderation/${crackmeId}/comments-lock`, { method: 'POST' })
  return res.ok ? ((await res.json()) as { commentsLocked: boolean }).commentsLocked : null
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

export async function postComment(slug: string, body: string, isSpoiler: boolean, captchaToken?: string | null): Promise<CommentItem | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, isSpoiler, captchaToken }),
  })
  if (!res.ok) return null
  return (await res.json()) as CommentItem
}

export async function editComment(slug: string, id: string, body: string, isSpoiler: boolean): Promise<boolean> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, isSpoiler }),
  })
  return res.ok
}
export async function deleteComment(slug: string, id: string): Promise<boolean> {
  return (await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments/${id}`, { method: 'DELETE' })).ok
}
export interface CommentEditItem { body: string; editedAt: string }
export async function getCommentHistory(slug: string, id: string): Promise<CommentEditItem[]> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/comments/${id}/history`)
  return res.ok ? ((await res.json()) as CommentEditItem[]) : []
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
  imageCount: number
  upvoteCount: number
  helpedCount: number
  isAuthorPick: boolean
  myUpvoted: boolean
  myHelped: boolean
  canMarkHelped: boolean // viewer solved this crackme and isn't the writeup's author
  mine: boolean
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
  imageCount: number
  createdAt: string
}

export async function getWriteups(slug: string): Promise<WriteupItem[]> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups`)
  if (!res.ok) return []
  return (await res.json()) as WriteupItem[]
}

export interface WriteupVoteResult { upvoteCount: number; upvoted: boolean }
export async function toggleWriteupUpvote(slug: string, id: string): Promise<WriteupVoteResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/upvote`, { method: 'POST' })
  return res.ok ? ((await res.json()) as WriteupVoteResult) : null
}

export interface WriteupHelpedResult { helpedCount: number; helped: boolean }
export async function toggleWriteupHelped(slug: string, id: string): Promise<WriteupHelpedResult | null> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/helped`, { method: 'POST' })
  return res.ok ? ((await res.json()) as WriteupHelpedResult) : null
}

// Crackme author / admin marks a writeup as the intended solution (toggles; one per crackme).
export async function pinWriteup(slug: string, id: string): Promise<boolean> {
  return (await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/pin`, { method: 'POST' })).ok
}

export async function editWriteup(slug: string, id: string, title: string, body: string): Promise<boolean> {
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || null, bodyMarkdown: body }),
  })
  return res.ok
}
export async function deleteWriteup(slug: string, id: string): Promise<boolean> {
  return (await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}`, { method: 'DELETE' })).ok
}

export async function submitWriteup(slug: string, title: string, body: string, attachment: File | null, images: File[] = [], captchaToken?: string | null): Promise<boolean> {
  const fd = new FormData()
  if (title.trim()) fd.set('Title', title.trim())
  fd.set('BodyMarkdown', body)
  if (attachment) fd.set('Attachment', attachment)
  for (const img of images) fd.append('Images', img)
  if (captchaToken) fd.set(TURNSTILE_FIELD, captchaToken)
  const res = await fetch(`/api/crackmes/${encodeURIComponent(slug)}/writeups`, { method: 'POST', body: fd })
  return res.status === 202
}

export const writeupAttachmentUrl = (slug: string, id: string): string =>
  `/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/attachment`

export const writeupImageUrl = (slug: string, id: string, index: number): string =>
  `/api/crackmes/${encodeURIComponent(slug)}/writeups/${id}/images/${index}`

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
export const modWriteupImageUrl = (id: string, index: number): string => `/api/moderation/writeups/${id}/images/${index}`

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
  reporterHandle: string | null
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
