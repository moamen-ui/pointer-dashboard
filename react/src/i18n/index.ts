// react-i18next config. Loads the SAME translation files as the Angular app
// (public/assets/i18n/{en,ar}.json, copied verbatim) over HTTP, so the key
// namespaces (common, nav, header, login, overview, roles, users, projects)
// and the {{ var }} interpolation syntax match 1:1.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import { getItem, LANG_KEY } from '@/lib/storage';

function initialLang(): 'en' | 'ar' {
  const saved = getItem(LANG_KEY);
  if (saved === 'ar' || saved === 'en') return saved;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
  return nav.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

void i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: initialLang(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    backend: {
      loadPath: '/assets/i18n/{{lng}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
