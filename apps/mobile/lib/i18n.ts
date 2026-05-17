import i18n, { init } from 'i18next';
import * as Localization from 'expo-localization';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
};

const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'en';

init({
  resources,
  lng: deviceLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
