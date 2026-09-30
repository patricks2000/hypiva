// Emails the owner when someone signs up. Called by the database (with the shared secret).
// Needs RESEND_API_KEY; without it, it does nothing (sign-ups still show under People).
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: ok } = await admin.rpc('check_refresh_secret', { p_secret: req.headers.get('x-refresh-secret') ?? '' });
  if (ok !== true) return new Response('Not allowed', { status: 401 });
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return new Response('No email key set', { status: 200 });

  const { id } = await req.json().catch(() => ({ id: null }));
  const { data: p } = await admin.from('profiles').select('name, content_language, created_at').eq('id', String(id)).maybeSingle();
  const { data: u } = await admin.auth.admin.getUserById(String(id));
  const to = Deno.env.get('OWNER_EMAIL') ?? 'patrick@hypiva.com';
  const from = Deno.env.get('FROM_EMAIL') ?? 'Hypiva <noreply@hypiva.com>';
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
  const name = esc(p?.name || 'Someone');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to,
      subject: `New sign-up on Hypiva: ${p?.name || 'new creator'}`,
      html: `<p><b>${name}</b> just signed up${u?.user?.email ? ` (${esc(u.user.email)})` : ''}${p?.content_language ? `, posts in <b>${esc(p.content_language.toUpperCase())}</b>` : ''}.</p><p>Open <a href="https://hypiva.com">Hypiva</a> → People to see them.</p>`,
    }),
  });
  return new Response(res.ok ? 'sent' : `email failed ${res.status}`, { status: 200 });
});
