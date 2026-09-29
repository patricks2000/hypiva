import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Leaderboard } from '../../components/Leaderboard';
import { CampaignCard, Explainer, VideoRow, ViewsChart } from '../../components/parts';
import { Avatar, Card, Empty, ErrorNote, LinkButton, List, Loading, Screen, Section, T, Tile, Tiles } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../lib/auth';
import { num, usd } from '../../lib/format';
import { loadCreator, rateFor } from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';
import { t } from '../../lib/i18n';

export default function CreatorHome() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const q = useLoad(() => loadCreator(profile!.id));
  const d = q.data;
  return (
    <Screen onRefresh={q.refresh} refreshing={q.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Logo size={28} style={{ flex: 1 }} />
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
            <Tile highlight label={t("Views")} value={num(d.balance.views)} sub={t('{n} videos', { n: d.balance.videos })} />
            <Tile label={t("Earned")} value={usd(d.balance.earned_cents)} sub={t('{a} of {b} videos over the minimum', { a: d.balance.paid_videos, b: d.balance.videos }) + (d.balance.referral_earned_cents ? ' · ' + t('{x} from invites', { x: usd(d.balance.referral_earned_cents) }) : '') + (d.balance.bonus_cents ? ' · ' + t('{x} bonus', { x: usd(d.balance.bonus_cents) }) : '')} />
          </Tiles>
          <Card>
            <T variant="h2">{t("Views by posting day")}</T>
            <T variant="small">{t("Last 30 days")}</T>
            <View style={{ marginTop: 10 }}><ViewsChart subs={d.subs} /></View>
          </Card>
          {d.subs.length < 3 ? (() => { const c = d.joined[0]; const r = c ? rateFor(d.rates, profile!.id, c) : null; return <Explainer minViews={r?.min_views} cpmCents={r?.cpm_cents} fixedCents={r?.fixed_cents ?? null} />; })() : null}
          {d.boardSettings.visible ? (
            <Section title={t("Top creators this month")} hint={d.boardSettings.prize_text || t('Ranked by views gained this month.')}>
              <Leaderboard rows={d.board} empty={t('Nobody is on the board yet. Your views this month count.')} />
            </Section>
          ) : null}
          <Section title={t("Your campaigns")} right={<LinkButton title={t("Find more")} onPress={() => router.push('/(creator)/discover')} />}>
            {d.joined.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
                {d.joined.map((c) => (
                  <CampaignCard key={c.id} c={c} joined width={Math.min(width, 480) * 0.82} rate={rateFor(d.rates, profile!.id, c)}
                    onOpen={() => router.push({ pathname: '/campaign/[id]', params: { id: c.id } })}
                    onSubmit={() => router.push({ pathname: '/post/[id]', params: { id: c.id } })} />
                ))}
              </ScrollView>
            ) : (
              <Card><Empty text={t("You have not joined a campaign yet.")} action={<LinkButton title={t("Browse campaigns")} onPress={() => router.push('/(creator)/discover')} />} /></Card>
            )}
          </Section>
          <Section title={t("Your videos")} right={<T variant="muted">{d.subs.filter((s) => s.status === 'pending').length} in review</T>}>
            <List>
              {d.subs.length
                ? d.subs.map((s, i) => <VideoRow key={s.id} s={s} last={i === d.subs.length - 1} />)
                : <Empty text={t("Videos you send in show up here with their views and what they earn.")} />}
            </List>
          </Section>
        </>
      )}
    </Screen>
  );
}
