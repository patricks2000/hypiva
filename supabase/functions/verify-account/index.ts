// Checks that a creator owns a TikTok account: their personal code (e.g. HY-3F9A2C) must be in the account's bio.
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** The bio and account name from a TikTok profile page. */
function readProfile(html: string): { id: string | null; bio: string } | null {
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const user = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user;
      if (user) return { id: user.uniqueId ?? null, bio: String(user.signature ?? '') };
    } catch { /* fall through */ }
  }
  const bio = html.match(/"signature":"((?:[^"\\]|\\.)*)"/);
  if (!bio) return null;
  const id = html.match(/"uniqueId":"([^"]+)"/);
  return { id: id ? id[1] : null, bio: JSON.parse(`"${bio[1]}"`) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'Not allowed' }, 401);
  const asUser = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Not allowed' }, 401);

  const { account } = await req.json().catch(() => ({ account: null }));
  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: acc } = await admin.from('tiktok_accounts').select('id, creator_id, username, verify_code, verified').eq('id', String(account)).maybeSingle();
  if (!acc || acc.creator_id !== user.id) return json({ error: 'Account not found' }, 404);
  if (acc.verified) return json({ verified: true });

  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(acc.username)}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return json({ verified: false, reason: `TikTok answered ${res.status}. Try again in a minute.` });
  const p = readProfile(await res.text());
  if (!p) return json({ verified: false, reason: 'Could not read this TikTok profile. Is the username right?' });
  if (p.id && p.id.toLowerCase() !== acc.username.toLowerCase()) return json({ verified: false, reason: 'This TikTok account does not exist.' });
  const clean = (s: string) => s.toUpperCase().replace(/\s+/g, '');
  if (!clean(p.bio).includes(clean(acc.verify_code))) {
    return json({ verified: false, reason: `We could not find ${acc.verify_code} in the bio of @${acc.username} yet. TikTok can take a few minutes to show a new bio.` });
  }
  await admin.rpc('mark_account_verified', { p_account: acc.id });
  return json({ verified: true });
});
