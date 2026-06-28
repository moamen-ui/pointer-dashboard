// Theme (light/dark) + language (en/ar) with RTL flip, persisted to localStorage
// and (when logged in) synced to the server via PATCH /api/me/preferences.
// Vue port of react/src/lib/preferences.tsx.
import { ref, watch } from 'vue';
import { patchApiMePreferences, type MeResponse } from '@moamen-ui/pointer-vue';
import { i18n, loadLocaleMessages } from '@/i18n';
import { getItem, setItem, LANG_KEY, THEME_KEY, TOKEN_KEY, USER_KEY } from '@/lib/storage';

export type Lang = 'en' | 'ar';
export type Theme = 'light' | 'dark';

function browserLang(): Lang {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
  return nav.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readUser(): MeResponse | null {
  try {
    return JSON.parse(getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function resolveInitial(): { language: Lang; theme: Theme } {
  const u = readUser();
  const language = (u?.language as Lang) || (getItem(LANG_KEY) as Lang) || browserLang();
  const theme = (u?.theme as Theme) || (getItem(THEME_KEY) as Theme) || systemTheme();
  return {
    language: language === 'ar' ? 'ar' : 'en',
    theme: theme === 'light' ? 'light' : 'dark',
  };
}

const initial = resolveInitial();
const language = ref<Lang>(initial.language);
const theme = ref<Theme>(initial.theme);

// Apply to <html> + vue-i18n + localStorage whenever either changes.
async function apply(): Promise<void> {
  await loadLocaleMessages(language.value);
  // The composition-mode locale ref is typed against known message locales;
  // we load messages dynamically so cast to the expected union.
  (i18n.global.locale as unknown as { value: string }).value = language.value;

  const html = document.documentElement;
  html.setAttribute('lang', language.value);
  html.setAttribute('dir', language.value === 'ar' ? 'rtl' : 'ltr');
  html.classList.toggle('dark', theme.value === 'dark');
  setItem(LANG_KEY, language.value);
  setItem(THEME_KEY, theme.value);

  // keep cached user prefs in sync (like the react/angular layers do)
  const raw = getItem(USER_KEY);
  if (raw) {
    try {
      const u = JSON.parse(raw);
      u.language = language.value;
      u.theme = theme.value;
      setItem(USER_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }
}

watch([language, theme], () => void apply());

function persist(p: { language?: Lang; theme?: Theme }): void {
  if (!getItem(TOKEN_KEY)) return;
  // fire-and-forget; failures are non-fatal
  patchApiMePreferences(p).catch(() => {});
}

function setLanguage(l: Lang): void {
  language.value = l;
  persist({ language: l });
}

function setTheme(t: Theme): void {
  theme.value = t;
  persist({ theme: t });
}

function toggleLanguage(): void {
  setLanguage(language.value === 'ar' ? 'en' : 'ar');
}

function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

/** Applies the initial language/theme to the DOM (call once at startup). */
export function initPreferences(): Promise<void> {
  return apply();
}

export function usePreferences() {
  return {
    language,
    theme,
    setLanguage,
    setTheme,
    toggleLanguage,
    toggleTheme,
  };
}
