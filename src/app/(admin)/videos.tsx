import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { earningLine } from '../../components/parts';
import { ReviewList } from '../../components/ReviewList';
import { Chips, Empty, ErrorNote, Field, List, Loading, Row, Screen, T, hueFor, useToast } from '../../components/ui';
import { day, usd } from '../../lib/format';
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
          { value: 'views', label: 'Update views' }, { value: 'review', label: `To review (${pending.length})` },
        ]} />
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : tab === 'review' ? (
          <ReviewList subs={pending} onChanged={q.reload} onToast={show} />
        ) : (
          <>
            <T variant="muted">Type the latest view count from TikTok. The amount under each number updates right away.</T>
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Creator, @account or campaign" autoCapitalize="none" />
            <List>
              {list.length ? list.map((s, i) => <ViewsRow key={s.id} s={s} last={i === list.length - 1} onSaved={show} />)
                : <Empty text={all.length ? 'No approved videos match.' : 'No videos yet.'} />}
            </List>
          </>
        )}
      </Screen>
      {toast}
    </View>
  );
}

function ViewsRow({ s, last, onSaved }: { s: Submission; last: boolean; onSaved: (t: string) => void }) {
  const [text, setText] = useState(String(s.views));
  const [saved, setSaved] = useState(s.views);
  const views = Number(text.replace(/\D/g, '')) || 0;
  const e = earningLine({ ...s, views });

  const save = async () => {
    if (views === saved) return;
    const { error } = await supabase.from('submissions').update({ views }).eq('id', s.id);
    if (error) return onSaved(friendlyError(error));
    setSaved(views);
    onSaved(`@${s.tiktok_accounts?.username}: ${views.toLocaleString('en-US')} views saved`);
  };

  return (
    <Row last={last}
      left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hueFor(s.campaign_id) }} />}
      title={'@' + (s.tiktok_accounts?.username ?? '')}
      subtitle={`${s.profiles?.name ?? ''} · ${s.campaigns?.name ?? ''} · ${day(s.created_at)}`}
      right={<>
        <TextInput value={text} onChangeText={setText} onBlur={save} onSubmitEditing={save} keyboardType="number-pad" returnKeyType="done"
          accessibilityLabel={`Views for @${s.tiktok_accounts?.username}`}
          style={{ width: 96, textAlign: 'right', backgroundColor: colors.surface2, borderWidth: 1, borderColor: views !== saved ? colors.accent : colors.line,
            borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, color: colors.text, fontFamily: fonts.bodySemi, fontVariant: ['tabular-nums'] }} />
        <T variant="small" style={{ color: e.cents > 0 ? colors.money : colors.muted }}>{e.cents > 0 ? usd(e.cents) : `Under ${s.campaigns?.min_views ?? 1000}: $0`}</T>
      </>} />
  );
}
