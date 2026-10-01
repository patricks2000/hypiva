import { t } from './i18n';

export type Role = 'creator' | 'brand' | 'admin';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  name: string;
  handle: string | null;
  role: Role;
  is_owner: boolean;
  brand_id: string | null;
  referral_code: string;
  /** Language this creator posts in (two letters); null = not chosen yet. */
  content_language: string | null;
  created_at: string;
}

/** How a creator gets paid. Only the creator and admins can read it. */
export interface PayoutAccount {
  creator_id: string;
  method: 'paypal' | 'bank';
  details: string;
  updated_at: string;
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
  /** Set = a fixed amount per video instead of pay per 1K views. */
  fixed_cents: number | null;
  budget_cents: number;
  status: 'live' | 'paused' | 'ended';
  instructions: string;
  requirements: string[];
  created_at: string;
  brands?: { name: string } | null;
}

export interface TikTokAccount { id: string; creator_id: string; username: string; verified: boolean; verify_code: string; verified_at: string | null }

export interface Submission {
  id: string;
  campaign_id: string;
  creator_id: string;
  tiktok_account_id: string;
  url: string;
  status: SubmissionStatus;
  views: number;
  views_updated_at: string | null;
  views_checked_at?: string | null;
  views_error?: string | null;
  reject_reason: string | null;
  content_pack_id?: string | null;
  created_at: string;
  campaigns?: Pick<Campaign, 'name' | 'cpm_cents' | 'min_views' | 'fixed_cents'> | null;
  tiktok_accounts?: { username: string; verified?: boolean } | null;
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
  profiles?: { name: string; handle: string | null } | null;
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
  bonus_cents: number;
}

export interface ReferralSettings { percent_bp: number; months: number; cap_cents: number; signup_window_days: number }

export interface MyReferral { referred_id: string; first_name: string; joined_at: string; ends_at: string; bonus_cents: number; capped: boolean }

export interface Referral { referred_id: string; referrer_id: string; created_at: string }

export interface ReferralBonus { referrer_id: string; referred_id: string; created_at: string; ends_at: string; invited_earned_cents: number; bonus_cents: number; capped: boolean }

export interface CreatorRate { id: string; creator_id: string; campaign_id: string | null; cpm_cents: number; min_views: number | null; note: string | null }

export interface WeekRow { week_start: string; creator_id: string; name: string; video_cents: number; videos_counted: number }

export interface Bonus { id: string; creator_id: string; amount_cents: number; reason: string; created_at: string }

export interface LeaderRow { rank: number; creator_id: string | null; first_name: string; views_gained: number; earned_cents: number | null; is_me: boolean }

export interface LeaderboardSettings { visible: boolean; prize_text: string }

export interface ContentSlide { id: string; pack_id: string; position: number; image_url: string; overlay_text: string }

export interface ContentPack {
  id: string; campaign_id: string; title: string; description: string; hashtags: string; active: boolean; created_at: string;
  /** Two-letter language code, e.g. "en" or "nl". */
  language: string;
  content_slides?: ContentSlide[];
}

export interface CampaignStats { campaign_id: string; videos: number; views: number; spent_cents: number }

export const kindLabel = (k: Campaign['kind']) => (k === 'ready_to_post' ? t('Content included') : t('Film it yourself'));

/** A campaign request from the form on the homepage. */
export interface BrandLead { id: string; name: string; email: string; company: string; budget: string; currency: 'USD' | 'EUR'; message: string; handled: boolean; created_at: string }
