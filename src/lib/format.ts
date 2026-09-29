import { dateLocale } from './i18n';

/** $12.34 from cents. */
export const usd = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1,234,567 */
export const num = (n: number) => Math.round(n).toLocaleString(dateLocale());

/** 950, 1.5K, 12K, 1.2M */
export const short = (n: number) => {
  const s = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(Math.round(n));
  return s.replace('.0', '');
};

export const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const initials = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

/**
 * Same rule as the database (video_earnings_cents): views count per video, never added up.
 * Below the minimum a video earns nothing; from the minimum on every view counts.
 */
export const videoEarningsCents = (views: number, minViews: number, cpmCents: number, fixedCents?: number | null) =>
  views < minViews ? 0 : fixedCents != null ? fixedCents : Math.floor((views * cpmCents) / 1000);

export const isTikTokUrl = (url: string) => /^https:\/\/(www\.|vm\.|m\.)?tiktok\.com\//i.test(url.trim());

/** Turns "$2.50" or "2,5" into cents; null when it is not a number. */
export const parseDollars = (text: string): number | null => {
  const n = Number(text.replace(/[$\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

/** Dollar cents shown in euros at the owner's rate: "€77.40". */
export const eur = (usdCents: number, eurPerUsd: number) =>
  '€' + ((usdCents / 100) * eurPerUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
