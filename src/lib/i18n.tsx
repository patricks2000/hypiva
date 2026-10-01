import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { de } from './i18n.de';
import { es } from './i18n.es';
import { fr } from './i18n.fr';
import { it } from './i18n.it';
import { nl } from './i18n.nl';
import { pl } from './i18n.pl';
import { pt } from './i18n.pt';
import { tr } from './i18n.tr';

export type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'pl' | 'tr';
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'pl', label: 'Polski' },
  { value: 'tr', label: 'Türkçe' },
];
const KEY = 'viewtra.lang';
const dictionaries: Record<Lang, Record<string, string> | null> = { en: null, nl, de, fr, es, it, pt, pl, tr };
const isLang = (v: unknown): v is Lang => typeof v === 'string' && Object.prototype.hasOwnProperty.call(dictionaries, v);

/** The first language on the phone or browser we have a translation for (e.g. de-AT → de), else English. */
const deviceLang = (): Lang => {
  try {
    for (const l of getLocales()) {
      const code = l.languageCode?.toLowerCase();
      if (isLang(code)) return code;
    }
  } catch {}
  return 'en';
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
const LOCALES: Record<Lang, string> = {
  en: 'en-GB', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', pl: 'pl-PL', tr: 'tr-TR',
};
export const dateLocale = () => LOCALES[current];

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (isLang(v)) { current = v; setLangState(v); }
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
