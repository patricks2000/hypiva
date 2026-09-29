// Invite flow through the real API: Sam signs up with Alex's code, posts, and Alex earns 5%.
// Run after scripts/e2e-seed.mjs. Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/e2e-invite.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const ok = (c, w) => { if (!c) { console.error('FAILED:', w); process.exit(1); } console.log('ok ', w); };
const login = async (email) => {
  const c = client();
  must(await c.auth.signInWithPassword({ email, password: 'password123' }));
  const { data } = await c.auth.getUser();
  return { c, id: data.user.id };
};

const alex = await login('alex@viewtra.test');
const code = must(await alex.c.from('profiles').select('referral_code').eq('id', alex.id).single()).referral_code;
ok(/^HY/.test(code), `Alex has code ${code}`);

const sam = client();
must(await sam.auth.signUp({ email: 'sam@viewtra.test', password: 'password123', options: { data: { name: 'Sam de Vries', referral_code: code.toLowerCase() } } }));
const samId = (await sam.auth.getUser()).data.user.id;
const owner = await login('owner@viewtra.test');
const maya = await login('brand@viewtra.test');

const camp = must(await sam.from('campaigns').select('id').eq('name', 'Macro Snap: Repost').single());
must(await sam.from('campaign_members').insert({ campaign_id: camp.id, creator_id: samId }));
const [acc] = must(await sam.from('tiktok_accounts').insert({ creator_id: samId, username: 'sam.fit' }).select());
for (const [i, views] of [[1, 20000], [2, 700]]) {
  const [s] = must(await sam.from('submissions').insert({ campaign_id: camp.id, creator_id: samId, tiktok_account_id: acc.id, url: `https://www.tiktok.com/@sam.fit/video/88${i}` }).select());
  must(await maya.c.from('submissions').update({ status: 'approved' }).eq('id', s.id));
  must(await owner.c.from('submissions').update({ views }).eq('id', s.id));
}

const a = must(await alex.c.from('creator_balances').select('*').single());
ok(a.referral_earned_cents === 200 && a.invites === 1, `Alex gets 5% of Sam's $40.00 = $2.00 (his total is now $${(a.earned_cents / 100).toFixed(2)})`);
const s = must(await sam.from('creator_balances').select('*').single());
ok(s.earned_cents === 4000, 'Sam keeps his full $40.00 (the 700-view video earns nothing)');
const list = must(await alex.c.rpc('my_referrals'));
ok(list.length === 1 && list[0].first_name === 'Sam', 'Alex sees "Sam" in his invites');
ok((await sam.from('creator_balances').select('*')).data.length === 1, "Sam cannot see Alex's balance");
const all = must(await owner.c.from('referral_bonuses').select('*'));
ok(all.length === 1 && all[0].bonus_cents === 200, 'the owner sees every invite and its bonus');
console.log('E2E INVITE FLOW PASSED');
