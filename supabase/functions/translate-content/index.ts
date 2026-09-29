// Translates post texts (title, description, slide texts) into other languages with DeepL.
// Only admins and brand users may call it. Needs the secret DEEPL_API_KEY (free plan: 500,000 characters a month).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Our two-letter codes to DeepL's target codes.
const TARGET: Record<string, string> = { en: 'EN-GB', nl: 'NL', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT-PT', pl: 'PL', tr: 'TR', ar: 'AR' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'Not allowed' }, 401);
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: role } = await asUser.rpc('my_role');
  if (role !== 'admin' && role !== 'brand') return json({ error: 'Not allowed' }, 401);

  const key = Deno.env.get('DEEPL_API_KEY');
  if (!key) return json({ error: 'Automatic translation is not set up yet: add DEEPL_API_KEY in Supabase (Edge Functions → Secrets).' }, 400);

  let body: { texts?: unknown; source?: unknown; targets?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const texts = Array.isArray(body.texts) ? body.texts.map((x) => String(x ?? '')) : [];
  const source = typeof body.source === 'string' ? body.source : '';
  const targets = Array.isArray(body.targets) ? body.targets.map(String).filter((l) => l in TARGET && l !== source) : [];
  if (!texts.length || !targets.length || !(source in TARGET)) return json({ error: 'Nothing to translate' }, 400);
  if (texts.length > 40 || texts.join('').length > 12000) return json({ error: 'Too much text at once' }, 400);

  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const out: Record<string, string[]> = {};
  for (const lang of targets) {
    // Empty strings stay empty; DeepL only gets the real texts.
    const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: idx.map((i) => texts[i]), source_lang: source.toUpperCase(), target_lang: TARGET[lang], preserve_formatting: true }),
    });
    if (!res.ok) return json({ error: res.status === 456 ? 'The DeepL monthly limit is reached.' : `DeepL answered ${res.status}` }, 502);
    const data = await res.json() as { translations: { text: string }[] };
    const result = texts.map(() => '');
    idx.forEach((i, k) => { result[i] = data.translations[k]?.text ?? ''; });
    out[lang] = result;
  }
  return json({ translations: out });
});
