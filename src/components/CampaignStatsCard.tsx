import { View } from 'react-native';
import { Button, Card, Pill, T, hueFor } from './ui';
import { num, short, usd } from '../lib/format';
import { colors } from '../lib/theme';
import { kindLabel, type Campaign, type CampaignStats } from '../lib/types';

export function CampaignStatsCard({ c, stats, onToggle }: { c: Campaign; stats?: CampaignStats; onToggle?: () => void }) {
  const spent = stats?.spent_cents ?? 0;
  const pct = Math.min(100, (spent / c.budget_cents) * 100);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hueFor(c.brand_id) }} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{c.name}</T>
          <T variant="muted">{usd(c.cpm_cents)} per 1K · min. {short(c.min_views)} · {kindLabel(c.kind)}</T>
        </View>
        <Pill kind={c.status} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}><T variant="small">Views</T><T variant="h2">{num(stats?.views ?? 0)}</T></View>
        <View style={{ flex: 1 }}><T variant="small">Videos</T><T variant="h2">{stats?.videos ?? 0}</T></View>
      </View>
      <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <T variant="small">{usd(spent)} of {usd(c.budget_cents)} budget used</T>
      {onToggle ? <Button small kind="ghost" title={c.status === 'live' ? 'Pause campaign' : 'Make live again'} onPress={onToggle} /> : null}
    </Card>
  );
}
