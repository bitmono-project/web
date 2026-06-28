import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type Dict, type Vars } from './translate'
import { en } from '../locales/en'
import { ru } from '../locales/ru'
import { zh } from '../locales/zh'
import { th } from '../locales/th'
import { vi } from '../locales/vi'
import { ar } from '../locales/ar'

export type Lang = 'en' | 'ru' | 'zh' | 'th' | 'vi' | 'ar'

// Order = order shown in the switcher. `native` is the endonym (what speakers call their own language).
export const LANGUAGES: { code: Lang; native: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'ru', native: 'Русский', dir: 'ltr' },
  { code: 'zh', native: '简体中文', dir: 'ltr' },
  { code: 'th', native: 'ไทย', dir: 'ltr' },
  { code: 'vi', native: 'Tiếng Việt', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
]

const DICTS: Record<Lang, Dict> = { en, ru, zh, th, vi, ar }
const FALLBACK: Lang = 'en'
const STORAGE_KEY = 'bitmono.lang'

const dirOf = (lang: Lang): 'ltr' | 'rtl' => LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr'

// Saved choice wins; otherwise match the browser's primary language; otherwise English.
function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (saved && saved in DICTS) return saved
  } catch { /* storage blocked (private mode) — fall through */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return LANGUAGES.find((l) => l.code === nav)?.code ?? FALLBACK
}

export type TFunc = (key: string, vars?: Vars) => string

interface I18nState {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (lang: Lang) => void
  t: TFunc
  n: (value: number) => string
}

const I18nCtx = createContext<I18nState | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)

  // Reflect the choice on <html> so the browser handles text direction and `lang`-based features.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dirOf(lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [])

  const value = useMemo<I18nState>(() => ({
    lang,
    dir: dirOf(lang),
    setLang,
    t: (key, vars) => translate(DICTS, lang, FALLBACK, key, vars),
    n: (value) => new Intl.NumberFormat(lang).format(value),
  }), [lang, setLang])

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nState {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

// Convenience: most components only need `t`.
// eslint-disable-next-line react-refresh/only-export-components
export function useT(): TFunc {
  return useI18n().t
}
