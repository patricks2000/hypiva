import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { Avatar, Button, Card, Chips, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Sheet, T, hueFor, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { day, parseDollars, usd } from '../../lib/format';
import type { Brand, BrandLead, Profile, Referral, ReferralSettings, Role } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

const ROLE_LABEL: Record<Role, string> = { creator: 'Creator', brand: 'Brand', admin: 'Admin' };
const WEEK = 7 * 864e5;
/** "€2,000–€5,000" from the range saved by the homepage form. */
const budgetLabel = (range: string, currency: string) => {
  const c = currency === 'EUR' ? '€' : '$';
  const map: Record<string, string> = { under_500: `Under ${c}500`, '500_2000': `${c}500–${c}2,000`, '2000_5000': `${c}2,000–${c}5,000`, '5000_plus': `${c}5,000+`, not_sure: 'Budget not sure yet' };
  return map[range] ?? range;
};
/** Opens the mail app with a reply to a campaign request already started. */
const mailLead = (x: BrandLead) => {
  const first = x.name.split(' ')[0];
  const subject = 'Your campaign with Hypiva';
  const body = `Hi ${first},\n\nThanks for your request${x.company ? ` for ${x.company}` : ''}. \n\nKind regards,\nPatrick\nHypiva`;
  Linking.openURL(`mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {});
};
/** Signed up in the last 7 days. */
const isNew = (p: Profile) => new Date(p.created_at).getTime() > Date.now() - WEEK;

export default function People() {
  const { profile: me } = useAuth();
  const { toast, show } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Role>('all');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [rules, setRules] = useState(false);
  const [rateEdit, setRateEdit] = useState(false);
  const q = useLoad(async () => {
    const [p, b, r, st, app, l] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
      supabase.from('referrals').select('*'),
      supabase.from('referral_settings').select('*').single(),
      supabase.from('app_settings').select('eur_per_usd').single(),
      supabase.from('brand_leads').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    return { people: must(p) as Profile[], brands: must(b) as Brand[], referrals: must(r) as Referral[], settings: must(st) as ReferralSettings,
      rate: Number((must(app) as { eur_per_usd: number | null }).eur_per_usd) || null, leads: must(l) as BrandLead[] };
  });
  const invitedBy = (id: string) => {
    const r = q.data?.referrals.find((x) => x.referred_id === id);
    const who = r && q.data?.people.find((x) => x.id === r.referrer_id);
    return who ? ` · invited by ${who.name.split(' ')[0] || 'a creator'}` : '';
  };
  const needle = search.trim().toLowerCase().replace(/^@/, '');
  const list = (q.data?.people ?? []).filter((p) => (filter === 'all' || p.role === filter) &&
    (!needle || `${p.name} ${p.handle ?? ''}`.toLowerCase().includes(needle)));

  return (
    <View style={{ flex: 1 }}>
      <Screen title="People" onRefresh={q.refresh} refreshing={q.refreshing}>
        <Card style={{ gap: 4, backgroundColor: colors.surface2 }}>
          <T variant="bodyStrong">{me?.is_owner ? 'You are the owner' : 'Only the owner can change roles'}</T>
          <T variant="muted">{me?.is_owner
            ? 'Everyone starts as a creator. Tap a person to make them a brand user or give them admin access. Only you can do this.'
            : 'You can see everyone, but giving or taking away access is done by the owner.'}</T>
        </Card>
        {q.data && q.data.leads.length ? (
          <Card style={{ gap: 10, borderColor: q.data.leads.some((x) => !x.handled) ? colors.accent : colors.line }}>
            <T variant="h2">Campaign requests</T>
            <T variant="muted">From the form on hypiva.com. Tap Email to reply, Done when you have replied, Delete to remove it.</T>
            {q.data.leads.slice(0, 10).map((x) => (
              <View key={x.id} style={{ gap: 2, opacity: x.handled ? 0.5 : 1, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
                <T variant="bodyStrong" selectable>{x.name}{x.company ? ` · ${x.company}` : ''}{x.budget ? ` · ${budgetLabel(x.budget, x.currency)}` : ''}</T>
                <T variant="body" selectable>{x.email}</T>
                {x.message ? <T variant="muted" selectable>{x.message}</T> : null}
                <T variant="small">{day(x.created_at)}{x.handled ? ' · Replied' : ''}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <Button small title="Email" onPress={() => mailLead(x)} />
                  {!x.handled ? <Button small kind="ghost" title="Done" onPress={async () => {
                    const { error } = await supabase.from('brand_leads').update({ handled: true }).eq('id', x.id);
                    if (error) return show(friendlyError(error));
                    q.reload();
                  }} /> : null}
                  <Button small kind="danger" title={deleting === x.id ? 'Tap again to delete' : 'Delete'} onPress={async () => {
                    if (deleting !== x.id) return setDeleting(x.id);
                    setDeleting(null);
                    const { error } = await supabase.from('brand_leads').delete().eq('id', x.id);
                    if (error) return show(friendlyError(error));
                    show('Request deleted');
                    q.reload();
                  }} />
                </View>
              </View>
            ))}
          </Card>
        ) : null}
        {q.data ? (() => {
          const fresh = q.data.people.filter(isNew);
          return (
            <Card style={{ gap: 4, borderColor: fresh.length ? colors.accent : colors.line }}>
              <T variant="bodyStrong">{fresh.length ? `${fresh.length} new ${fresh.length === 1 ? 'sign-up' : 'sign-ups'} this week` : 'No new sign-ups this week'}</T>
              <T variant="muted">{fresh.length ? fresh.slice(0, 5).map((p) => `${p.name || 'No name'}${p.content_language ? ` (${p.content_language.toUpperCase()})` : ''}`).join(', ') : 'New people show up at the top of the list with a "New" label.'}</T>
            </Card>
          );
        })() : null}
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name or @username" autoCapitalize="none" />
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'Everyone' }, { value: 'creator', label: 'Creators' }, { value: 'brand', label: 'Brands' }, { value: 'admin', label: 'Admins' },
        ]} />
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : (
          <List>
            {list.length ? list.map((p, i) => (
              <Row key={p.id} last={i === list.length - 1} left={<Avatar name={p.name || '?'} color={hueFor(p.id)} />}
                title={p.name || 'No name'}
                subtitle={`${p.handle ? '@' + p.handle + ' · ' : ''}joined ${day(p.created_at)}${p.role === 'brand' ? ' · ' + (q.data!.brands.find((b) => b.id === p.brand_id)?.name ?? 'no brand') : ''}${invitedBy(p.id)}`}
                onPress={me?.is_owner && p.id !== me.id ? () => setEditing(p) : undefined}
                right={<View style={{ flexDirection: 'row', gap: 6 }}>
                  {isNew(p) ? <Pill kind="requested" label="New" /> : null}
                  {p.is_owner ? <Pill kind="live" label="Owner" /> : <Pill kind={p.role === 'admin' ? 'live' : p.role === 'brand' ? 'requested' : 'linked'} label={ROLE_LABEL[p.role]} />}
                </View>} />
            )) : <Empty text="Nobody matches." />}
          </List>
        )}
        {q.data ? (
          <Card style={{ gap: 8, marginTop: 16 }}>
            <T variant="h2">Invite program</T>
            <T variant="muted">{`Inviters get ${q.data.settings.percent_bp / 100}% of what the people they invite earn, for ${q.data.settings.months} months, up to ${usd(q.data.settings.cap_cents)} per person. New creators can add a code in their first ${q.data.settings.signup_window_days} days.`}</T>
            <T variant="small">{q.data.referrals.length} {q.data.referrals.length === 1 ? 'creator' : 'creators'} joined with a code.</T>
            {me?.is_owner ? <Button small kind="ghost" title="Change rules" onPress={() => setRules(true)} /> : null}
          </Card>
        ) : null}
        {q.data ? (
          <Card style={{ gap: 8 }}>
            <T variant="h2">Dollars and euros</T>
            <T variant="muted">{q.data.rate
              ? `Amounts stay in dollars. When you pay, the app also shows euros at $1 = €${q.data.rate}.`
              : 'Amounts are in dollars. Set a rate to also see what to transfer in euros.'}</T>
            {me?.is_owner ? <Button small kind="ghost" title={q.data.rate ? 'Change rate' : 'Set euro rate'} onPress={() => setRateEdit(true)} /> : null}
          </Card>
        ) : null}
        <AccountSection onToast={show} />
      </Screen>
      {rateEdit && q.data ? <RateSheet current={q.data.rate} onClose={() => setRateEdit(false)} onSaved={() => { setRateEdit(false); show('Euro rate saved'); q.reload(); }} /> : null}
      {rules && q.data ? <RulesSheet s={q.data.settings} onClose={() => setRules(false)} onSaved={() => { setRules(false); show('Invite rules saved'); q.reload(); }} /> : null}
      {editing && q.data ? (
        <RoleSheet person={editing} brands={q.data.brands} onClose={() => setEditing(null)}
          onSaved={(m) => { show(m); setEditing(null); q.reload(); }} />
      ) : null}
      {toast}
    </View>
  );
}

function RoleSheet({ person, brands, onClose, onSaved }: { person: Profile; brands: Brand[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [role, setRole] = useState<Role>(person.role);
  const [brand, setBrand] = useState(person.brand_id ?? brands[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('set_user_role', { p_user: person.id, p_role: role, p_brand: role === 'brand' ? brand : null });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    onSaved(`${person.name || 'User'} is now ${ROLE_LABEL[role].toLowerCase()}`);
  };
  return (
    <Sheet visible onClose={onClose} title={person.name || 'User'}>
      <T variant="muted">Choose what this person can see and do.</T>
      <Chips value={role} onChange={setRole} options={[
        { value: 'creator', label: 'Creator' }, { value: 'brand', label: 'Brand' }, { value: 'admin', label: 'Admin' },
      ]} />
      <Card style={{ backgroundColor: colors.surface2 }}>
        <T variant="muted">
          {role === 'creator' ? 'Sees only their own videos, views and money.'
            : role === 'brand' ? 'Sees and reviews videos for their brand\'s campaigns. Cannot see money owed to creators.'
            : 'Sees everything: all creators, money, videos and campaigns. Only give this to people you trust.'}
        </T>
      </Card>
      {role === 'brand' ? (
        brands.length ? <Chips value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
          : <T variant="muted" style={{ color: colors.warn }}>Add a brand under Campaigns first.</T>
      ) : null}
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title="Save" onPress={save} busy={busy} disabled={role === person.role && (role !== 'brand' || brand === person.brand_id) || (role === 'brand' && !brand)} />
    </Sheet>
  );
}

function RulesSheet({ s, onClose, onSaved }: { s: ReferralSettings; onClose: () => void; onSaved: () => void }) {
  const [pct, setPct] = useState(String(s.percent_bp / 100));
  const [months, setMonths] = useState(String(s.months));
  const [cap, setCap] = useState((s.cap_cents / 100).toFixed(2));
  const [days, setDays] = useState(String(s.signup_window_days));
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const p = Number(pct.replace(',', '.')), m = parseInt(months, 10), d = parseInt(days, 10), c = parseDollars(cap);
    if (!(p >= 0 && p <= 50) || !(m >= 1 && m <= 36) || c === null || !(d >= 0 && d <= 365)) return setError('Check the numbers: 0-50%, 1-36 months, 0-365 days.');
    const { error: e } = await supabase.from('referral_settings').update({ percent_bp: Math.round(p * 100), months: m, cap_cents: c, signup_window_days: d }).eq('id', true);
    if (e) return setError(friendlyError(e));
    onSaved();
  };
  return (
    <Sheet visible onClose={onClose} title="Invite rules">
      <T variant="muted">Changes apply to all invites, also ones that already exist.</T>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field label="Share (%)" value={pct} onChangeText={setPct} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="For (months)" value={months} onChangeText={setMonths} keyboardType="number-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field label="Max per creator ($)" value={cap} onChangeText={setCap} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Code allowed for (days)" value={days} onChangeText={setDays} keyboardType="number-pad" /></View>
      </View>
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <T variant="small">Example: someone you invited earns $200 → the inviter gets {usd(Math.min(Math.round(20000 * (Number(pct.replace(',', '.')) || 0) / 100), parseDollars(cap) ?? 0))}.</T>
      <Button title="Save rules" onPress={save} />
    </Sheet>
  );
}

function RateSheet({ current, onClose, onSaved }: { current: number | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(current ? String(current) : '');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const n = value.trim() ? Number(value.replace(',', '.')) : null;
    if (n !== null && !(n > 0 && n < 10)) return setError('Enter how many euros one dollar is, for example 0.86.');
    const { error: e } = await supabase.from('app_settings').update({ eur_per_usd: n }).eq('id', true);
    if (e) return setError(friendlyError(e));
    onSaved();
  };
  return (
    <Sheet visible onClose={onClose} title="Euro rate">
      <T variant="muted">{'How many euros is $1? Look it up in your bank app or search "1 USD to EUR", and update it now and then. Leave empty to hide euro amounts.'}</T>
      <Field label="€ per $1" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0.86" error={error} />
      <T variant="small">{value && Number(value.replace(',', '.')) > 0 ? `Example: $90.00 owed = €${(90 * Number(value.replace(',', '.'))).toFixed(2)} to transfer.` : ' '}</T>
      <Button title="Save" onPress={save} />
    </Sheet>
  );
}
