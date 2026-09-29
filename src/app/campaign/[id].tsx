import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button, Card, ErrorNote, Loading, Screen, T, hueFor, useToast } from '../../components/ui';
import { homeFor, useAuth } from '../../lib/auth';
import { short, usd } from '../../lib/format';
import { rateFor } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { kindLabel, type Campaign, type CreatorRate } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';
import { t } from '../../lib/i18n';

export default function CampaignScreen() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return null;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  if (profile.role !== 'creator') return <Redirect href={homeFor(profile.role)} />;
  return <CampaignDetail />;
}

function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const q = useLoad(async () => {
    const [c, m, r, p] = await Promise.all([
      supabase.from('campaigns').select('*, brands(name)').eq('id', id).single(),
      supabase.from('campaign_members').select('campaign_id').eq('campaign_id', id).eq('creator_id', profile!.id).maybeSingle(),
      supabase.from('creator_rates').select('*').eq('creator_id', profile!.id),
      supabase.from('content_packs').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('active', true),
    ]);
    return { c: must(c) as Campaign, joined: !!must(m), rates: must(r) as CreatorRate[], packs: p.count ?? 0 };
  });
  const d = q.data;
  const rate = d ? rateFor(d.rates, profile!.id, d.c) : null;

  const join = async () => {
    setBusy(true);
    const { error } = await supabase.from('campaign_members').insert({ campaign_id: id, creator_id: profile!.id });
    setBusy(false);
    if (error) return show(friendlyError(error));
    show(t('Joined'));
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={q.refresh} refreshing={q.refreshing}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(creator)/discover'))} accessibilityRole="button" hitSlop={10}>
          <T variant="bodyStrong" style={{ color: colors.accent }}>{t("\u2039 Back")}</T>
        </Pressable>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d || !rate ? (q.error ? null : <Loading />) : (
          <>
            <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: hueFor(d.c.brand_id) }}>
              <View style={{ padding: 18, gap: 6 }}>
                <T variant="label" style={{ color: '#fff' }}>{kindLabel(d.c.kind)}</T>
                <T variant="title" style={{ color: '#fff', fontSize: 28 }}>{d.c.name}</T>
                {d.c.description ? <T variant="body" style={{ color: 'rgba(255,255,255,0.9)' }}>{d.c.description}</T> : null}
              </View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: 18, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <T variant="h2" style={{ color: '#fff' }}>{usd(rate.fixed_cents ?? rate.cpm_cents)}</T>
                    <T variant="small" style={{ color: 'rgba(255,255,255,0.8)' }}>{rate.fixed_cents != null ? t('per video') : t('per 1K views')}{rate.custom ? ' · ' + t('your rate') : ''}</T>
                  </View>
                  {d.joined ? <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}><T variant="bodyStrong" style={{ color: '#fff' }}>{t("Joined")}</T></View>
                    : <Button small title={t("Join")} onPress={join} busy={busy} />}
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <T variant="body" style={{ flex: 1, color: '#fff' }}>{t("Starts paying at")}</T>
                  <T variant="bodyStrong" style={{ color: '#fff' }}>{t('{n} views per video', { n: short(rate.min_views) })}</T>
                </View>
              </View>
            </View>

            {d.c.instructions ? (
              <Card style={{ gap: 8 }}>
                <T variant="h2">{t("How it works")}</T>
                <T variant="body">{d.c.instructions}</T>
              </Card>
            ) : null}

            {d.c.requirements.length ? (
              <Card style={{ gap: 8 }}>
                <T variant="h2">{t("Your post must")}</T>
                {d.c.requirements.map((r) => <T key={r} variant="body">• {r}</T>)}
              </Card>
            ) : null}

            {d.joined ? (
              <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id } })} accessibilityRole="button"
                style={{ backgroundColor: colors.accent, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <T variant="h2" style={{ color: colors.onAccent }}>{t("Start posting")}</T>
                  <T variant="body" style={{ color: colors.onAccent }}>
                    {d.packs ? t('Get your slides and caption, post them, get paid for your views') : t('Post your video and send us the link')}
                  </T>
                </View>
                <Icon name="chevron" color={colors.onAccent} size={26} />
              </Pressable>
            ) : <T variant="muted" style={{ textAlign: 'center' }}>{t("Join the campaign to start posting.")}</T>}
          </>
        )}
      </Screen>
      {toast}
    </View>
  );
}
