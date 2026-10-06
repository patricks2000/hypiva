import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, LinkButton, Pill, T, hueFor } from './ui';
import { num, short, usd } from '../lib/format';
import { colors } from '../lib/theme';
import { kindLabel, type Campaign, type CampaignStats } from '../lib/types';

/** A campaign with its numbers. forBrand hides what creators are paid: clients see reach, not our costs. */
export function CampaignStatsCard({ c, stats, onToggle, onOpen, onEditPay, onRemove, forBrand }: { c: Campaign; stats?: CampaignStats; onToggle?: () => void; onOpen?: () => void; onEditPay?: () => void; onRemove?: () => void; forBrand?: boolean }) {
  const [sure, setSure] = useState(false);
  const spent = stats?.spent_cents ?? 0;
  const pct = Math.min(100, (spent / c.budget_cents) * 100);
  return (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={onOpen} disabled={!onOpen} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hueFor(c.brand_id) }} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{c.name}</T>
          <T variant="muted">{forBrand ? `Budget ${usd(c.budget_cents)} · ${kindLabel(c.kind)}` : `${c.fixed_cents != null ? `${usd(c.fixed_cents)} per video` : `${usd(c.cpm_cents)} per 1K`} · min. ${short(c.min_views)} · ${kindLabel(c.kind)}`}</T>
        </View>
        <Pill kind={c.status} />
      </Pressable>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}><T variant="small">Views</T><T variant="h2">{num(stats?.views ?? 0)}</T></View>
        <View style={{ flex: 1 }}><T variant="small">Videos</T><T variant="h2">{stats?.videos ?? 0}</T></View>
      </View>
      {forBrand ? null : (
        <>
      <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <T variant="small">{usd(spent)} of {usd(c.budget_cents)} budget used</T>
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onOpen ? <Button small style={{ flex: 1 }} title="Content & checklist" onPress={onOpen} /> : null}
        {onEditPay ? <Button small style={{ flex: 1 }} kind="ghost" title="Pay & budget" onPress={onEditPay} /> : null}
        {onToggle && (!forBrand || c.status === 'live') ? <Button small style={{ flex: 1 }} kind="ghost" title={c.status === 'live' ? 'Pause' : 'Make live'} onPress={onToggle} /> : null}
        {forBrand && c.status !== 'live' ? <T variant="small" style={{ flex: 1, alignSelf: 'center' }}>The Hypiva team makes it live.</T> : null}
      </View>
      {onRemove ? (
        sure ? (
          <View style={{ gap: 8 }}>
            <T variant="small" style={{ color: colors.bad }}>{`Removes the campaign with its content and all ${stats?.videos ?? 0} videos, and what they earned. This can't be undone.`}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small style={{ flex: 1 }} kind="danger" title="Yes, remove" onPress={onRemove} />
              <Button small style={{ flex: 1 }} kind="ghost" title="Keep it" onPress={() => setSure(false)} />
            </View>
          </View>
        ) : <LinkButton title="Remove campaign" onPress={() => setSure(true)} />
      ) : null}
    </Card>
  );
}
