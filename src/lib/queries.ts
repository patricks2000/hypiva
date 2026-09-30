import { must } from './useLoad';
import { supabase } from './supabase';
import { usd } from './format';
import { dateLocale, t } from './i18n';
import type { Bonus, Campaign, CreatorBalance, CreatorRate, LeaderRow, LeaderboardSettings, MyReferral, Payout, PayoutAccount, Referral, ReferralSettings, Submission, TikTokAccount, WeekRow } from './types';

export const SUB_FIELDS = '*, campaigns(name, cpm_cents, min_views, fixed_cents), tiktok_accounts(username)';
export const SUB_FIELDS_WITH_CREATOR = '*, campaigns(name, cpm_cents, min_views, fixed_cents), tiktok_accounts(username, verified), profiles!submissions_creator_id_fkey(name, handle)';

export async function loadCreator(userId: string) {
  const [balance, subs, members, accounts, payouts, rates, weeks, bonuses, board, boardSettings, payoutAccount] = await Promise.all([
    supabase.from('creator_balances').select('*').eq('creator_id', userId).maybeSingle(),
    supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', userId).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaigns(*, brands(name))').eq('creator_id', userId),
    supabase.from('tiktok_accounts').select('*').eq('creator_id', userId).order('created_at'),
    supabase.from('payouts').select('*').eq('creator_id', userId).order('requested_at', { ascending: false }),
    supabase.from('creator_rates').select('*').eq('creator_id', userId),
    supabase.rpc('weekly_earnings', { p_weeks: 8 }),
    supabase.from('bonuses').select('*').eq('creator_id', userId).order('created_at', { ascending: false }),
    supabase.rpc('leaderboard', { p_limit: 5 }),
    supabase.from('leaderboard_settings').select('*').single(),
    supabase.from('payout_accounts').select('*').eq('creator_id', userId).maybeSingle(),
  ]);
  const joined = must(members as { data: { campaigns: Campaign | null }[] | null; error: unknown })
    .map((m) => m.campaigns).filter((c): c is Campaign => !!c);
  return {
    balance: (must(balance) as CreatorBalance | null) ?? emptyBalance(userId),
    subs: withRates(must(subs) as Submission[], must(rates) as CreatorRate[]),
    joined,
    rates: must(rates) as CreatorRate[],
    weeks: must(weeks) as WeekRow[],
    bonuses: must(bonuses) as Bonus[],
    board: must(board) as LeaderRow[],
    boardSettings: must(boardSettings) as LeaderboardSettings,
    accounts: must(accounts) as TikTokAccount[],
    payouts: must(payouts) as Payout[],
    payoutAccount: must(payoutAccount) as PayoutAccount | null,
  };
}

export const emptyBalance = (id: string): CreatorBalance => ({
  creator_id: id, name: '', handle: null, videos: 0, paid_videos: 0, views: 0, video_earned_cents: 0, invites: 0, referral_earned_cents: 0,
  earned_cents: 0, paid_cents: 0, requested_cents: 0, owed_cents: 0, available_cents: 0, bonus_cents: 0,
});

export async function loadReferrals(userId: string) {
  const [settings, mine, invitedBy] = await Promise.all([
    supabase.from('referral_settings').select('*').single(),
    supabase.rpc('my_referrals'),
    supabase.from('referrals').select('*').eq('referred_id', userId).maybeSingle(),
  ]);
  return {
    settings: must(settings) as ReferralSettings,
    invites: must(mine) as MyReferral[],
    invitedBy: must(invitedBy) as Referral | null,
  };
}

/** "5% of their approved earnings for 6 months, up to $100 per creator" */
export const programLine = (s: ReferralSettings) =>
  t('You get {p}% of what each person you invite earns, for {m} months, up to {cap} per person.', { p: s.percent_bp / 100, m: s.months, cap: usd(s.cap_cents) });

/** The rate a creator gets on a campaign: a rate for that campaign, else a rate for all campaigns, else the campaign's own. */
export function rateFor(rates: CreatorRate[], creatorId: string, c: Pick<Campaign, 'id' | 'cpm_cents' | 'min_views'> & { fixed_cents?: number | null }) {
  const own = rates.find((r) => r.creator_id === creatorId && r.campaign_id === c.id)
    ?? rates.find((r) => r.creator_id === creatorId && r.campaign_id === null);
  const fixed = c.fixed_cents ?? null;
  // A special rate per 1K means nothing in a fixed-per-video campaign; only its minimum still applies.
  return { cpm_cents: own?.cpm_cents ?? c.cpm_cents, min_views: own?.min_views ?? c.min_views, fixed_cents: fixed,
    custom: !!own && (fixed == null || own.min_views != null) };
}

export type Rate = ReturnType<typeof rateFor>;

/** "$2.00 per 1K views" or "$5.00 per video". */
export const payLabel = (r: { cpm_cents: number; fixed_cents?: number | null }) =>
  r.fixed_cents != null ? t('{x} per video', { x: usd(r.fixed_cents) }) : t('{x} per 1K views', { x: usd(r.cpm_cents) });

/** Puts each creator's own rate on their videos so every screen shows the right amount. Same rule as the database. */
export function withRates(subs: Submission[], rates: CreatorRate[]): Submission[] {
  if (!rates.length) return subs;
  return subs.map((s) => {
    if (!s.campaigns) return s;
    const r = rateFor(rates, s.creator_id, { id: s.campaign_id, cpm_cents: s.campaigns.cpm_cents, min_views: s.campaigns.min_views, fixed_cents: s.campaigns.fixed_cents });
    return { ...s, campaigns: { ...s.campaigns, cpm_cents: r.cpm_cents, min_views: r.min_views } };
  });
}

/** Monday date string -> "22-28 Sep" */
export const weekLabel = (start: string) => {
  const a = new Date(start + 'T00:00:00'), b = new Date(a.getTime() + 6 * 864e5);
  const m = (d: Date) => d.toLocaleDateString(dateLocale(), { month: 'short' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()}-${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} - ${b.getDate()} ${m(b)}`;
};

/** "September 2026" for the first day of a month. */
export const monthLabel = (d: Date) => d.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
