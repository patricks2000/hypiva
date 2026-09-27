import { View } from 'react-native';
import { Avatar, Empty, List, Row, T, hueFor } from './ui';
import { num, short, usd } from '../lib/format';
import { colors } from '../lib/theme';
import type { LeaderRow } from '../lib/types';

const MEDAL = ['#FFC24B', '#C9CED6', '#D98C5F'];

/** Ranked list of views gained this month. Admins also see earnings and can tap a row. */
export function Leaderboard({ rows, onPress, empty }: { rows: LeaderRow[]; onPress?: (r: LeaderRow) => void; empty?: string }) {
  return (
    <List>
      {rows.length ? rows.map((r, i) => (
        <Row key={`${r.rank}-${r.first_name}`} last={i === rows.length - 1}
          onPress={onPress && r.creator_id ? () => onPress(r) : undefined}
          left={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: MEDAL[r.rank - 1] ?? colors.surface2 }}>
                <T variant="bodyStrong" style={{ color: r.rank <= 3 ? '#1a1206' : colors.muted, fontSize: 13 }}>{r.rank}</T>
              </View>
              <Avatar name={r.first_name} color={r.creator_id ? hueFor(r.creator_id) : colors.faint} size={36} />
            </View>
          }
          title={r.is_me ? `${r.first_name} (you)` : r.first_name}
          subtitle={`${num(r.views_gained)} views this month`}
          right={r.earned_cents != null
            ? <T variant="bodyStrong" style={{ color: colors.money }}>{usd(r.earned_cents)}</T>
            : <T variant="bodyStrong">{short(r.views_gained)}</T>} />
      )) : <Empty text={empty ?? 'Nobody has gained views this month yet.'} />}
    </List>
  );
}
