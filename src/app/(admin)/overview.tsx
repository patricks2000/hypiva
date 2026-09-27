import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { Leaderboard } from '../../components/Leaderboard';
import { VideoRow } from '../../components/parts';
import { Avatar, Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, hueFor, useToast } from '../../components/ui';
import { day, eur, num, parseDollars, short, usd } from '../../lib/format';
import { SUB_FIELDS, monthLabel, weekLabel, withRates } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Bonus, Campaign, CreatorBalance, CreatorRate, LeaderRow, LeaderboardSettings, Payout, Profile, ReferralBonus, Submission, WeekRow } from '../../lib/types';
import { useAuth } from '../../lib/auth';
import { must, useLoad } from '../../lib/useLoad';

type Sort = 'owed' | 'views' | 'name';

export default function Money() {
  const { toast, show } = useToast();
  const [sort, setSort] = useState<Sort>('owed');
  const [paying, setPaying] = useState<CreatorBalance | null>(null);
  const [inviter, setInviter] = useState<CreatorBalance | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [boardMonth, setBoardMonth] = useState<'now' | 'last'>('now');
  const [boardEdit, setBoardEdit] = useState(false);
  const { profile: me } = useAuth();
  const q = useLoad(async () => {
    const lastMonth = new Date(); lastMonth.setDate(1); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const [b, p, pend, rb, wk, lbNow, lbLast, lbs, app] = await Promise.all([
      supabase.from('creator_balances').select('*'),
      supabase.from('payouts').select('*').eq('status', 'requested').order('requested_at'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('referral_bonuses').select('*').order('created_at', { ascending: false }),
      supabase.rpc('weekly_earnings', { p_weeks: 12 }),
      supabase.rpc('leaderboard', { p_limit: 10 }),
      supabase.rpc('leaderboard', { p_month: lastMonth.toISOString().slice(0, 10), p_limit: 10 }),
      supabase.from('leaderboard_settings').select('*').single(),
      supabase.from('app_settings').select('eur_per_usd').single(),
    ]);
    if (pend.error) throw pend.error;
    return { balances: must(b) as CreatorBalance[], requests: must(p) as Payout[], pending: pend.count ?? 0, bonuses: must(rb) as ReferralBonus[], weeks: must(wk) as WeekRow[],
      board: { now: must(lbNow) as LeaderRow[], last: must(lbLast) as LeaderRow[], lastMonth }, boardSettings: must(lbs) as LeaderboardSettings,
      rate: Number((must(app) as { eur_per_usd: number | null }).eur_per_usd) || null };
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
              <Tile highlight label="You owe" value={usd(total('owed_cents'))} color={colors.money} sub={`${d.rate ? '≈ ' + eur(total('owed_cents'), d.rate) + ' · ' : ''}${d.requests.length} asked to be paid`} />
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

            <Section title="Top creators" hint="Views gained on approved videos in the month. Tap someone to give them a bonus."
              right={<T variant="small">{d.boardSettings.visible ? 'Creators see this' : 'Only you see this'}</T>}>
              <Chips value={boardMonth} onChange={setBoardMonth} options={[
                { value: 'now', label: monthLabel(new Date()) }, { value: 'last', label: monthLabel(d.board.lastMonth) },
              ]} />
              <Leaderboard rows={boardMonth === 'now' ? d.board.now : d.board.last}
                onPress={(r) => { const b = d.balances.find((x) => x.creator_id === r.creator_id); if (b) setPaying(b); }} />
              {me?.is_owner ? <Button small kind="ghost" title={d.boardSettings.visible ? 'Leaderboard settings (on for creators)' : 'Show leaderboard to creators'} onPress={() => setBoardEdit(true)} /> : null}
            </Section>

            <Section title="Per creator" hint="Owed = earnings from approved videos that reached the minimum, plus invite and manual bonuses, minus what you already paid."
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
      {boardEdit && d ? <BoardSettingsSheet s={d.boardSettings} onClose={() => setBoardEdit(false)} onSaved={(m) => { setBoardEdit(false); show(m); q.reload(); }} /> : null}
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
                <Card style={{ gap: 4 }}><T variant="label">Earned this week</T><T variant="title" style={{ color: colors.money }}>{usd(total)}</T>{d.rate ? <T variant="muted">≈ {eur(total, d.rate)} to transfer</T> : null}</Card>
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
      {paying ? <PaySheet rate={d?.rate ?? null} b={paying} onClose={() => setPaying(null)} onPaid={(m) => { show(m); setPaying(null); q.reload(); }} /> : null}
      {toast}
    </View>
  );
}

/** Everything about one creator's money, with the video-by-video maths. */
function PaySheet({ b, rate, onClose, onPaid }: { b: CreatorBalance; rate: number | null; onClose: () => void; onPaid: (msg: string) => void }) {
  const [rateOpen, setRateOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useLoad(async () => {
    const [p, s, r, c, bo] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', b.creator_id).single(),
      supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', b.creator_id).order('created_at', { ascending: false }),
      supabase.from('creator_rates').select('*').eq('creator_id', b.creator_id),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('bonuses').select('*').eq('creator_id', b.creator_id).order('created_at', { ascending: false }),
    ]);
    const rates = must(r) as CreatorRate[];
    return { profile: must(p) as Profile, subs: withRates(must(s) as Submission[], rates), rates, campaigns: must(c) as Campaign[], bonuses: must(bo) as Bonus[] };
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
        <T variant="muted">{usd(b.video_earned_cents)} from videos{b.referral_earned_cents ? ` + ${usd(b.referral_earned_cents)} from invites` : ''}{b.bonus_cents ? ` + ${usd(b.bonus_cents)} bonus` : ''} − {usd(b.paid_cents)} already paid</T>
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
          {rate ? (
            <Card style={{ gap: 2, backgroundColor: colors.surface2 }}>
              <T variant="label">Transfer from your bank</T>
              <T variant="h2" selectable>{eur(b.owed_cents, rate)}</T>
              <T variant="small">{`${usd(b.owed_cents)} at $1 = €${rate}. Your bank may use a slightly different rate.`}</T>
            </Card>
          ) : null}
          <T variant="muted">Send {rate ? eur(b.owed_cents, rate) : usd(b.owed_cents)} first, then mark it as paid so the balance goes to $0.</T>
          <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="PayPal transaction ID" error={error} />
          <Button kind="money" title={`Mark ${usd(b.owed_cents)} as paid`} onPress={pay} busy={busy} />
        </>
      ) : <T variant="muted">Nothing owed right now.</T>}
      <Card style={{ gap: 8 }}>
        <T variant="label">Bonuses</T>
        {q.data ? (q.data.bonuses.length ? q.data.bonuses.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="body" style={{ flex: 1 }}>{x.reason} · {day(x.created_at)}</T>
            <T variant="bodyStrong" style={{ color: x.amount_cents > 0 ? colors.money : colors.bad }}>{usd(x.amount_cents)}</T>
            <LinkButton title="Remove" onPress={async () => {
              const { error: e } = await supabase.from('bonuses').delete().eq('id', x.id);
              if (e) setError(friendlyError(e)); else { q.reload(); onPaid('Bonus removed'); }
            }} />
          </View>
        )) : <T variant="muted">No bonuses yet.</T>) : <Loading />}
        <Button small kind="ghost" title="Give a bonus" onPress={() => setBonusOpen(true)} />
      </Card>
      {bonusOpen ? <BonusForm creatorId={b.creator_id} name={b.name} onDone={(m) => { setBonusOpen(false); q.reload(); onPaid(m); }} /> : null}
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

/** Add money on top, with a reason the creator sees. A minus amount corrects a mistake. */
function BonusForm({ creatorId, name, onDone }: { creatorId: string; name: string; onDone: (msg: string) => void }) {
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const [amount, setAmount] = useState('50.00');
  const [reason, setReason] = useState(`Top creator of ${month}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const negative = amount.trim().startsWith('-');
    const cents = parseDollars(amount.replace('-', ''));
    if (!cents) return setError('Enter an amount, for example 50.00.');
    if (!reason.trim()) return setError('Add a reason. The creator sees it.');
    setBusy(true);
    const { error: e } = await supabase.from('bonuses').insert({ creator_id: creatorId, amount_cents: negative ? -cents : cents, reason: reason.trim() });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    onDone(`${usd(negative ? -cents : cents)} bonus for ${name || 'creator'} added. It is now in what you owe.`);
  };
  return (
    <Card style={{ gap: 12, borderColor: colors.accent }}>
      <T variant="bodyStrong">Give a bonus</T>
      <Chips value={reason} onChange={setReason} options={[`Top creator of ${month}`, 'Most views this week', 'Great content', 'Thank you'].map((r) => ({ value: r, label: r }))} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 120 }}><Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="numbers-and-punctuation" /></View>
        <View style={{ flex: 1 }}><Field label="Reason (they see this)" value={reason} onChangeText={setReason} /></View>
      </View>
      <T variant="small">Put a minus in front (e.g. -10) to correct a mistake.</T>
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button kind="money" title="Add bonus" onPress={save} busy={busy} />
    </Card>
  );
}

/** Owner: turn the leaderboard on for creators and name the prize. */
function BoardSettingsSheet({ s, onClose, onSaved }: { s: LeaderboardSettings; onClose: () => void; onSaved: (m: string) => void }) {
  const [visible, setVisible] = useState(s.visible ? 'on' : 'off');
  const [prize, setPrize] = useState(s.prize_text || '$50 for the #1 creator of the month');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const { error: e } = await supabase.from('leaderboard_settings').update({ visible: visible === 'on', prize_text: prize.trim() }).eq('id', true);
    if (e) return setError(friendlyError(e));
    onSaved(visible === 'on' ? 'Creators can now see the leaderboard' : 'Leaderboard hidden from creators');
  };
  return (
    <Sheet visible onClose={onClose} title="Leaderboard">
      <T variant="muted">Creators see first names and views only, never money. You decide the prize and pay it with Give a bonus.</T>
      <Chips value={visible} onChange={setVisible} options={[{ value: 'off', label: 'Only me' }, { value: 'on', label: 'Show to creators' }]} />
      <Field label="Prize text (shown above the list)" value={prize} onChangeText={setPrize} placeholder="$50 for the #1 creator of the month" />
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title="Save" onPress={save} />
    </Sheet>
  );
}
