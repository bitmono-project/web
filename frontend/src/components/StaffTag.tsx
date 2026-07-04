// Small amber badge that flags a control as a staff-only power, so moderators/admins can tell a
// privileged action apart from an ordinary one at a glance. `label` names the role it needs
// ('admin' for admin-only, 'mod' for moderator) — an admin still sees 'mod' tags, which reads as
// "this is a staff power". Sits inline next to (or above) the button it guards.
export function StaffTag({ label = 'admin' }: { label?: 'admin' | 'mod' }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-px align-middle font-mono text-[10px] font-bold uppercase leading-tight tracking-wider text-amber-300">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      </svg>
      {label}
    </span>
  )
}
