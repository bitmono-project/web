export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}
export interface NotificationList { items: NotificationItem[]; unreadCount: number }

export async function getNotifications(): Promise<NotificationList> {
  const res = await fetch('/api/notifications')
  return res.ok ? ((await res.json()) as NotificationList) : { items: [], unreadCount: 0 }
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetch('/api/notifications/unread-count')
  return res.ok ? ((await res.json()) as number) : 0
}

export async function markAllRead(): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'POST' })
}

export async function markRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
}

export function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toISOString().slice(0, 10)
}
