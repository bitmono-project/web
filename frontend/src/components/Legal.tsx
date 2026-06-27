import type { ReactNode } from 'react'

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 font-mono text-[12px] text-faint">Last updated {updated}</p>
      <div className="mt-8 space-y-6 font-mono text-[13px] leading-relaxed text-muted">{children}</div>
    </main>
  )
}

export function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export const Mail = () => <a href="mailto:hello@bitmono.dev" className="text-acid hover:underline">hello@bitmono.dev</a>
