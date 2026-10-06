// Fetches fresh TikTok view counts for recent videos and saves them.
// Called every 3 hours by the database (pg_cron) with a secret, or by an admin from the app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseTikTokPage, sameAccount } from './parse.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-refresh-secret' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// TikTok serves the full page (with the view count) to desktop browsers; phones often get a bare shell.
const AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];
const get = (url: string, ua: string, redirect: RequestRedirect) =>
  fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' }, redirect, signal: AbortSignal.timeout(15000) });

/** Short links (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/) point to the real video page; follow them ourselves. */
async function resolve(url: string): Promise<string> {
  let cur = url;
  for (let i = 0; i < 4 && !/\/(?:video|photo)\/\d+/.test(cur); i++) {
    const res = await get(cur, AGENTS[0], 'manual');
    const next = res.headers.get('location');
    await res.body?.cancel();
    if (!next) break;
    cur = new URL(next, cur).toString();
  }
  const m = cur.match(/^(https:\/\/(?:www\.)?tiktok\.com\/@[^/?#]+\/(?:video|photo)\/\d+)/);
  return m ? m[1] : cur;
}

/** What the page holds, for the error message when no count is found. */
function describe(html: string): string {
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return 'no page data';
  try {
    const scope = JSON.parse(m[1])?.__DEFAULT_SCOPE__ ?? {};
    const keys = Object.keys(scope).filter((k) => /detail/i.test(k));
    const d = scope['webapp.video-detail'] ?? scope['webapp.reflow.video.detail'];
    return `${keys.join(',') || 'no detail'}${d ? ` status ${d.statusCode ?? '?'} ${d.statusMsg ?? ''}` : ''}`.slice(0, 70);
  } catch { return 'unreadable page data'; }
}

async function readVideo(url: string) {
  const page = await resolve(url);
  // Slideshows live at /photo/<id>; TikTok only puts the stats on the /video/<id> page.
  const pages = page.includes('/photo/') ? [page.replace('/photo/', '/video/'), page] : [page];
  let note = '';
  for (const p of pages) for (const ua of AGENTS) {
    const res = await get(p, ua, 'follow');
    if (!res.ok) { note += `TikTok answered ${res.status}; `; await res.body?.cancel(); continue; }
    const html = await res.text();
    const stats = parseTikTokPage(html);
    if (stats) return stats;
    note += `${new URL(res.url).pathname.split('/')[2] ?? ''}: ${html.length}b ${describe(html)}; `;
  }
  throw new Error(`Could not read the view count: ${note}`.slice(0, 200));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

  // Who may run this: the scheduled job (secret) or a signed-in admin.
  const secret = req.headers.get('x-refresh-secret');
  let allowed = false;
  if (secret) {
    const { data } = await admin.rpc('check_refresh_secret', { p_secret: secret });
    allowed = data === true;
  } else if (req.headers.get('authorization')) {
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get('authorization')! } }, auth: { persistSession: false } });
    const { data } = await asUser.rpc('is_admin');
    allowed = data === true;
  }
  if (!allowed) return json({ error: 'Not allowed' }, 401);

  const { data: videos, error } = await admin.rpc('videos_to_refresh', { p_limit: 40 });
  if (error) return json({ error: error.message }, 500);

  let updated = 0, failed = 0;
  for (const v of videos ?? []) {
    try {
      const s = await readVideo(v.url);
      if (!sameAccount(s.author, v.username)) {
        await admin.rpc('save_video_check', { p_id: v.id, p_views: null, p_author: s.author, p_error: `This video is from @${s.author}, not @${v.username}` });
        failed++;
      } else {
        await admin.rpc('save_video_check', { p_id: v.id, p_views: s.views, p_author: s.author, p_error: null });
        updated++;
      }
    } catch (e) {
      await admin.rpc('save_video_check', { p_id: v.id, p_views: null, p_author: null, p_error: String((e as Error).message).slice(0, 200) });
      failed++;
    }
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); // be gentle with TikTok
  }
  return json({ checked: (videos ?? []).length, updated, failed });
});
