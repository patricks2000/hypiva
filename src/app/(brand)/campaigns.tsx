import { router } from 'expo-router';
import { View } from 'react-native';
import { CampaignStatsCard } from '../../components/CampaignStatsCard';
import { Card, Empty, ErrorNote, LinkButton, Loading, Screen, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { friendlyError, supabase } from '../../lib/supabase';
import type { Campaign, CampaignStats } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

export default function BrandCampaigns() {
  const { profile } = useAuth();
  const { toast, show } = useToast();
  const q = useLoad(async () => {
    const [c, st] = await Promise.all([
      supabase.from('campaigns').select('*').eq('brand_id', profile!.brand_id!).order('created_at', { ascending: false }),
      supabase.from('campaign_stats').select('*'),
    ]);
    return { campaigns: must(c) as Campaign[], stats: new Map((must(st) as CampaignStats[]).map((x) => [x.campaign_id, x])) };
  });
  const toggle = async (c: Campaign) => {
    const { error } = await supabase.from('campaigns').update({ status: c.status === 'live' ? 'paused' : 'live' }).eq('id', c.id);
    if (error) return show(friendlyError(error));
    q.reload();
  };
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Your campaigns" onRefresh={q.refresh} refreshing={q.refreshing}>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : q.data.campaigns.length ? q.data.campaigns.map((c) => (
          <CampaignStatsCard forBrand key={c.id} c={c} stats={q.data!.stats.get(c.id)} onToggle={() => toggle(c)}
            onOpen={() => router.push({ pathname: '/manage/[id]', params: { id: c.id } })} />
        )) : <Card><Empty text="No campaigns yet." action={<LinkButton title="Create your first campaign" onPress={() => router.push('/(brand)/new')} />} /></Card>}
      </Screen>
      {toast}
    </View>
  );
}
