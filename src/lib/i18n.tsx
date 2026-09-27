import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { nl } from './i18n.nl';

export type Lang = 'en' | 'nl';
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
];
const KEY = 'viewtra.lang';
const dictionaries: Record<Lang, Record<string, string> | null> = { en: null, nl };

const deviceLang = (): Lang => {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    return code === 'nl' ? 'nl' : 'en';
  } catch {
    return 'en';
  }
};

let current: Lang = deviceLang();

/**
 * Translate an English sentence. The English text is the key, so screens stay readable.
 * Placeholders like {n} are filled from vars. Missing translations fall back to English.
 */
export function t(en: string, vars?: Record<string, string | number>): string {
  let s = dictionaries[current]?.[en] ?? en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const currentLang = () => current;
/** Locale for dates, e.g. "27 Sept" vs "27 sep". */
export const dateLocale = () => (current === 'nl' ? 'nl-NL' : 'en-GB');

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'en' || v === 'nl') { current = v; setLangState(v); }
    }).catch(() => {});
  }, []);
  const setLang = (l: Lang) => {
    current = l;
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  };
  // Remount the app below so every screen redraws in the new language.
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <View key={lang} style={{ flex: 1 }}>{children}</View>
    </LangContext.Provider>
  );
}

export const useLanguage = () => useContext(LangContext);
