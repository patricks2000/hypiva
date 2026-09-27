import { must } from './useLoad';
import { supabase } from './supabase';
import { usd } from './format';
import type { Campaign, CreatorBalance, MyReferral, Payout, Referral, ReferralSettings, Submission, TikTokAccount } from './types';

export const SUB_FIELDS = '*, campaigns(name, cpm_cents, min_views), tiktok_accounts(username)';
export const SUB_FIELDS_WITH_CREATOR = '*, campaigns(name, cpm_cents, min_views), tiktok_accounts(username), profiles!submissions_creator_id_fkey(name, handle)';

export async function loadCreator(userId: string) {
  const [balance, subs, members, accounts, payouts] = await Promise.all([
    supabase.from('creator_balances').select('*').eq('creator_id', userId).maybeSingle(),
    supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', userId).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaigns(*, brands(name))').eq('creator_id', userId),
    supabase.from('tiktok_accounts').select('*').eq('creator_id', userId).order('created_at'),
    supabase.from('payouts').select('*').eq('creator_id', userId).order('requested_at', { ascending: false }),
  ]);
  const joined = must(members as { data: { campaigns: Campaign | null }[] | null; error: unknown })
    .map((m) => m.campaigns).filter((c): c is Campaign => !!c);
  return {
    balance: (must(balance) as CreatorBalance | null) ?? emptyBalance(userId),
    subs: must(subs) as Submission[],
    joined,
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
