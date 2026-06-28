// vue-i18n config. Loads the SAME translation files as the React/Angular apps
// (public/assets/i18n/{en,ar}.json, copied verbatim) over HTTP, so the key
// namespaces (common, nav, header, login, overview, roles, users, projects)
// match 1:1. The JSON uses the {{ var }} interpolation syntax, so we configure
// vue-i18n's custom message compiler / interpolation to understand it.
import { createI18n } from 'vue-i18n';
import { getItem, LANG_KEY } from '@/lib/storage';

export type Lang = 'en' | 'ar';

export function initialLang(): Lang {
  const saved = getItem(LANG_KEY);
  if (saved === 'ar' || saved === 'en') return saved;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
  return nav.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

// The shared JSON uses i18next-style {{ name }} / {{name}} placeholders, which
// vue-i18n does not understand natively (it expects {name}). We supply a custom
// messageCompiler that returns a function interpolating those placeholders from
// the named values passed to t(key, { name }).
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export const i18n = createI18n<false>({
  legacy: false,
  locale: initialLang(),
  fallbackLocale: 'en',
  messages: {},
  // Avoid console noise for fallback during async load.
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false,
  messageCompiler(message) {
    const source = typeof message === 'string' ? message : String(message);
    // vue-i18n's MessageContext exposes named values via ctx.named(key).
    const fn = (ctx: { named: (key: string) => unknown }) =>
      source.replace(PLACEHOLDER, (_m, key: string) => {
        const v = ctx.named(key);
        return v == null ? '' : String(v);
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fn as any;
  },
});

const loaded = new Set<string>();

/** Fetches /assets/i18n/<lng>.json and registers it, once per locale. */
export async function loadLocaleMessages(lng: Lang): Promise<void> {
  if (loaded.has(lng)) return;
  const res = await fetch(`/assets/i18n/${lng}.json`);
  const messages = await res.json();
  i18n.global.setLocaleMessage(lng, messages);
  loaded.add(lng);
}
