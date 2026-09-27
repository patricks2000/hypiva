import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CampaignCard } from '../../components/parts';
import { Card, Chips, Empty, ErrorNote, Field, Loading, Screen, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { friendlyError, supabase } from '../../lib/supabase';
import { rateFor } from '../../lib/queries';
import type { Campaign, CreatorRate } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

type Filter = 'all' | 'ready_to_post' | 'create_your_own';

export default function Discover() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const { toast, show } = useToast();
  const q = useLoad(async () => {
    const [c, m, r] = await Promise.all([
      supabase.from('campaigns').select('*, brands(name)').eq('status', 'live').order('created_at', { ascending: false }),
      supabase.from('campaign_members').select('campaign_id').eq('creator_id', profile!.id),
      supabase.from('creator_rates').select('*').eq('creator_id', profile!.id),
    ]);
    return { campaigns: must(c) as Campaign[], joined: new Set((must(m) as { campaign_id: string }[]).map((x) => x.campaign_id)), rates: must(r) as CreatorRate[] };
  });

  const join = async (c: Campaign) => {
    setBusy(c.id);
    const { error } = await supabase.from('campaign_members').insert({ campaign_id: c.id, creator_id: profile!.id });
    setBusy(null);
    if (error) return show(friendlyError(error));
    show(`Joined ${c.name}`);
    q.reload();
  };

  const list = (q.data?.campaigns ?? []).filter((c) =>
    (filter === 'all' || c.kind === filter) &&
    `${c.name} ${c.description} ${c.brands?.name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Discover" onRefresh={q.refresh} refreshing={q.refreshing}>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search campaigns" autoCorrect={false} />
        <Chips<Filter> value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All' }, { value: 'ready_to_post', label: 'Ready-to-post' }, { value: 'create_your_own', label: 'Create your own' },
        ]} />
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : list.length ? list.map((c) => (
          <CampaignCard key={c.id} c={c} joined={q.data!.joined.has(c.id)} busy={busy === c.id} onJoin={() => join(c)} rate={rateFor(q.data!.rates, profile!.id, c)}
            onSubmit={() => router.push({ pathname: '/(creator)/submit', params: { campaign: c.id } })} />
        )) : (
          <Card><Empty text={q.data.campaigns.length ? 'No campaigns match your search.' : 'No campaigns are live right now. Check back soon.'} /></Card>
        )}
      </Screen>
      {toast}
    </View>
  );
}
