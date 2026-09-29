/** Languages content can be made in. Creators pick one when they post. */
export const CONTENT_LANGUAGES = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'nl', label: '🇳🇱 Nederlands' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'pl', label: '🇵🇱 Polski' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'ar', label: '🇸🇦 العربية' },
] as const;

export const languageLabel = (code: string) => CONTENT_LANGUAGES.find((l) => l.value === code)?.label ?? code.toUpperCase();
