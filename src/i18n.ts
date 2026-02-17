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
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Prioritize navigator. Remove htmlTag to avoid issues with default lang="en".
      order: ['navigator', 'path', 'subdomain'],
      // Do not cache in localStorage since we don't have a language switcher.
      caches: [],
    }
  });

export default i18n;
