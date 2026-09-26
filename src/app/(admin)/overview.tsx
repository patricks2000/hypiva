import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { VideoRow } from '../../components/parts';
import { Avatar, Button, Card, Empty, ErrorNote, Field, LinkButton, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, hueFor, useToast } from '../../components/ui';
import { day, num, short, usd } from '../../lib/format';
import { SUB_FIELDS } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { CreatorBalance, Payout, Profile, Submission } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

type Sort = 'owed' | 'views' | 'name';

export default function Money() {
  const { toast, show } = useToast();
  const [sort, setSort] = useState<Sort>('owed');
  const [paying, setPaying] = useState<CreatorBalance | null>(null);
  const q = useLoad(async () => {
    const [b, p, pend] = await Promise.all([
      supabase.from('creator_balances').select('*'),
      supabase.from('payouts').select('*').eq('status', 'requested').order('requested_at'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    if (pend.error) throw pend.error;
    return { balances: must(b) as CreatorBalance[], requests: must(p) as Payout[], pending: pend.count ?? 0 };
  });
  const d = q.data;
  const rows = (d?.balances ?? []).filter((b) => b.videos || b.paid_cents || b.requested_cents).sort((a, b) =>
    sort === 'owed' ? b.owed_cents - a.owed_cents : sort === 'views' ? b.views - a.views : a.name.localeCompare(b.name));
  const total = (k: keyof CreatorBalance) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const asked = new Set(d?.requests.map((r) => r.creator_id));

  const copySheet = async () => {
    const lines = [['Name', 'Username', 'Videos', 'Videos over minimum', 'Views', 'Earned', 'Paid', 'Owed'].join('\t')].concat(
      rows.map((r) => [r.name, r.handle ? '@' + r.handle : '', r.videos, r.paid_videos, r.views,
        (r.earned_cents / 100).toFixed(2), (r.paid_cents / 100).toFixed(2), (r.owed_cents / 100).toFixed(2)].join('\t')));
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

            <Section title="Per creator" hint="Owed = earnings from approved videos that reached the minimum, minus what you already paid."
              right={<LinkButton title="Copy as spreadsheet" onPress={copySheet} />}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['owed', 'views', 'name'] as Sort[]).map((k) => (
                  <Button key={k} small kind={sort === k ? 'primary' : 'ghost'} title={k === 'owed' ? 'Most owed' : k === 'views' ? 'Most views' : 'A-Z'} onPress={() => setSort(k)} />
                ))}
              </View>
              <List>
                {rows.length ? rows.map((r, i) => (
                  <Row key={r.creator_id} last={i === rows.length - 1} onPress={() => setPaying(r)}
                    left={<Avatar name={r.name || '?'} color={hueFor(r.creator_id)} />}
                    title={r.name || 'No name'}
                    subtitle={`${r.paid_videos} of ${r.videos} videos over the minimum · ${short(r.views)} views`}
                    right={<>
                      <T variant="bodyStrong" style={{ color: r.owed_cents > 0 ? colors.money : colors.muted }}>{usd(r.owed_cents)}</T>
                      {asked.has(r.creator_id) ? <Pill kind="requested" label="Asked" /> : r.owed_cents > 0 ? <T variant="small">owed</T> : <T variant="small">settled</T>}
                    </>} />
                )) : <Empty text="No creators have posted yet." />}
              </List>
            </Section>
          </>
        )}
      </Screen>
      {paying ? <PaySheet b={paying} onClose={() => setPaying(null)} onPaid={(m) => { show(m); setPaying(null); q.reload(); }} /> : null}
      {toast}
    </View>
  );
}

/** Everything about one creator's money, with the video-by-video maths. */
function PaySheet({ b, onClose, onPaid }: { b: CreatorBalance; onClose: () => void; onPaid: (msg: string) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useLoad(async () => {
    const [p, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', b.creator_id).single(),
      supabase.from('submissions').select(SUB_FIELDS).eq('creator_id', b.creator_id).order('created_at', { ascending: false }),
    ]);
    return { profile: must(p) as Profile, subs: must(s) as Submission[] };
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
        <T variant="muted">{b.paid_videos} of {b.videos} videos reached the minimum · {num(b.views)} views · {usd(b.earned_cents)} earned · {usd(b.paid_cents)} already paid</T>
      </Card>
      <Card style={{ gap: 6 }}>
        <T variant="label">Send to</T>
        {q.data ? (details
          ? <><T variant="bodyStrong" selectable>{q.data.profile.payout_method === 'bank' ? 'Bank: ' : 'PayPal: '}{details}</T>
              <LinkButton title="Copy" onPress={() => Clipboard.setStringAsync(details)} /></>
          : <T variant="muted">This creator has not added payout details yet.</T>) : <Loading />}
      </Card>
      {b.owed_cents > 0 ? (
        <>
          <T variant="muted">Send {usd(b.owed_cents)} first, then mark it as paid so the balance goes to $0.</T>
          <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="PayPal transaction ID" error={error} />
          <Button kind="money" title={`Mark ${usd(b.owed_cents)} as paid`} onPress={pay} busy={busy} />
        </>
      ) : <T variant="muted">Nothing owed right now.</T>}
      <T variant="h2" style={{ marginTop: 8 }}>Videos</T>
      <List>
        {q.data ? (q.data.subs.length ? q.data.subs.map((s, i) => <VideoRow key={s.id} s={s} last={i === q.data!.subs.length - 1} />)
          : <Empty text="No videos." />) : <Loading />}
      </List>
    </Sheet>
  );
}
