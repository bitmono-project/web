import { useEffect, useState } from 'react'

// Thumbnail strip + full-screen lightbox (◀ ▶ / arrow keys / Esc). Used for writeup screenshots
// on the crackme page and in the moderation queue (just pass the right image URLs).
export function ImageGallery({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
      else if (e.key === 'ArrowRight') setOpen((i) => (i === null ? null : (i + 1) % urls.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, urls.length])

  if (urls.length === 0) return null
  const prev = () => setOpen((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
  const next = () => setOpen((i) => (i === null ? null : (i + 1) % urls.length))

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="group h-20 w-28 overflow-hidden rounded-lg border border-line bg-void/40 transition-colors hover:border-acid"
          >
            <img src={u} alt={`screenshot ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div onClick={() => setOpen(null)} className="fixed inset-0 z-[95] flex items-center justify-center bg-void/90 p-6 backdrop-blur-sm">
          <button onClick={() => setOpen(null)} aria-label="close" className="absolute right-5 top-5 font-mono text-sm text-faint transition-colors hover:text-acid">esc ✕</button>
          {urls.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); prev() }} aria-label="previous" className="absolute left-3 px-3 font-mono text-4xl text-muted transition-colors hover:text-acid sm:left-6">‹</button>
          )}
          <img src={urls[open]} alt={`screenshot ${open + 1}`} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-[90vw] rounded-lg border border-line object-contain" />
          {urls.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); next() }} aria-label="next" className="absolute right-3 px-3 font-mono text-4xl text-muted transition-colors hover:text-acid sm:right-6">›</button>
          )}
          {urls.length > 1 && (
            <span className="absolute bottom-5 font-mono text-[12px] text-faint">{open + 1} / {urls.length}</span>
          )}
        </div>
      )}
    </>
  )
}
