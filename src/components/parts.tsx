import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useState } from 'react';
import { Linking, Pressable, View, useWindowDimensions } from 'react-native';
import { day, short, usd, videoEarningsCents } from '../lib/format';
import { colors, fonts } from '../lib/theme';
import { kindLabel, type Campaign, type Submission } from '../lib/types';
import { Button, Card, Pill, Row, T, hueFor } from './ui';

/** A campaign as creators see it. */
export function CampaignCard({ c, joined, onJoin, onSubmit, busy, width, rate }: {
  c: Campaign; joined: boolean; onJoin?: () => void; onSubmit?: () => void; busy?: boolean; width?: number;
  rate?: { cpm_cents: number; min_views: number; custom: boolean };
}) {
  const color = hueFor(c.brand_id);
  const cpm = rate?.cpm_cents ?? c.cpm_cents, min = rate?.min_views ?? c.min_views;
  return (
    <View style={{ width, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ height: 110, backgroundColor: color, padding: 16, justifyContent: 'space-between' }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
          <T variant="label" style={{ color: '#fff', fontSize: 10.5 }}>{kindLabel(c.kind)}</T>
        </View>
        <T variant="title" style={{ color: '#fff', fontSize: 28 }} numberOfLines={1}>{c.brands?.name ?? c.name}</T>
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <T variant="bodyStrong" style={{ fontSize: 17 }}>{c.name}</T>
        {c.description ? <T variant="muted" numberOfLines={3}>{c.description}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
          <View style={{ flex: 1 }}>
            <T variant="h2" style={{ color: colors.money }}>{usd(cpm)}</T>
            <T variant="small">per 1K views · min. {short(min)} views per video{rate?.custom ? ' · your rate' : ''}</T>
          </View>
          {joined
            ? onSubmit ? <Button small kind="ghost" title="Submit video" onPress={onSubmit} /> : <Pill kind="linked" label="Joined" />
            : onJoin ? <Button small title="Join" onPress={onJoin} busy={busy} /> : null}
        </View>
      </View>
    </View>
  );
}

/** What a single video earns, in words people understand. */
export function earningLine(s: Submission) {
  const min = s.campaigns?.min_views ?? 1000;
  const cpm = s.campaigns?.cpm_cents ?? 0;
  if (s.status === 'rejected') return { text: s.reject_reason ? `Rejected: ${s.reject_reason}` : 'Rejected', cents: 0 };
  if (s.status === 'pending') return { text: 'Waiting for review', cents: 0 };
  if (s.views < min) return { text: `Needs ${short(min - s.views)} more views to start earning`, cents: 0 };
  return { text: `${usd(cpm)} per 1K views`, cents: videoEarningsCents(s.views, min, cpm) };
}

export function VideoRow({ s, last, showCreator }: { s: Submission; last?: boolean; showCreator?: boolean }) {
  const e = earningLine(s);
  const under = s.status === 'approved' && e.cents === 0;
  return (
    <Row
      last={last}
      onPress={() => Linking.openURL(s.url)}
      left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: hueFor(s.campaign_id) }} />}
      title={showCreator && s.profiles ? s.profiles.name : '@' + (s.tiktok_accounts?.username ?? 'tiktok')}
      lines={4}
      subtitle={`${s.campaigns?.name ?? ''} · ${day(s.created_at)}\n${e.text}`}
      right={<>
        <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{short(s.views)} views</T>
        {s.status === 'approved' && !under
          ? <T variant="bodyStrong" style={{ color: colors.money }}>{usd(e.cents)}</T>
          : <Pill kind={under ? 'under' : s.status} label={under ? 'Under ' + short(s.campaigns?.min_views ?? 1000) : undefined} />}
      </>}
    />
  );
}

/** Area chart of views, grouped by the day each video was posted. */
export function ViewsChart({ subs, days = 30 }: { subs: Submission[]; days?: number }) {
  const { width: screen } = useWindowDimensions();
  const W = Math.min(screen, 480) - 32 - 36, H = 170, pl = 34, pr = 8, pt = 10, pb = 22;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const buckets = new Array(days).fill(0) as number[];
  for (const s of subs) {
    if (s.status === 'rejected') continue;
    const i = Math.floor((new Date(s.created_at).getTime() - start.getTime()) / 864e5);
    if (i >= 0 && i < days) buckets[i] += s.views;
  }
  const max = Math.max(...buckets, 1);
  const step = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000].find((v) => max / v <= 4) ?? 500000;
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => pl + ((W - pl - pr) * i) / (days - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  let d = `M${x(0)},${y(buckets[0])}`;
  for (let i = 1; i < days; i++) { const mx = (x(i - 1) + x(i)) / 2; d += ` C${mx},${y(buckets[i - 1])} ${mx},${y(buckets[i])} ${x(i)},${y(buckets[i])}`; }
  const grid = [];
  for (let v = 0; v <= top; v += step) grid.push(v);
  const labels = [0, Math.round((days - 1) / 2), days - 1];
  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.35} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {grid.map((v) => (
        <Line key={'g' + v} x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={colors.line} strokeWidth={1} />
      ))}
      {grid.map((v) => (
        <SvgText key={'t' + v} x={pl - 6} y={y(v) + 4} fontSize={10} fill={colors.faint} textAnchor="end" fontFamily={fonts.body}>{short(v)}</SvgText>
      ))}
      <Path d={`${d} L${x(days - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#fill)" />
      <Path d={d} fill="none" stroke={colors.accent} strokeWidth={2.4} />
      <Circle cx={x(days - 1)} cy={y(buckets[days - 1])} r={4} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
      {labels.map((i) => {
        const dt = new Date(start.getTime() + i * 864e5);
        return (
          <SvgText key={'l' + i} x={x(i)} y={H - 5} fontSize={10} fill={colors.faint} fontFamily={fonts.body}
            textAnchor={i === 0 ? 'start' : i === days - 1 ? 'end' : 'middle'}>
            {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </SvgText>
        );
      })}
    </Svg>
  );
}

/** GitHub-style grid of posts per day for the last 26 weeks. */
export function PostingActivity({ subs }: { subs: Submission[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const weeks = 26;
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const first = new Date(end.getTime() - (weeks * 7 - 1) * 864e5);
  const shift = (first.getDay() + 6) % 7;
  const counts = new Map<string, number>();
  for (const s of subs) { const k = new Date(s.created_at).toDateString(); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const cols: { key: string; n: number; label: string }[][] = [];
  let col: { key: string; n: number; label: string }[] = Array.from({ length: shift }, (_, i) => ({ key: 'pad' + i, n: -1, label: '' }));
  for (let i = 0; i < weeks * 7; i++) {
    const dt = new Date(first.getTime() + i * 864e5);
    col.push({ key: dt.toDateString(), n: counts.get(dt.toDateString()) ?? 0, label: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    if (col.length === 7) { cols.push(col); col = []; }
  }
  if (col.length) cols.push(col);
  const shade = (n: number) => (n <= 0 ? colors.surface2 : ['rgba(255,106,61,0.3)', 'rgba(255,106,61,0.55)', 'rgba(255,106,61,0.8)', colors.accent][Math.min(n, 4) - 1]);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {cols.map((c, ci) => (
          <View key={ci} style={{ flex: 1, gap: 3 }}>
            {c.map((cell) => (
              <Pressable key={cell.key} disabled={cell.n < 0} onPress={() => setPicked(`${cell.label}: ${cell.n} ${cell.n === 1 ? 'post' : 'posts'}`)}
                style={{ aspectRatio: 1, borderRadius: 3, backgroundColor: cell.n < 0 ? 'transparent' : shade(cell.n) }} />
            ))}
          </View>
        ))}
      </View>
      <T variant="small">{picked ?? 'Tap a day to see its post count'}</T>
    </View>
  );
}

export function Explainer({ minViews = 1000, cpmCents = 200 }: { minViews?: number; cpmCents?: number }) {
  return (
    <Card style={{ gap: 6, backgroundColor: colors.surface2 }}>
      <T variant="bodyStrong">How you earn</T>
      <T variant="muted">
        Each video counts on its own. A video starts earning once it reaches {short(minViews)} views, then every view pays.
        At {usd(cpmCents)} per 1K: 900 views = $0, {short(minViews)} views = {usd(videoEarningsCents(minViews, minViews, cpmCents))}, 5K views = {usd(videoEarningsCents(5000, minViews, cpmCents))}.
      </T>
    </Card>
  );
}
