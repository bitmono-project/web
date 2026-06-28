// Tiny i18n core: dotted-key lookup with fallback, {var} interpolation, and native
// Intl plurals. No deps — Intl.PluralRules gets Russian/Arabic plural categories right,
// which is the whole reason not to hand-roll this. See translate.smoke.mjs for the checks.

export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string }
export type Dict = { [key: string]: string | Plural | Dict }
export type Vars = Record<string, string | number>

// A value object is a plural set iff it carries a string `other` (every Intl category falls back to it).
export function isPlural(value: unknown): value is Plural {
  return typeof value === 'object' && value !== null && typeof (value as { other?: unknown }).other === 'string'
}

function lookup(dict: Dict | undefined, path: string): string | Plural | undefined {
  let cur: string | Plural | Dict | undefined = dict
  for (const key of path.split('.')) {
    if (cur === undefined || typeof cur === 'string' || isPlural(cur)) return undefined
    cur = cur[key]
  }
  return typeof cur === 'string' || isPlural(cur) ? cur : undefined
}

function fill(template: string, vars: Vars | undefined): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}

// Resolve `key` for `lang`, falling back to `fallback`, then to the raw key. A plural entry is
// picked by `vars.count` via Intl; a missing category degrades to `other`.
export function translate(
  dicts: Record<string, Dict>,
  lang: string,
  fallback: string,
  key: string,
  vars?: Vars,
): string {
  const entry = lookup(dicts[lang], key) ?? lookup(dicts[fallback], key)
  if (entry === undefined) return key
  if (isPlural(entry)) {
    const count = Number(vars?.count ?? 0)
    const category = new Intl.PluralRules(lang).select(count) as keyof Plural
    return fill(entry[category] ?? entry.other, vars)
  }
  return fill(entry, vars)
}
