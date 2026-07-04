// Home activity feed — recent solves, first bloods, and freshly published crackmes.

export interface ActivityItem {
  kind: 'solve' | 'firstBlood' | 'published'
  actorName: string | null
  actorHandle: string | null
  crackmeTitle: string
  crackmeSlug: string
  points: number | null
  at: string
}

export async function getActivity(): Promise<ActivityItem[]> {
  const res = await fetch('/api/feed/activity')
  return res.ok ? ((await res.json()) as ActivityItem[]) : []
}
