import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'https://not-configured.supabase.co', anonKey || 'not-configured', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the login fresh only while the app is open.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Turns a Supabase error into a sentence people can act on. */
export function friendlyError(err: unknown): string {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  if (/duplicate key.*url/i.test(msg)) return 'This video was already sent in.';
  if (/duplicate key.*username/i.test(msg)) return 'This TikTok account is already linked to someone.';
  if (/duplicate key.*handle/i.test(msg)) return 'That username is taken. Try another one.';
  if (/payouts_one_open_request/i.test(msg)) return 'You already have a payout request open.';
  if (/Invalid login credentials/i.test(msg)) return 'Email or password is wrong.';
  if (/check constraint.*handle/i.test(msg)) return 'Usernames use 2-30 lowercase letters, numbers, dots or underscores.';
  if (/check constraint.*username/i.test(msg)) return 'TikTok usernames use letters, numbers, dots or underscores.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}
