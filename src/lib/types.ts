export type Role = 'creator' | 'brand' | 'admin';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  name: string;
  handle: string | null;
  role: Role;
  is_owner: boolean;
  brand_id: string | null;
  payout_method: 'paypal' | 'bank' | null;
  payout_details: string | null;
  referral_code: string;
  created_at: string;
}

export interface Brand { id: string; name: string }

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  kind: 'ready_to_post' | 'create_your_own';
  cpm_cents: number;
  min_views: number;
  budget_cents: number;
  status: 'live' | 'paused' | 'ended';
  created_at: string;
  brands?: { name: string } | null;
}

export interface TikTokAccount { id: string; creator_id: string; username: string; verified: boolean }

export interface Submission {
  id: string;
  campaign_id: string;
  creator_id: string;
  tiktok_account_id: string;
  url: string;
  status: SubmissionStatus;
  views: number;
  views_updated_at: string | null;
  reject_reason: string | null;
  created_at: string;
  campaigns?: Pick<Campaign, 'name' | 'cpm_cents' | 'min_views'> | null;
  tiktok_accounts?: { username: string } | null;
  profiles?: { name: string; handle: string | null } | null;
}

export interface Payout {
  id: string;
  creator_id: string;
  amount_cents: number;
  status: 'requested' | 'paid' | 'cancelled';
  requested_at: string;
  paid_at: string | null;
  note: string | null;
  profiles?: { name: string; handle: string | null; payout_method: string | null; payout_details: string | null } | null;
}

export interface CreatorBalance {
  creator_id: string;
  name: string;
  handle: string | null;
  videos: number;
  paid_videos: number;
  views: number;
  video_earned_cents: number;
  invites: number;
  referral_earned_cents: number;
  earned_cents: number;
  paid_cents: number;
  requested_cents: number;
  owed_cents: number;
  available_cents: number;
}

export interface ReferralSettings { percent_bp: number; months: number; cap_cents: number; signup_window_days: number }

export interface MyReferral { referred_id: string; first_name: string; joined_at: string; ends_at: string; bonus_cents: number; capped: boolean }

export interface Referral { referred_id: string; referrer_id: string; created_at: string }

export interface ReferralBonus { referrer_id: string; referred_id: string; created_at: string; ends_at: string; invited_earned_cents: number; bonus_cents: number; capped: boolean }

export interface CampaignStats { campaign_id: string; videos: number; views: number; spent_cents: number }

export const kindLabel = (k: Campaign['kind']) => (k === 'ready_to_post' ? 'Ready-to-post' : 'Create your own');
