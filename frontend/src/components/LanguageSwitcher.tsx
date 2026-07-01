import { LANGUAGES, useI18n, type Lang } from '../lib/i18n'

// Native <select> styled as a pill: keyboard-accessible for free, only the OS-drawn option list
// escapes our theme — an acceptable trade for not hand-rolling a listbox. Selection lives in
// context (localStorage-backed), never the URL.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-muted transition-colors hover:border-acid hover:text-acid focus-within:border-acid focus-within:text-acid sm:px-3">
      <GlobeIcon />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t('nav.language')}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent font-mono text-[13px] text-inherit opacity-0 outline-none sm:static sm:h-auto sm:w-auto sm:pe-3.5 sm:opacity-100"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-surface text-ink">{l.native}</option>
        ))}
      </select>
      <CaretIcon />
    </label>
  )
}

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </svg>
)

const CaretIcon = () => (
  <svg className="pointer-events-none absolute end-2 top-1/2 hidden -translate-y-1/2 sm:block" width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
)
