import pl from './i18n/pl';
import no from './i18n/no';

export type UiLang = 'en' | 'pl' | 'no';
export const UI_LANGS: { code: UiLang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
  { code: 'no', name: 'Norsk' },
];
const DICTS: Record<UiLang, Record<string, string>> = { en: {}, pl, no };

function detect(): UiLang {
  try {
    const saved = localStorage.getItem('uiLang');
    if (saved === 'en' || saved === 'pl' || saved === 'no') return saved;
  } catch {}
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (nav.startsWith('pl')) return 'pl';
  if (/^(nb|nn|no)\b/.test(nav)) return 'no';
  return 'en';
}

// Per computer, so it lives in localStorage.
export const ui = $state({ lang: detect() });

export function setUiLang(lang: UiLang) {
  ui.lang = lang;
  try {
    localStorage.setItem('uiLang', lang);
  } catch {}
  document.documentElement.lang = lang === 'no' ? 'nb' : lang;
}

function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** The English text is the key. A missing translation falls back to English. */
export function t(en: string, vars?: Record<string, string | number>): string {
  return fill(DICTS[ui.lang][en] ?? en, vars);
}

/** Translation in a fixed language, e.g. the singers' screen follows its own language. */
export function tIn(lang: string, en: string, vars?: Record<string, string | number>): string {
  return fill(DICTS[lang as UiLang]?.[en] ?? en, vars);
}
