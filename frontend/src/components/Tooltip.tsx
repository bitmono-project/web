import type { ReactNode } from 'react'

// Styled hover/focus tooltip — replaces native browser `title=` bubbles so hints match the
// dark/acid design system instead of the OS chrome.
// ponytail: CSS-only group-hover/focus, no JS positioning. Long labels wrap (max-w); right at a
// viewport edge a centered bubble can clip — swap in a portal-positioned tooltip if that ever bites.
export const tooltipBubble =
  'pointer-events-none z-50 w-max max-w-[260px] rounded-md border border-line bg-void px-2 py-1 text-center font-mono text-[11px] leading-snug text-muted shadow-[0_4px_16px_rgba(0,0,0,0.55)] opacity-0 transition-opacity duration-150'

export function Tooltip({
  label,
  children,
  placement = 'top',
  className = '',
}: {
  label: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom'
  className?: string
}) {
  const pos = placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`absolute left-1/2 -translate-x-1/2 ${pos} ${tooltipBubble} group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  )
}
