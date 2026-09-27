// Special rates and weekly totals through the real API.
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const ok = (c, w) => { if (!c) { console.error('FAILED:', w); process.exit(1); } console.log('ok ', w); };
const login = async (email) => { const c = createClient(url, key, { auth: { persistSession: false } }); must(await c.auth.signInWithPassword({ email, password: 'password123' })); return { c, id: (await c.auth.getUser()).data.user.id }; };
const owner = await login('owner@viewtra.test'), nina = await login('nina@viewtra.test');
const before = must(await nina.c.from('creator_balances').select('video_earned_cents').single()).video_earned_cents;
ok((await nina.c.from('creator_rates').insert({ creator_id: nina.id, cpm_cents: 5000 })).error, 'Nina cannot give herself a rate');
must(await owner.c.from('creator_rates').insert({ creator_id: nina.id, cpm_cents: 100, note: '$1 deal' }));
const after = must(await nina.c.from('creator_balances').select('video_earned_cents').single()).video_earned_cents;
ok(after === before / 2, `Nina at $1 instead of $2: $${before / 100} -> $${after / 100}`);
const weeks = must(await owner.c.rpc('weekly_earnings', { p_weeks: 4 }));
ok(weeks.length > 0, `weekly totals: ${[...new Set(weeks.map((w) => w.week_start))].length} weeks with earnings`);
console.log('E2E RATES FLOW PASSED');
