import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { CampaignCard, Explainer, VideoRow, ViewsChart } from '../../components/parts';
import { Avatar, Card, Empty, ErrorNote, LinkButton, List, Loading, Screen, Section, T, Tile, Tiles } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { num, usd } from '../../lib/format';
import { loadCreator } from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function CreatorHome() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const q = useLoad(() => loadCreator(profile!.id));
  const d = q.data;
  return (
    <Screen onRefresh={q.refresh} refreshing={q.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] }} />
        <T variant="title" style={{ flex: 1, fontSize: 28 }}>Viewtra</T>
        {d ? (
          <View style={{ backgroundColor: colors.moneySoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }}>
            <T variant="bodyStrong" style={{ color: colors.money }}>{usd(d.balance.available_cents)}</T>
          </View>
        ) : null}
        <Avatar name={profile?.name || '?'} />
      </View>
      {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
      {!d ? (q.error ? null : <Loading />) : (
        <>
          <Tiles>
            <Tile highlight label="Views" value={num(d.balance.views)} sub={`${d.balance.videos} videos`} />
            <Tile label="Earned" value={usd(d.balance.earned_cents)} sub={`${d.balance.paid_videos} of ${d.balance.videos} videos over the minimum`} />
          </Tiles>
          <Card>
            <T variant="h2">Views by posting day</T>
            <T variant="small">Last 30 days</T>
            <View style={{ marginTop: 10 }}><ViewsChart subs={d.subs} /></View>
          </Card>
          {d.subs.length < 3 ? <Explainer /> : null}
          <Section title="Your campaigns" right={<LinkButton title="Find more" onPress={() => router.push('/(creator)/discover')} />}>
            {d.joined.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
                {d.joined.map((c) => (
                  <CampaignCard key={c.id} c={c} joined width={Math.min(width, 480) * 0.82}
                    onSubmit={() => router.push({ pathname: '/(creator)/submit', params: { campaign: c.id } })} />
                ))}
              </ScrollView>
            ) : (
              <Card><Empty text="You have not joined a campaign yet." action={<LinkButton title="Browse campaigns" onPress={() => router.push('/(creator)/discover')} />} /></Card>
            )}
          </Section>
          <Section title="Your videos" right={<T variant="muted">{d.subs.filter((s) => s.status === 'pending').length} in review</T>}>
            <List>
              {d.subs.length
                ? d.subs.map((s, i) => <VideoRow key={s.id} s={s} last={i === d.subs.length - 1} />)
                : <Empty text="Videos you send in show up here with their views and what they earn." />}
            </List>
          </Section>
        </>
      )}
    </Screen>
  );
}
