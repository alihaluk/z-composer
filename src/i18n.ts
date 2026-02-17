import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import tr from './locales/tr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    supportedLngs: ['en', 'tr'],
    load: 'languageOnly', // 'tr-TR' -> 'tr'
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Prioritize querystring, then localStorage, then navigator.
      // Remove htmlTag to avoid issues with default lang="en".
      order: ['querystring', 'localStorage', 'navigator', 'path', 'subdomain'],
      // Cache in localStorage to remember user preference
      caches: ['localStorage'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'i18nextLng',
    }
  });

export default i18n;
