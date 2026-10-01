// Saves a campaign request from the homepage form. Public on purpose (visitors have no login);
// it only inserts into brand_leads, checks the input and ignores bots (hidden "website" field).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = ['https://www.hypiva.com', 'https://hypiva.com', 'https://hypiva.vercel.app'];
const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin'));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Not allowed' }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const s = (k: string, max: number) => String(b[k] ?? '').trim().slice(0, max);
  if (s('website', 200)) return json({ ok: true }); // bot filled the hidden field
  const lead = { name: s('name', 100), email: s('email', 200), company: s('company', 120), budget: s('budget', 60), message: s('message', 2000) };
  if (!lead.name) return json({ error: 'Please add your name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return json({ error: 'Please add a valid email address.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Simple flood guard: max 5 requests per email per day.
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await admin.from('brand_leads').select('id', { count: 'exact', head: true }).eq('email', lead.email).gte('created_at', since);
  if ((count ?? 0) >= 5) return json({ ok: true });
  const { error } = await admin.from('brand_leads').insert(lead);
  if (error) return json({ error: 'Something went wrong. Please email patrick@hypiva.com.' }, 500);
  return json({ ok: true });
});
