import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { t } from './i18n';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'https://not-configured.supabase.co', anonKey || 'not-configured', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On the website, links from emails (confirm account, reset password) carry the login in the URL.
    detectSessionInUrl: Platform.OS === 'web',
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
  if (/duplicate key.*url/i.test(msg)) return t('This video was already sent in.');
  if (/duplicate key.*username/i.test(msg)) return t('This TikTok account is already linked to someone.');
  if (/duplicate key.*handle/i.test(msg)) return t('That username is taken. Try another one.');
  if (/payouts_one_open_request/i.test(msg)) return t('You already have a payout request open.');
  if (/Invalid login credentials/i.test(msg)) return t('Email or password is wrong.');
  if (/check constraint.*handle/i.test(msg)) return t('Usernames use 2-30 lowercase letters, numbers, dots or underscores.');
  if (/check constraint.*username/i.test(msg)) return t('TikTok usernames use letters, numbers, dots or underscores.');
  if (/network|fetch/i.test(msg)) return t('No connection. Check your internet and try again.');
  // Messages from the database are written as plain English sentences; translate the ones we know.
  return t(msg);
}
