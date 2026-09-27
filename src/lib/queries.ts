import { must } from './useLoad';
import { supabase } from './supabase';
import { usd } from './format';
import type { Campaign, CreatorBalance, CreatorRate, MyReferral, Payout, Referral, ReferralSettings, Submission, TikTokAccount, WeekRow } from './types';

export const SUB_FIELDS = '*, campaigns(name, cpm_cents, min_views), tiktok_accounts(username)';
export const SUB_FIELDS_WITH_CREATOR = '*, campaigns(name, cpm_cents, min_views), tiktok_accounts(username), profiles!submissions_creator_id_fkey(name, handle)';

export async function loadCreator(userId: string) {
  const [balance, subs, members, accounts, payouts, rates, weeks] = await Promise.all([
    supabase.from('creator_balances').select('*').eq('creator_id', userId).maybeSingle(),
    supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', userId).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaigns(*, brands(name))').eq('creator_id', userId),
    supabase.from('tiktok_accounts').select('*').eq('creator_id', userId).order('created_at'),
    supabase.from('payouts').select('*').eq('creator_id', userId).order('requested_at', { ascending: false }),
    supabase.from('creator_rates').select('*').eq('creator_id', userId),
    supabase.rpc('weekly_earnings', { p_weeks: 8 }),
  ]);
  const joined = must(members as { data: { campaigns: Campaign | null }[] | null; error: unknown })
    .map((m) => m.campaigns).filter((c): c is Campaign => !!c);
  return {
    balance: (must(balance) as CreatorBalance | null) ?? emptyBalance(userId),
    subs: withRates(must(subs) as Submission[], must(rates) as CreatorRate[]),
    joined,
    rates: must(rates) as CreatorRate[],
    weeks: must(weeks) as WeekRow[],
    accounts: must(accounts) as TikTokAccount[],
    payouts: must(payouts) as Payout[],
  };
}

export const emptyBalance = (id: string): CreatorBalance => ({
  creator_id: id, name: '', handle: null, videos: 0, paid_videos: 0, views: 0, video_earned_cents: 0, invites: 0, referral_earned_cents: 0,
  earned_cents: 0, paid_cents: 0, requested_cents: 0, owed_cents: 0, available_cents: 0,
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
  `${s.percent_bp / 100}% of each invited creator's approved earnings for ${s.months} months, up to ${usd(s.cap_cents)} per creator.`;

/** The rate a creator gets on a campaign: a rate for that campaign, else a rate for all campaigns, else the campaign's own. */
export function rateFor(rates: CreatorRate[], creatorId: string, c: Pick<Campaign, 'id' | 'cpm_cents' | 'min_views'>) {
  const own = rates.find((r) => r.creator_id === creatorId && r.campaign_id === c.id)
    ?? rates.find((r) => r.creator_id === creatorId && r.campaign_id === null);
  return { cpm_cents: own?.cpm_cents ?? c.cpm_cents, min_views: own?.min_views ?? c.min_views, custom: !!own };
}

/** Puts each creator's own rate on their videos so every screen shows the right amount. Same rule as the database. */
export function withRates(subs: Submission[], rates: CreatorRate[]): Submission[] {
  if (!rates.length) return subs;
  return subs.map((s) => {
    if (!s.campaigns) return s;
    const r = rateFor(rates, s.creator_id, { id: s.campaign_id, cpm_cents: s.campaigns.cpm_cents, min_views: s.campaigns.min_views });
    return { ...s, campaigns: { ...s.campaigns, cpm_cents: r.cpm_cents, min_views: r.min_views } };
  });
}

/** Monday date string -> "22-28 Sep" */
export const weekLabel = (start: string) => {
  const a = new Date(start + 'T00:00:00'), b = new Date(a.getTime() + 6 * 864e5);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()}-${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} - ${b.getDate()} ${m(b)}`;
};
