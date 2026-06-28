// Theme (light/dark) + language (en/ar) with RTL flip, persisted to localStorage
// and (when logged in) synced to the server via PATCH /api/me/preferences.
// React port of angular/src/app/core/prefs/preferences.service.ts.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { patchApiMePreferences, type MeResponse } from '@moamen-ui/pointer-react';
import { getItem, setItem, LANG_KEY, THEME_KEY, TOKEN_KEY, USER_KEY } from './storage';

export type Lang = 'en' | 'ar';
export type Theme = 'light' | 'dark';

interface PreferencesValue {
  language: Lang;
  theme: Theme;
  setLanguage: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  toggleLanguage: () => void;
  toggleTheme: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

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
  const user = readUser();
  const language =
    (user?.language as Lang) || (getItem(LANG_KEY) as Lang) || browserLang();
  const theme =
    (user?.theme as Theme) || (getItem(THEME_KEY) as Theme) || systemTheme();
  return {
    language: language === 'ar' ? 'ar' : 'en',
    theme: theme === 'light' ? 'light' : 'dark',
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const initial = useRef(resolveInitial());
  const [language, setLanguageState] = useState<Lang>(initial.current.language);
  const [theme, setThemeState] = useState<Theme>(initial.current.theme);

  // Apply to <html> + i18next + localStorage whenever either changes.
  useEffect(() => {
    void i18n.changeLanguage(language);
    const html = document.documentElement;
    html.setAttribute('lang', language);
    html.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    html.classList.toggle('dark', theme === 'dark');
    setItem(LANG_KEY, language);
    setItem(THEME_KEY, theme);

    // keep cached user prefs in sync (like the angular service does)
    const raw = getItem(USER_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        u.language = language;
        u.theme = theme;
        setItem(USER_KEY, JSON.stringify(u));
      } catch {
        /* ignore */
      }
    }
  }, [language, theme, i18n]);

  const persist = useCallback((p: { language?: Lang; theme?: Theme }) => {
    if (!getItem(TOKEN_KEY)) return;
    // fire-and-forget; failures are non-fatal
    patchApiMePreferences(p).catch(() => {});
  }, []);

  const setLanguage = useCallback(
    (l: Lang) => {
      setLanguageState(l);
      persist({ language: l });
    },
    [persist],
  );

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      persist({ theme: t });
    },
    [persist],
  );

  const toggleLanguage = useCallback(
    () => setLanguage(language === 'ar' ? 'en' : 'ar'),
    [language, setLanguage],
  );
  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme],
  );

  return (
    <PreferencesContext.Provider
      value={{ language, theme, setLanguage, setTheme, toggleLanguage, toggleTheme }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
