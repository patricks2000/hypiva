// Emails the owner when someone leaves a review on hypiva.com/write-review. Called by the database (with the shared secret).
// Needs RESEND_API_KEY; without it, it does nothing (new reviews still show under People in the app).
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: ok } = await admin.rpc('check_refresh_secret', { p_secret: req.headers.get('x-refresh-secret') ?? '' });
  if (ok !== true) return new Response('Not allowed', { status: 401 });
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return new Response('No email key set', { status: 200 });

  const { id } = await req.json().catch(() => ({ id: null }));
  const { data: r } = await admin.from('reviews')
    .select('name, company, role, body, rating, service, lang, photo_url').eq('id', String(id)).maybeSingle();
  if (!r) return new Response('Review not found', { status: 200 });

  const to = Deno.env.get('OWNER_EMAIL') ?? 'patrick@hypiva.com';
  const from = Deno.env.get('FROM_EMAIL') ?? 'Hypiva <noreply@hypiva.com>';
  const esc = (s: string) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
  const oneLine = (s: string) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 80);
  const stars = '★'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Number(r.rating) || 0)));
  const service = r.service === 'slideshows' ? 'Slideshows' : 'UGC';
  const who = [r.name, r.role, r.company].filter(Boolean).map(esc).join(' · ');
  const photo = r.photo_url && /^https:\/\//.test(r.photo_url)
    ? `<p><img src="${esc(r.photo_url)}" alt="" width="80" height="80" style="border-radius:50%"></p>` : '';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to,
      subject: `Nieuwe review op Hypiva: ${oneLine(r.company || r.name)} (${stars})`,
      html: `${photo}<p><b>${who}</b> heeft een review achtergelaten voor <b>${service}</b>.</p>`
        + `<p style="font-size:20px;color:#FF6A3D;margin:0">${stars}</p>`
        + `<blockquote style="margin:12px 0;padding:12px 16px;border-left:3px solid #FF6A3D;background:#f6f6f6">${esc(r.body).replace(/\n/g, '<br>')}</blockquote>`
        + `<p>De review staat nog <b>niet</b> op de site. Open de Hypiva-app → People → Reviews en tik op <b>Show on site</b> om hem te tonen.</p>`,
    }),
  });
  return new Response(res.ok ? 'sent' : `email failed ${res.status}`, { status: 200 });
});
