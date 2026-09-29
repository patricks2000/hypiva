import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Avatar, Button, Card, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Section, T, Tile, Tiles, hueFor, useToast } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { day, usd } from '../lib/format';
import { loadReferrals, programLine } from '../lib/queries';
import { friendlyError, supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';
import { useLoad } from '../lib/useLoad';
import { t } from '../lib/i18n';

export default function InviteScreen() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return null;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  if (profile.role !== 'creator') return <Redirect href={homeFor(profile.role)} />;
  return <Invite />;
}

function Invite() {
  const { profile } = useAuth();
  const { toast, show } = useToast();
  const q = useLoad(async () => ({ ...(await loadReferrals(profile!.id)), now: Date.now() }));
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const myCode = profile?.referral_code ?? '';
  const total = d?.invites.reduce((sum, r) => sum + r.bonus_cents, 0) ?? 0;
  const canStillAddCode = !!d && !d.invitedBy && profile &&
    d.now - new Date(profile.created_at).getTime() < d.settings.signup_window_days * 864e5;

  const copy = async () => { await Clipboard.setStringAsync(myCode); show(t('Code copied')); };
  const share = () => Share.share({ message: t('Get paid for your TikTok views on Hypiva. Sign up with my code {code}', { code: myCode }) }).catch(() => {});

  const useCode = async () => {
    setError(null); setBusy(true);
    const { error: e } = await supabase.rpc('use_referral_code', { p_code: code.trim() });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    setCode('');
    show(t('Invite code added'));
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t("Invite & earn")} right={<Button small kind="ghost" title={t("Done")} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(creator)/profile'))} />}
        onRefresh={q.refresh} refreshing={q.refreshing}>
        <Card style={{ gap: 12 }}>
          <T variant="h2">{t("Your invite code")}</T>
          <T variant="body">{t("Know someone who would like to earn with TikTok? Give them your code. When they earn, you get a share on top.")}</T>
          {d ? <T variant="muted">{programLine(d.settings)} They keep everything they earn.</T> : null}
          <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={t("Copy your code")}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: 16 }}>
            <T variant="title" style={{ flex: 1, fontSize: 24, letterSpacing: 3, fontFamily: fonts.bodyBold }} selectable>{myCode}</T>
            <T variant="bodyStrong" style={{ color: colors.accent }}>{t("Copy")}</T>
          </Pressable>
          <Button title={t("Share my code")} onPress={share} />
          <T variant="bodyStrong">{t("Good people to ask")}</T>
          <T variant="muted">{t("Friends who post on TikTok, gym buddies, or smaller creators you follow. They type your code when they create their account.")}</T>
        </Card>

        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <Section title={t("Your invites")}>
              <Tiles>
                <Tile label={t("Joined")} value={String(d.invites.length)} sub="With your code" />
                <Tile highlight label={t("Earned from invites")} value={usd(total)} color={colors.money} sub="Added to your wallet" />
              </Tiles>
              <List>
                {d.invites.length ? d.invites.map((r, i) => {
                  const ended = new Date(r.ends_at).getTime() < d.now;
                  return (
                    <Row key={r.referred_id} last={i === d.invites.length - 1}
                      left={<Avatar name={r.first_name} color={hueFor(r.referred_id)} />}
                      title={r.first_name}
                      subtitle={t('Joined {date}', { date: day(r.joined_at) }) + ' · ' + (r.capped ? t('maximum reached') : ended ? t('bonus period ended') : t('earning until {date}', { date: day(r.ends_at) }))}
                      right={<>
                        <T variant="bodyStrong" style={{ color: r.bonus_cents ? colors.money : colors.muted }}>{usd(r.bonus_cents)}</T>
                        {r.capped ? <Pill kind="paid" label={t("Max")} /> : ended ? <Pill kind="ended" /> : <Pill kind="live" label={t("Active")} />}
                      </>} />
                  );
                }) : <Empty text={t("No one yet. Share your code and your first invite shows up here.")} />}
              </List>
            </Section>

            {canStillAddCode ? (
              <Section title={t("Did someone invite you?")}>
                <Card style={{ gap: 12 }}>
                  <T variant="muted">If someone invited you, add their code. You can do this in the first {d.settings.signup_window_days} days after signing up. It costs you nothing.</T>
                  <Field label={t("Their code")} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="HY..." error={error} />
                  <Button kind="ghost" title={t("Add code")} onPress={useCode} busy={busy} disabled={code.trim().length < 4} />
                </Card>
              </Section>
            ) : d.invitedBy ? <T variant="small" style={{ textAlign: 'center' }}>{t("You joined with an invite code.")}</T> : null}
          </>
        )}
      </Screen>
      {toast}
    </View>
  );
}
