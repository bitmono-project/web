import { useEffect } from 'react'

// Mirrors index.html / server.mjs DEFAULTS. Pages restore it on unmount so a route without its own
// title never inherits the previous page's.
const DEFAULT = 'BitMono — obfuscate your .NET in the browser'

// Keep the browser tab in sync during client-side navigation. The Node server injects the correct
// <title> into the initial HTML for crawlers (server.mjs); this only updates the tab as the user moves
// between routes. Mutating document.title rewrites the single existing <title> in place — unlike a
// React 19 <title>, it can't duplicate the server-injected tag in <head>.
export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title
    return () => { document.title = DEFAULT }
  }, [title])
}
