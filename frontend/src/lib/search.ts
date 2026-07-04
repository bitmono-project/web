// Site-wide quick search (header ⌘K palette) — crackmes, users, writeups.

export interface SearchCrackme { slug: string; title: string; author: string; difficulty: string }
export interface SearchUser { handle: string; displayName: string; avatar: string | null; points: number }
export interface SearchWriteup { id: string; title: string; crackmeSlug: string; crackmeTitle: string; author: string }
export interface SearchResults { crackmes: SearchCrackme[]; users: SearchUser[]; writeups: SearchWriteup[] }

export const EMPTY_RESULTS: SearchResults = { crackmes: [], users: [], writeups: [] }

export async function searchSite(q: string): Promise<SearchResults> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  return res.ok ? ((await res.json()) as SearchResults) : EMPTY_RESULTS
}
