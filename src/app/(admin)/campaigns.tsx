import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CampaignForm, PayForm } from '../../components/CampaignForm';
import { CampaignStatsCard } from '../../components/CampaignStatsCard';
import { Button, Card, Empty, ErrorNote, Field, List, Loading, Row, Screen, Section, Sheet, T, useToast } from '../../components/ui';
import { friendlyError, supabase } from '../../lib/supabase';
import type { Brand, Campaign, CampaignStats } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

export default function AdminCampaigns() {
  const { toast, show } = useToast();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Campaign | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [brandName, setBrandName] = useState('');
  const q = useLoad(async () => {
    const [c, st, b] = await Promise.all([
      supabase.from('campaigns').select('*, brands(name)').order('created_at', { ascending: false }),
      supabase.from('campaign_stats').select('*'),
      supabase.from('brands').select('*').order('name'),
    ]);
    return {
      campaigns: must(c) as Campaign[],
      stats: new Map((must(st) as CampaignStats[]).map((x) => [x.campaign_id, x])),
      brands: must(b) as Brand[],
    };
  });

  const addBrand = async () => {
    const { error } = await supabase.from('brands').insert({ name: brandName.trim() });
    if (error) return show(friendlyError(error));
    setAddingBrand(false); setBrandName('');
    show('Brand added');
    q.reload();
  };

  const toggle = async (c: Campaign) => {
    const { error } = await supabase.from('campaigns').update({ status: c.status === 'live' ? 'paused' : 'live' }).eq('id', c.id);
    if (error) return show(friendlyError(error));
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Campaigns" onRefresh={q.refresh} refreshing={q.refreshing}
        right={<Button small title="New" onPress={() => setCreating(true)} />}>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : (
          <>
            {q.data.campaigns.length ? q.data.campaigns.map((c) => (
              <CampaignStatsCard key={c.id} c={c} stats={q.data!.stats.get(c.id)} onToggle={() => toggle(c)} onEditPay={() => setPaying(c)}
            onOpen={() => router.push({ pathname: '/manage/[id]', params: { id: c.id } })} />
            )) : <Card><Empty text="No campaigns yet. Add a brand, then create a campaign." /></Card>}
            <Section title="Brands" right={<Button small kind="ghost" title="Add brand" onPress={() => setAddingBrand(true)} />}>
              <List>
                {q.data.brands.length ? q.data.brands.map((b, i) => (
                  <Row key={b.id} last={i === q.data!.brands.length - 1} title={b.name}
                    subtitle={`${q.data!.campaigns.filter((c) => c.brand_id === b.id).length} campaigns`} />
                )) : <Empty text="No brands yet." />}
              </List>
              <T variant="small">To let someone from a brand log in, give them the Brand role under People.</T>
            </Section>
          </>
        )}
      </Screen>
      <Sheet visible={creating} onClose={() => setCreating(false)} title="New campaign">
        <CampaignForm brands={q.data?.brands ?? []} onDone={(m) => { setCreating(false); show(m); q.reload(); }} />
      </Sheet>
      <Sheet visible={!!paying} onClose={() => setPaying(null)} title={paying ? `Pay: ${paying.name}` : 'Pay'}>
        {paying ? <PayForm c={paying} onDone={(m) => { setPaying(null); show(m); q.reload(); }} /> : null}
      </Sheet>
      <Sheet visible={addingBrand} onClose={() => setAddingBrand(false)} title="Add a brand">
        <Field label="Brand name" value={brandName} onChangeText={setBrandName} placeholder="Macro Snap" />
        <Button title="Add brand" onPress={addBrand} disabled={!brandName.trim()} />
      </Sheet>
      {toast}
    </View>
  );
}
