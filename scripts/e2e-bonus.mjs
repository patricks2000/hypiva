// Manual bonus and leaderboard through the real API.
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const ok = (c, w) => { if (!c) { console.error('FAILED:', w); process.exit(1); } console.log('ok ', w); };
const login = async (email) => { const c = createClient(url, key, { auth: { persistSession: false } }); must(await c.auth.signInWithPassword({ email, password: 'password123' })); return { c, id: (await c.auth.getUser()).data.user.id }; };
const owner = await login('owner@viewtra.test'), sam = await login('sam@viewtra.test');
ok((await sam.c.rpc('leaderboard')).data.length === 0, 'leaderboard hidden from creators by default');
const top = must(await owner.c.rpc('leaderboard'));
ok(top.length > 0, `owner sees the top: #1 is ${top[0].first_name} with ${top[0].views_gained} views`);
const before = must(await sam.c.from('creator_balances').select('owed_cents').single()).owed_cents;
must(await owner.c.from('bonuses').insert({ creator_id: sam.id, amount_cents: 5000, reason: 'Top creator of September' }));
const after = must(await sam.c.from('creator_balances').select('owed_cents, bonus_cents').single());
ok(after.owed_cents === before + 5000 && after.bonus_cents === 5000, `Sam's $50 bonus: owed $${before / 100} -> $${after.owed_cents / 100}`);
must(await owner.c.from('leaderboard_settings').update({ visible: true, prize_text: '$50 for the #1 creator of the month' }).eq('id', true));
const seen = must(await sam.c.rpc('leaderboard', { p_limit: 5 }));
ok(seen.length > 0 && seen.every((r) => r.earned_cents === null), 'after switching it on, creators see names and views only');
console.log('E2E BONUS FLOW PASSED');
