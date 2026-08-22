import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {I18nManager, NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import tr from './locales/tr.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'tr', 'ru', 'ar', 'de', 'fr'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = AppLanguage | 'system';

// Languages that render right-to-left.
export const RTL_LANGUAGES: AppLanguage[] = ['ar'];

const STORAGE_KEY = '@radiotedu/language';

const resources = {
  en: {translation: en},
  tr: {translation: tr},
  ru: {translation: ru},
  ar: {translation: ar},
  de: {translation: de},
  fr: {translation: fr},
};

function isSupported(code: string): code is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

let languagePreference: LanguagePreference = 'system';

/** Resolve the device language from native OS settings with safe fallbacks. */
function getDeviceLanguage(): AppLanguage {
  const candidates: unknown[] = [];
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      candidates.push(settings?.AppleLocale, settings?.AppleLanguages?.[0]);
    } else {
      const platformConstants = NativeModules.PlatformConstants?.getConstants?.() ?? NativeModules.PlatformConstants;
      candidates.push(
        NativeModules.I18nManager?.localeIdentifier,
        NativeModules.I18nManager?.getConstants?.()?.localeIdentifier,
        platformConstants?.Locale,
        platformConstants?.localeIdentifier,
      );
    }
  } catch {
    // Continue through JavaScript locale fallback below.
  }
  try {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // Hermes builds without Intl use English fallback.
  }
  for (const candidate of candidates) {
    const code = String(candidate ?? '').toLowerCase().split(/[-_]/)[0];
    if (isSupported(code)) return code;
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // replaced by initI18n() at startup
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  interpolation: {escapeValue: false},
  // RN's Hermes lacks full Intl.PluralRules; v3 JSON keeps plurals simple.
  compatibilityJSON: 'v3',
  returnNull: false,
});

function applyRTL(lang: AppLanguage) {
  const shouldRTL = RTL_LANGUAGES.includes(lang);
  I18nManager.allowRTL(shouldRTL);
  if (I18nManager.isRTL !== shouldRTL) {
    I18nManager.forceRTL(shouldRTL);
    // Note: the layout direction only fully applies after an app reload.
  }
}

/** Resolve the saved/device language and apply it. Call once at startup. */
export async function initI18n(): Promise<AppLanguage> {
  let lang: AppLanguage;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    languagePreference = stored && isSupported(stored) ? stored : 'system';
    lang = languagePreference === 'system' ? getDeviceLanguage() : languagePreference;
  } catch {
    languagePreference = 'system';
    lang = getDeviceLanguage();
  }
  await i18n.changeLanguage(lang);
  applyRTL(lang);
  return lang;
}

/**
 * Change and persist the app language. Returns whether the RTL direction
 * changed (the caller should prompt the user to reopen the app if so).
 */
export async function setLanguage(lang: LanguagePreference): Promise<boolean> {
  const wasRTL = I18nManager.isRTL;
  languagePreference = lang;
  if (lang === 'system') {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await i18n.changeLanguage(getDeviceLanguage());
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    await i18n.changeLanguage(lang);
  }
  const effectiveLanguage = getCurrentLanguage();
  applyRTL(effectiveLanguage);
  return wasRTL !== RTL_LANGUAGES.includes(effectiveLanguage);
}

export function getCurrentLanguage(): AppLanguage {
  const code = (i18n.language || 'en').split(/[-_]/)[0];
  return isSupported(code) ? code : 'en';
}

export function getLanguagePreference(): LanguagePreference {
  return languagePreference;
}

export default i18n;
