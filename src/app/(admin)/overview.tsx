import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { VideoRow } from '../../components/parts';
import { Avatar, Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, hueFor, useToast } from '../../components/ui';
import { day, num, parseDollars, short, usd } from '../../lib/format';
import { SUB_FIELDS, weekLabel, withRates } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Campaign, CreatorBalance, CreatorRate, Payout, Profile, ReferralBonus, Submission, WeekRow } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

type Sort = 'owed' | 'views' | 'name';

export default function Money() {
  const { toast, show } = useToast();
  const [sort, setSort] = useState<Sort>('owed');
  const [paying, setPaying] = useState<CreatorBalance | null>(null);
  const [inviter, setInviter] = useState<CreatorBalance | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const q = useLoad(async () => {
    const [b, p, pend, rb, wk] = await Promise.all([
      supabase.from('creator_balances').select('*'),
      supabase.from('payouts').select('*').eq('status', 'requested').order('requested_at'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('referral_bonuses').select('*').order('created_at', { ascending: false }),
      supabase.rpc('weekly_earnings', { p_weeks: 12 }),
    ]);
    if (pend.error) throw pend.error;
    return { balances: must(b) as CreatorBalance[], requests: must(p) as Payout[], pending: pend.count ?? 0, bonuses: must(rb) as ReferralBonus[], weeks: must(wk) as WeekRow[] };
  });
  const d = q.data;
  const rows = (d?.balances ?? []).filter((b) => b.videos || b.paid_cents || b.requested_cents).sort((a, b) =>
    sort === 'owed' ? b.owed_cents - a.owed_cents : sort === 'views' ? b.views - a.views : a.name.localeCompare(b.name));
  const total = (k: keyof CreatorBalance) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const asked = new Set(d?.requests.map((r) => r.creator_id));

  const copySheet = async () => {
    const lines = [['Name', 'Username', 'Videos', 'Videos over minimum', 'Views', 'From videos', 'From invites', 'Earned', 'Paid', 'Owed'].join('\t')].concat(
      rows.map((r) => [r.name, r.handle ? '@' + r.handle : '', r.videos, r.paid_videos, r.views,
        (r.video_earned_cents / 100).toFixed(2), (r.referral_earned_cents / 100).toFixed(2), (r.earned_cents / 100).toFixed(2), (r.paid_cents / 100).toFixed(2), (r.owed_cents / 100).toFixed(2)].join('\t')));
    await Clipboard.setStringAsync(lines.join('\n'));
    show('Copied. Paste it into Excel or Google Sheets.');
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Money" onRefresh={q.refresh} refreshing={q.refreshing}>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <Tiles>
              <Tile highlight label="You owe" value={usd(total('owed_cents'))} color={colors.money} sub={`${d.requests.length} asked to be paid`} />
              <Tile label="Paid out" value={usd(total('paid_cents'))} sub="all time" />
            </Tiles>
            <Tiles>
              <Tile label="Views" value={short(total('views'))} sub={`${total('videos')} videos`} />
              <Tile label="Creators" value={String(rows.length)} sub={`${d.pending} videos to review`} />
            </Tiles>

            {d.requests.length ? (
              <Section title="Asked to be paid">
                <List>
                  {d.requests.map((r, i) => {
                    const b = d.balances.find((x) => x.creator_id === r.creator_id);
                    return (
                      <Row key={r.id} last={i === d.requests.length - 1} left={<Avatar name={b?.name || '?'} color={hueFor(r.creator_id)} />}
                        title={b?.name || 'Creator'} subtitle={`Asked ${day(r.requested_at)}`}
                        right={<><T variant="bodyStrong" style={{ color: colors.money }}>{usd(b?.owed_cents ?? r.amount_cents)}</T>
                          {b ? <Button small kind="money" title="Pay" onPress={() => setPaying(b)} /> : null}</>} />
                    );
                  })}
                </List>
              </Section>
            ) : null}

            <Section title="Per creator" hint="Owed = earnings from approved videos that reached the minimum, plus invite bonus, minus what you already paid."
              right={<LinkButton title="Copy as spreadsheet" onPress={copySheet} />}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['owed', 'views', 'name'] as Sort[]).map((k) => (
                  <Button key={k} small kind={sort === k ? 'primary' : 'ghost'} title={k === 'owed' ? 'Most owed' : k === 'views' ? 'Most views' : 'A-Z'} onPress={() => setSort(k)} />
                ))}
              </View>
              <List>
                {rows.length ? rows.map((r, i) => (
                  <Row key={r.creator_id} last={i === rows.length - 1} onPress={() => setPaying(r)} lines={3}
                    left={<Avatar name={r.name || '?'} color={hueFor(r.creator_id)} />}
                    title={r.name || 'No name'}
                    subtitle={`${r.paid_videos} of ${r.videos} videos over the minimum · ${short(r.views)} views${r.referral_earned_cents ? ` · ${usd(r.referral_earned_cents)} from invites` : ''}`}
                    right={<>
                      <T variant="bodyStrong" style={{ color: r.owed_cents > 0 ? colors.money : colors.muted }}>{usd(r.owed_cents)}</T>
                      {asked.has(r.creator_id) ? <Pill kind="requested" label="Asked" /> : r.owed_cents > 0 ? <T variant="small">owed</T> : <T variant="small">settled</T>}
                    </>} />
                )) : <Empty text="No creators have posted yet." />}
              </List>
            </Section>

            <Section title="Per week" hint="What creators earned each week (Monday to Sunday) as their views grew. Use it to pay weekly.">
              <List>
                {(() => {
                  const weeks = [...new Set(d.weeks.map((w) => w.week_start))];
                  return weeks.length ? weeks.map((w, i) => {
                    const rowsW = d.weeks.filter((x) => x.week_start === w);
                    const cents = rowsW.reduce((a, x) => a + x.video_cents, 0);
                    return <Row key={w} last={i === weeks.length - 1} onPress={() => setWeek(w)} title={weekLabel(w)}
                      subtitle={`${rowsW.length} ${rowsW.length === 1 ? 'creator' : 'creators'} earned`}
                      right={<T variant="bodyStrong" style={{ color: colors.money }}>{usd(cents)}</T>} />;
                  }) : <Empty text="Weekly totals show up once videos pass the minimum." />;
                })()}
              </List>
              <T variant="small">Invite bonuses are not split per week; they are in the totals above.</T>
            </Section>

            <Section title="Invites" hint="Bonus creators earn for bringing in other creators. It is already included in what you owe above.">
              <List>
                {(() => {
                  const inv = d.balances.filter((x) => x.invites > 0).sort((x, y) => y.referral_earned_cents - x.referral_earned_cents);
                  return inv.length ? inv.map((r, i) => (
                    <Row key={r.creator_id} last={i === inv.length - 1} onPress={() => setInviter(r)}
                      left={<Avatar name={r.name || '?'} color={hueFor(r.creator_id)} />}
                      title={r.name || 'Creator'} subtitle={`Invited ${r.invites} ${r.invites === 1 ? 'creator' : 'creators'}`}
                      right={<T variant="bodyStrong" style={{ color: colors.money }}>{usd(r.referral_earned_cents)}</T>} />
                  )) : <Empty text="Nobody has used an invite code yet." />;
                })()}
              </List>
            </Section>
          </>
        )}
      </Screen>
      {inviter && d ? (
        <Sheet visible onClose={() => setInviter(null)} title={`${inviter.name || 'Creator'}'s invites`}>
          <T variant="muted">{inviter.invites} invited · {usd(inviter.referral_earned_cents)} bonus in total</T>
          <List>
            {d.bonuses.filter((x) => x.referrer_id === inviter.creator_id).map((x, i, arr) => {
              const who = d.balances.find((b) => b.creator_id === x.referred_id);
              return (
                <Row key={x.referred_id} last={i === arr.length - 1} left={<Avatar name={who?.name || '?'} color={hueFor(x.referred_id)} />}
                  title={who?.name || 'Creator'}
                  subtitle={`Joined ${day(x.created_at)} · they earned ${usd(x.invited_earned_cents)} in the bonus period${x.capped ? ' · maximum reached' : ''}`}
                  right={<T variant="bodyStrong" style={{ color: colors.money }}>{usd(x.bonus_cents)}</T>} />
              );
            })}
          </List>
        </Sheet>
      ) : null}
      {week && d ? (
        <Sheet visible onClose={() => setWeek(null)} title={`Week ${weekLabel(week)}`}>
          {(() => {
            const rowsW = d.weeks.filter((x) => x.week_start === week);
            const total = rowsW.reduce((a, x) => a + x.video_cents, 0);
            const copyWeek = async () => {
              await Clipboard.setStringAsync([['Name', 'Videos that earned', 'Earned'].join('\t'), ...rowsW.map((r) => [r.name, r.videos_counted, (r.video_cents / 100).toFixed(2)].join('\t'))].join('\n'));
              show('Week copied');
            };
            return (
              <>
                <Card style={{ gap: 4 }}><T variant="label">Earned this week</T><T variant="title" style={{ color: colors.money }}>{usd(total)}</T></Card>
                <LinkButton title="Copy as spreadsheet" onPress={copyWeek} />
                <List>
                  {rowsW.map((r, i) => (
                    <Row key={r.creator_id} last={i === rowsW.length - 1} left={<Avatar name={r.name || '?'} color={hueFor(r.creator_id)} />}
                      title={r.name || 'Creator'} subtitle={`${r.videos_counted} ${r.videos_counted === 1 ? 'video' : 'videos'} earned`}
                      right={<T variant="bodyStrong" style={{ color: r.video_cents >= 0 ? colors.money : colors.bad }}>{usd(r.video_cents)}</T>} />
                  ))}
                </List>
              </>
            );
          })()}
        </Sheet>
      ) : null}
      {paying ? <PaySheet b={paying} onClose={() => setPaying(null)} onPaid={(m) => { show(m); setPaying(null); q.reload(); }} /> : null}
      {toast}
    </View>
  );
}

/** Everything about one creator's money, with the video-by-video maths. */
function PaySheet({ b, onClose, onPaid }: { b: CreatorBalance; onClose: () => void; onPaid: (msg: string) => void }) {
  const [rateOpen, setRateOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useLoad(async () => {
    const [p, s, r, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', b.creator_id).single(),
      supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', b.creator_id).order('created_at', { ascending: false }),
      supabase.from('creator_rates').select('*').eq('creator_id', b.creator_id),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    ]);
    const rates = must(r) as CreatorRate[];
    return { profile: must(p) as Profile, subs: withRates(must(s) as Submission[], rates), rates, campaigns: must(c) as Campaign[] };
  });
  const pay = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('mark_creator_paid', { p_creator: b.creator_id, p_note: note.trim() || null });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    onPaid(`${b.name || 'Creator'} marked as paid: ${usd(b.owed_cents)}`);
  };
  const details = q.data?.profile.payout_details;
  return (
    <Sheet visible onClose={onClose} title={b.name || 'Creator'}>
      <Card style={{ gap: 6 }}>
        <T variant="label">Owed now</T>
        <T variant="title" style={{ color: colors.money }}>{usd(b.owed_cents)}</T>
        <T variant="muted">{b.paid_videos} of {b.videos} videos reached the minimum · {num(b.views)} views</T>
        <T variant="muted">{usd(b.video_earned_cents)} from videos{b.referral_earned_cents ? ` + ${usd(b.referral_earned_cents)} from invites` : ''} − {usd(b.paid_cents)} already paid</T>
      </Card>
      <Card style={{ gap: 6 }}>
        <T variant="label">Send to</T>
        {q.data ? (details
          ? <><T variant="bodyStrong" selectable>{q.data.profile.payout_method === 'bank' ? 'Bank: ' : 'PayPal: '}{details}</T>
              <LinkButton title="Copy" onPress={() => Clipboard.setStringAsync(details)} /></>
          : <T variant="muted">This creator has not added payout details yet.</T>) : <Loading />}
      </Card>
      {b.paid_cents > b.earned_cents ? (
        <T variant="muted" style={{ color: colors.warn }}>You paid {usd(b.paid_cents - b.earned_cents)} more than this creator has earned (for example after lowering their rate). New earnings are counted against that first.</T>
      ) : null}
      {b.owed_cents > 0 ? (
        <>
          <T variant="muted">Send {usd(b.owed_cents)} first, then mark it as paid so the balance goes to $0.</T>
          <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="PayPal transaction ID" error={error} />
          <Button kind="money" title={`Mark ${usd(b.owed_cents)} as paid`} onPress={pay} busy={busy} />
        </>
      ) : <T variant="muted">Nothing owed right now.</T>}
      <Card style={{ gap: 8 }}>
        <T variant="label">Pay rate</T>
        {q.data ? (q.data.rates.length ? q.data.rates.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="body" style={{ flex: 1 }}>
              {usd(r.cpm_cents)} per 1K{r.min_views != null ? ` · min. ${short(r.min_views)}` : ''} · {r.campaign_id ? q.data!.campaigns.find((c) => c.id === r.campaign_id)?.name ?? 'campaign' : 'all campaigns'}
            </T>
            <LinkButton title="Remove" onPress={async () => {
              const { error: e } = await supabase.from('creator_rates').delete().eq('id', r.id);
              if (e) setError(friendlyError(e)); else { q.reload(); onPaid('Special rate removed'); }
            }} />
          </View>
        )) : <T variant="muted">Campaign rate (no special rate).</T>) : <Loading />}
        <Button small kind="ghost" title="Set a special rate" onPress={() => setRateOpen(true)} />
      </Card>
      {rateOpen && q.data ? <RateForm creatorId={b.creator_id} campaigns={q.data.campaigns} onDone={() => { setRateOpen(false); q.reload(); onPaid('Special rate saved. Amounts are updated.'); }} /> : null}
      <T variant="h2" style={{ marginTop: 8 }}>Videos</T>
      <List>
        {q.data ? (q.data.subs.length ? q.data.subs.map((s, i) => <VideoRow key={s.id} s={s} last={i === q.data!.subs.length - 1} />)
          : <Empty text="No videos." />) : <Loading />}
      </List>
    </Sheet>
  );
}

/** Give one creator a different pay rate, for every campaign or just one. */
function RateForm({ creatorId, campaigns, onDone }: { creatorId: string; campaigns: Campaign[]; onDone: () => void }) {
  const [scope, setScope] = useState<string>('all');
  const [cpm, setCpm] = useState('1.00');
  const [min, setMin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const cents = parseDollars(cpm);
    if (cents === null) return setError('Enter an amount per 1,000 views, for example 1.00.');
    const minViews = min.trim() ? Number(min.replace(/\D/g, '')) : null;
    const row = { creator_id: creatorId, campaign_id: scope === 'all' ? null : scope, cpm_cents: cents, min_views: minViews };
    const existing = await supabase.from('creator_rates').select('id').eq('creator_id', creatorId)
      .filter('campaign_id', scope === 'all' ? 'is' : 'eq', scope === 'all' ? null : scope).maybeSingle();
    const { error: e } = existing.data
      ? await supabase.from('creator_rates').update(row).eq('id', (existing.data as { id: string }).id)
      : await supabase.from('creator_rates').insert(row);
    if (e) return setError(friendlyError(e));
    onDone();
  };
  return (
    <Card style={{ gap: 12, borderColor: colors.accent }}>
      <T variant="bodyStrong">Special rate</T>
      <Chips value={scope} onChange={setScope} options={[{ value: 'all', label: 'All campaigns' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field label="$ per 1K views" value={cpm} onChangeText={setCpm} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Min. views (optional)" value={min} onChangeText={setMin} keyboardType="number-pad" placeholder="Campaign's" /></View>
      </View>
      <T variant="small">{`Counts for all their videos in ${scope === 'all' ? 'every campaign' : campaigns.find((c) => c.id === scope)?.name ?? 'this campaign'}, also videos already posted. Best to set it before they start posting.`}</T>
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title="Save rate" onPress={save} />
    </Card>
  );
}
