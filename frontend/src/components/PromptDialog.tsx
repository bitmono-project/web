import { useState } from 'react'

// One-click reasons so moderators don't retype the common ones (they can still edit / write their own).
export const REJECT_PRESETS = [
  'Not your own work',
  'Doesn’t build / run',
  'Commercial crack, keygen, or DRM bypass',
  'Game cheat / trainer / mod — not allowed',
  'Contains real malware',
  'Stolen / not original',
]

export const TAKEDOWN_PRESETS = [
  'Malware',
  'Stolen / not original',
  'Commercial crack or DRM bypass',
  'Inappropriate content',
  'DMCA / copyright request',
  'Broken / no longer works',
]

// An in-app replacement for window.prompt — same dark/acid style as the rest of the site.
// Click-outside or Esc cancels; the confirm button stays disabled until there's text.
export function PromptDialog({ title, label, placeholder, confirmText, danger, presets, onConfirm, onCancel }: {
  title: string
  label?: string
  placeholder?: string
  confirmText: string
  danger?: boolean
  presets?: string[]
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const submit = () => { if (value.trim()) onConfirm(value.trim()) }

  return (
    <div onClick={onCancel} className="fixed inset-0 z-[90] flex items-center justify-center bg-void/80 p-6 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        {label && <p className="mt-1 font-mono text-[12px] leading-snug text-faint">{label}</p>}
        {presets && presets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setValue(p)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${value === p ? 'border-acid text-acid' : 'border-line text-muted hover:border-acid hover:text-ink'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <textarea
          autoFocus
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          placeholder={placeholder}
          className="mt-3 w-full rounded-lg border border-line bg-void/50 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-acid"
        />
        <div className="mt-4 flex items-center justify-end gap-4">
          <button onClick={onCancel} className="font-mono text-[13px] text-faint transition-colors hover:text-ink">cancel</button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className={`rounded-full px-4 py-2 font-mono text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'border border-red-400/50 text-red-400 hover:bg-red-400/10' : 'bg-acid text-void hover:bg-acid-dim'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
