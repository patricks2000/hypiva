// End-to-end check against a running Supabase (local or real): signs people up, runs the full
// creator -> brand -> admin -> payout flow through the same API the app uses, and prints the result.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/e2e-seed.mjs   (then make the owner, see below)
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = (cond, what) => { if (!cond) { console.error('FAILED:', what); process.exit(1); } console.log('ok ', what); };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

async function signUp(email, name) {
  const c = client();
  const { data, error } = await c.auth.signUp({ email, password: 'password123', options: { data: { name } } });
  if (error) throw error;
  return { c, id: data.user.id };
}

const step = process.argv[2] ?? 'users';

if (step === 'users') {
  for (const [e, n] of [['owner@viewtra.test', 'Patrick (owner)'], ['alex@viewtra.test', 'Alex Rivera'], ['nina@viewtra.test', 'Nina Brooks'],
    ['liam@viewtra.test', 'Liam Foster'], ['brand@viewtra.test', 'Maya (Macro Snap)']]) {
    const { id } = await signUp(e, n);
    console.log(e, id);
  }
  process.exit(0);
}

const login = async (email) => { const c = client(); must(await c.auth.signInWithPassword({ email, password: 'password123' })); const { data } = await c.auth.getUser(); return { c, id: data.user.id }; };
const owner = await login('owner@viewtra.test');
const alex = await login('alex@viewtra.test');
const nina = await login('nina@viewtra.test');
const liam = await login('liam@viewtra.test');
const maya = await login('brand@viewtra.test');

ok(must(await owner.c.from('profiles').select('role,is_owner').eq('id', owner.id).single()).is_owner, 'owner is set up');

const [brand] = must(await owner.c.from('brands').insert({ name: 'Macro Snap' }).select());
must(await owner.c.from('brands').insert({ name: 'Liftlog' }));
must(await owner.c.rpc('set_user_role', { p_user: maya.id, p_role: 'brand', p_brand: brand.id }));
ok((await alex.c.rpc('set_user_role', { p_user: alex.id, p_role: 'admin' })).error, 'a creator cannot make himself admin');

const [camp] = must(await maya.c.from('campaigns').insert({ brand_id: brand.id, name: 'Macro Snap: Repost', description: 'Repost faceless slideshows for the Macro Snap calorie tracker. Show the app on the last slide.', cpm_cents: 200, budget_cents: 500000 }).select());
must(await maya.c.from('campaigns').insert({ brand_id: brand.id, name: 'Macro Snap: Creative', kind: 'create_your_own', description: "Film your own 'what I eat in a day' with the app on screen.", cpm_cents: 350, budget_cents: 300000 }));

const posts = { alex: [500, 800, 1000, 4200, 12800], nina: [2500, 950, 30100], liam: [640, 1800] };
let n = 0;
for (const [who, p] of [['alex', alex], ['nina', nina], ['liam', liam]]) {
  must(await p.c.from('campaign_members').insert({ campaign_id: camp.id, creator_id: p.id }));
  const [acc] = must(await p.c.from('tiktok_accounts').insert({ creator_id: p.id, username: `${who}.fit` }).select());
  for (const v of posts[who]) {
    n++;
    const [s] = must(await p.c.from('submissions').insert({ campaign_id: camp.id, creator_id: p.id, tiktok_account_id: acc.id, url: `https://www.tiktok.com/@${who}.fit/video/74${1000 + n}` }).select());
    s._views = v;
    if (n % 5 !== 0) must(await maya.c.from('submissions').update({ status: 'approved' }).eq('id', s.id));
    must(await owner.c.from('submissions').update({ views: v }).eq('id', s.id));
  }
}
ok((await alex.c.from('submissions').select('id')).data.length === 5, 'Alex sees only his 5 videos');
ok((await maya.c.from('creator_balances').select('*')).data.length === 0, 'the brand cannot see balances');
const a = must(await alex.c.from('creator_balances').select('*').single());
ok(a.earned_cents === 1040 && a.paid_videos === 2, 'Alex: 500, 800, 1,000 and 4,200 views approved -> only 1,000 ($2.00) and 4,200 ($8.40) earn = $10.40');
const all = must(await owner.c.from('creator_balances').select('*'));
console.table(all.map((r) => ({ name: r.name, videos: r.videos, over_min: r.paid_videos, views: r.views, earned: r.earned_cents / 100, owed: r.owed_cents / 100 })));
must(await nina.c.from('profiles').update({ payout_method: 'paypal', payout_details: 'nina@example.com' }).eq('id', nina.id));
const req = must(await nina.c.rpc('request_payout'));
ok(req.amount_cents > 0, `Nina requested ${req.amount_cents / 100}`);
ok((await owner.c.rpc('mark_creator_paid', { p_creator: liam.id })).error, 'Liam has nothing owed (no approved video reached 1,000)');
must(await owner.c.rpc('mark_creator_paid', { p_creator: nina.id, p_note: 'PayPal test' }));
ok(must(await nina.c.from('creator_balances').select('owed_cents').single()).owed_cents === 0, 'Nina paid and settled');
console.log('E2E FLOW PASSED');
