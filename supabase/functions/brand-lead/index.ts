// Saves a campaign request from the homepage form. Public on purpose (visitors have no login);
// it only inserts into brand_leads, checks the input and ignores bots (hidden "website" field).
// With RESEND_API_KEY set it also emails the brand a thank-you and tells the owner about the request.
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
  const RANGES = ['', 'under_500', '500_2000', '2000_5000', '5000_plus', 'not_sure'];
  const budget = RANGES.includes(s('budget', 20)) ? s('budget', 20) : '';
  const currency = s('currency', 3) === 'EUR' ? 'EUR' : 'USD';
  const lead = { name: s('name', 100), email: s('email', 200), company: s('company', 120), budget, currency, message: s('message', 2000) };
  if (!lead.name) return json({ error: 'Please add your name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return json({ error: 'Please add a valid email address.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Simple flood guard: max 5 requests per email per day.
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await admin.from('brand_leads').select('id', { count: 'exact', head: true }).eq('email', lead.email).gte('created_at', since);
  if ((count ?? 0) >= 5) return json({ ok: true });
  const { error } = await admin.from('brand_leads').insert(lead);
  if (error) return json({ error: 'Something went wrong. Please email patrick@hypiva.com.' }, 500);
  await sendEmails(lead, (count ?? 0) === 0).catch(() => {}); // the request is saved either way
  return json({ ok: true });
});

const SITE = 'https://www.hypiva.com';
const CONTACT = 'patrick@hypiva.com';
const BUDGETS: Record<string, string> = {
  under_500: 'Under {c}500', '500_2000': '{c}500–{c}2,000', '2000_5000': '{c}2,000–{c}5,000', '5000_plus': '{c}5,000+', not_sure: 'Not sure yet',
};
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Hypiva email layout: logo on top, white card, signature with the logo at the bottom. */
const layout = (body: string) => `<!doctype html><html><body style="margin:0;padding:0;background:#F4F2EF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;padding:32px 12px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#16181F;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 8px 20px;"><a href="${SITE}"><img src="${SITE}/landing/email-logo.png" width="150" alt="Hypiva" style="display:block;border:0;width:150px;height:auto;"></a></td></tr>
<tr><td style="background:#FFFFFF;border-radius:16px;padding:32px 28px;font-size:16px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:20px 8px;font-size:12px;line-height:1.5;color:#8A8C96;">Hypiva · Creator campaigns on TikTok · <a href="${SITE}" style="color:#8A8C96;">hypiva.com</a></td></tr>
</table></td></tr></table></body></html>`;

const signature = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #EEE;padding-top:20px;width:100%;">
<tr><td style="vertical-align:middle;width:52px;padding-top:20px;"><img src="${SITE}/landing/icon.png" width="40" height="40" alt="" style="display:block;border-radius:10px;"></td>
<td style="vertical-align:middle;padding-top:20px;font-size:14px;line-height:1.45;"><b>The Hypiva team</b><br><span style="color:#8A8C96;"><a href="mailto:${CONTACT}" style="color:#FF6A3D;text-decoration:none;">${CONTACT}</a></span></td></tr></table>`;

async function send(key: string, mail: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail),
  });
  if (!res.ok) console.error('email failed', res.status, await res.text());
}

// thankYou is only true for the first request from an address that day, so the form can't be used to flood someone's inbox.
async function sendEmails(lead: { name: string; email: string; company: string; budget: string; currency: string; message: string }, thankYou: boolean) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  const from = Deno.env.get('FROM_EMAIL') ?? 'Hypiva <hello@hypiva.com>';
  const owner = Deno.env.get('OWNER_EMAIL') ?? CONTACT;
  const firstName = lead.name.split(' ')[0].slice(0, 40);
  const budget = lead.budget ? BUDGETS[lead.budget].split('{c}').join(lead.currency === 'EUR' ? '€' : '$') : '';

  // 1) Thank-you to the brand. Replies go straight to the owner.
  if (thankYou) await send(key, {
    from, to: lead.email, reply_to: owner,
    subject: 'Thanks for reaching out to Hypiva',
    html: layout(`<p style="margin:0 0 16px;font-size:20px;font-weight:700;">Thank you, ${esc(firstName)}!</p>
<p style="margin:0 0 16px;">We've received your campaign request. Thanks for thinking of Hypiva.</p>
<p style="margin:0 0 16px;">We'll get back to you as soon as possible, usually within one business day, with a proposal that fits your goals and budget.</p>
<p style="margin:0 0 16px;">Anything you'd like to add in the meantime? Just reply to this email.</p>
<p style="margin:0;">Kind regards,</p>${signature}`),
    text: `Thank you, ${firstName}!\n\nWe've received your campaign request. Thanks for thinking of Hypiva.\n\nWe'll get back to you as soon as possible, usually within one business day, with a proposal that fits your goals and budget.\n\nAnything you'd like to add in the meantime? Just reply to this email.\n\nKind regards,\nThe Hypiva team\n${CONTACT}\n${SITE}`,
  });

  // 2) Heads-up to the owner. Reply goes to the brand.
  const row = (k: string, v: string) => v ? `<tr><td style="padding:4px 16px 4px 0;color:#8A8C96;vertical-align:top;">${k}</td><td style="padding:4px 0;">${v}</td></tr>` : '';
  await send(key, {
    from, to: owner, reply_to: lead.email,
    subject: `New campaign request: ${lead.company || lead.name}`,
    html: layout(`<p style="margin:0 0 16px;font-size:20px;font-weight:700;">New campaign request</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;">
${row('Name', esc(lead.name))}${row('Email', `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>`)}${row('Company', esc(lead.company))}${row('Budget', esc(budget))}
</table>
${lead.message ? `<p style="margin:16px 0 0;white-space:pre-wrap;background:#F7F6F4;border-radius:10px;padding:14px;">${esc(lead.message)}</p>` : ''}
<p style="margin:20px 0 0;">Reply to this email to answer them, or open <a href="${SITE}/people" style="color:#FF6A3D;">People</a> in Hypiva.</p>`),
  });
}
