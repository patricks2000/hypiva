import { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { earningLine } from '../../components/parts';
import { ReviewList } from '../../components/ReviewList';
import { router } from 'expo-router';
import { Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, List, Loading, Row, Screen, Sheet, T, hueFor, useToast } from '../../components/ui';
import { day, short, usd } from '../../lib/format';
import { SUB_FIELDS_WITH_CREATOR, withRates } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors, fonts } from '../../lib/theme';
import type { CreatorRate, Submission } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

type Tab = 'views' | 'review';

export default function Videos() {
  const [tab, setTab] = useState<Tab>('views');
  const [search, setSearch] = useState('');
  const { toast, show } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const refreshViews = async () => {
    setRefreshing(true);
    const { error: e1 } = await supabase.rpc('request_views_refresh');
    const { data, error: e2 } = e1 ? { data: null, error: e1 } : await supabase.functions.invoke('refresh-views', { body: {} });
    setRefreshing(false);
    if (e2) return show(friendlyError(e2));
    const r = data as { checked: number; updated: number; failed: number };
    show(`Checked ${r.checked} videos: ${r.updated} updated${r.failed ? `, ${r.failed} need a look` : ''}. The rest follow within 3 hours.`);
    q.reload();
  };
  const q = useLoad(async () => {
    const [s, r] = await Promise.all([
      supabase.from('submissions').select(SUB_FIELDS_WITH_CREATOR).order('created_at', { ascending: false }).limit(500),
      supabase.from('creator_rates').select('*'),
    ]);
    return withRates(must(s) as Submission[], must(r) as CreatorRate[]);
  });

  const all = q.data ?? [];
  const pending = all.filter((s) => s.status === 'pending');
  const needle = search.trim().toLowerCase().replace(/^@/, '');
  const list = all.filter((s) => s.status === 'approved' &&
    (!needle || `${s.tiktok_accounts?.username} ${s.profiles?.name} ${s.campaigns?.name}`.toLowerCase().includes(needle)));

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Videos" onRefresh={q.refresh} refreshing={q.refreshing}>
        <Chips<Tab> value={tab} onChange={setTab} options={[
          { value: 'views', label: 'All videos' }, { value: 'review', label: `To review (${pending.length})` },
        ]} />
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : tab === 'review' ? (
          <ReviewList subs={pending} onChanged={q.reload} onToast={show} />
        ) : (
          <>
            <Card style={{ gap: 6 }}>
              <T variant="body">{`${short(list.reduce((n, x) => n + x.views, 0))} views · ${usd(list.reduce((n, x) => n + earningLine(x).cents, 0))} earned`}</T>
              <T variant="muted">Views and earnings update by themselves every 3 hours. {"You don't need to type anything: what each creator is owed is under Money."}</T>
              <LinkButton title="Go to Money" onPress={() => router.push('/(admin)/overview')} />
            </Card>
            {list.some((s) => s.views_error) ? (
              <T variant="small" style={{ color: colors.warn }}>{list.filter((s) => s.views_error).length} videos could not be checked. Look for the ⚠ below: often the video is private, removed, or posted from another account.</T>
            ) : null}
            <Button kind="ghost" title="Check views now" onPress={refreshViews} busy={refreshing} />
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Creator, @account or campaign" autoCapitalize="none" />
            <List>
              {list.length ? list.map((s, i) => <ViewsRow key={s.id} s={s} last={i === list.length - 1} onSaved={show} onRemoved={q.reload} />)
                : <Empty text={all.length ? 'No approved videos match.' : 'No videos yet.'} />}
            </List>
          </>
        )}
      </Screen>
      {toast}
    </View>
  );
}

function ViewsRow({ s, last, onSaved, onRemoved }: { s: Submission; last: boolean; onSaved: (t: string) => void; onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [sure, setSure] = useState(false);
  const [text, setText] = useState(String(s.views));
  const [saved, setSaved] = useState(s.views);
  const shown = fixing ? Number(text.replace(/\D/g, '')) || 0 : saved;
  const e = earningLine({ ...s, views: shown });
  const who = '@' + (s.tiktok_accounts?.username ?? '');

  // Only for when TikTok can't be read: type the views by hand once.
  const save = async () => {
    setFixing(false);
    if (shown === saved) return;
    const { error } = await supabase.from('submissions').update({ views: shown }).eq('id', s.id);
    if (error) return onSaved(friendlyError(error));
    setSaved(shown);
    onSaved(`${who}: ${shown.toLocaleString('en-US')} views saved`);
  };
  const remove = async () => {
    if (!sure) return setSure(true);
    const { error } = await supabase.from('submissions').delete().eq('id', s.id);
    if (error) return onSaved(friendlyError(error));
    setOpen(false);
    onSaved(`Video from ${who} removed`);
    onRemoved();
  };

  const status = s.views_error ? `⚠ ${s.views_error}` : s.views_checked_at ? `Updated automatically · ${day(s.views_checked_at)}` : 'First check within 3 hours';
  return (
    <>
      <Row last={last} onPress={() => { setSure(false); setOpen(true); }}
        left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hueFor(s.campaign_id) }} />}
        title={who}
        lines={3}
        subtitle={`${s.profiles?.name ?? ''} · ${s.campaigns?.name ?? ''} · ${day(s.created_at)}\n${status}`}
        right={<>
          <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{`${short(shown)} views`}</T>
          <T variant="small" style={{ color: e.cents > 0 ? colors.money : colors.muted }}>{e.cents > 0 ? `Earns ${usd(e.cents)}` : `Under ${short(s.campaigns?.min_views ?? 1000)}: $0`}</T>
        </>} />
      <Sheet visible={open} onClose={() => { setFixing(false); setOpen(false); }} title={`Video from ${who}`}>
        <T variant="muted">{`${s.campaigns?.name ?? ''} · ${short(shown)} views · ${e.cents > 0 ? `earns ${usd(e.cents)}` : 'earns nothing yet'}\n${status}`}</T>
        <Button kind="ghost" title="Open in TikTok" onPress={() => Linking.openURL(s.url)} />
        {fixing ? (
          <>
            <T variant="small">{"Only if TikTok can't be read: type the views you see on the video."}</T>
            <TextInput value={text} onChangeText={setText} onSubmitEditing={save} keyboardType="number-pad" returnKeyType="done" autoFocus
              accessibilityLabel={`Views for ${who}`}
              style={{ backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
                color: colors.text, fontFamily: fonts.bodySemi, fontVariant: ['tabular-nums'] }} />
            <Button title="Save views" onPress={save} />
          </>
        ) : <Button kind="ghost" title="Type views by hand" onPress={() => setFixing(true)} />}
        <Button kind="danger" title={sure ? 'Tap again to remove this video' : 'Remove video'} onPress={remove} />
        {sure ? <T variant="small" style={{ color: colors.bad }}>{"The video and what it earned are removed from the creator's money. This can't be undone."}</T> : null}
      </Sheet>
    </>
  );
}
