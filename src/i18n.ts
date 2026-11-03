import { createInstance, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import tr from './locales/tr.json';

export type Language = 'tr' | 'en';
export const LANGUAGES: Language[] = ['tr', 'en'];

/**
 * Each designer instance has its own i18next instance, so embedding it never changes the
 * host application's translations. Without a fixed language it is detected from the
 * `lng` query parameter, the last choice, or the browser.
 */
export function createI18n(language?: Language): I18n {
  const instance = createInstance();
  if (!language) instance.use(LanguageDetector);
  instance.use(initReactI18next).init({
    resources: { en: { translation: en }, tr: { translation: tr } },
    lng: language,
    supportedLngs: LANGUAGES,
    load: 'languageOnly',
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'i18nextLng',
    },
  });
  return instance;
}

/** Default preview culture for an interface language. */
export const defaultLocale = (language: string | undefined) => (language === 'en' ? 'en-US' : 'tr-TR');
