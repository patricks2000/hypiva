import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, Loading, Screen, T, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { isTikTokUrl, short, usd } from '../../lib/format';
import { loadCreator, rateFor } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';
import { t } from '../../lib/i18n';

export default function Submit() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ campaign?: string }>();
  const q = useLoad(() => loadCreator(profile!.id));
  // What the person tapped wins; otherwise the campaign they came from, otherwise their first one.
  const [picked, setPicked] = useState<{ from?: string; id: string } | null>(null);
  const [pickedAccount, setAccount] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const d = q.data;
  const campaign = picked && picked.from === params.campaign ? picked.id : params.campaign ?? d?.joined[0]?.id ?? '';
  const setCampaign = (id: string) => setPicked({ from: params.campaign, id });
  const account = pickedAccount ?? d?.accounts[0]?.id ?? '';
  const chosenCampaign = d?.joined.find((c) => c.id === campaign);
  const chosen = chosenCampaign && d ? rateFor(d.rates, profile!.id, chosenCampaign) : null;

  const send = async () => {
    setError(null);
    if (!isTikTokUrl(url)) return setError(t('Paste a link that starts with https://www.tiktok.com/ or https://vm.tiktok.com/'));
    setBusy(true);
    const { error: e } = await supabase.from('submissions').insert({
      campaign_id: campaign, creator_id: profile!.id, tiktok_account_id: account, url: url.trim(),
    });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    setUrl('');
    show(t('Sent! You can follow it under Your videos.'));
    q.reload();
    setTimeout(() => router.push('/(creator)/home'), 900);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t("Submit a video")}>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : !d.joined.length ? (
          <Card><Empty text={t("Join a campaign before sending in a video.")} action={<LinkButton title={t("Browse campaigns")} onPress={() => router.push('/(creator)/discover')} />} /></Card>
        ) : !d.accounts.length ? (
          <Card><Empty text={t("Link your TikTok account first so we know the video is yours.")} action={<LinkButton title={t("Link TikTok account")} onPress={() => router.push('/(creator)/profile')} />} /></Card>
        ) : (
          <Card style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <T variant="label">{t("Campaign")}</T>
              <Chips value={campaign} onChange={setCampaign} options={d.joined.map((c) => ({ value: c.id, label: c.name }))} />
              {chosen ? <T variant="small">{usd(chosen.cpm_cents)} per 1K views. The video needs {short(chosen.min_views)} views on its own to start earning.</T> : null}
            </View>
            <View style={{ gap: 8 }}>
              <T variant="label">{t("TikTok account")}</T>
              <Chips value={account} onChange={setAccount} options={d.accounts.map((a) => ({ value: a.id, label: '@' + a.username }))} />
            </View>
            <Field label={t("TikTok link")} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
              placeholder="https://www.tiktok.com/@you/video/..." error={error}
              hint={t("In TikTok: Share \u2192 Copy link, then paste it here.")} />
            <Button title={t("Send for review")} onPress={send} busy={busy} disabled={!url.trim()} />
            <T variant="small" style={{ color: colors.muted }}>{t("The brand checks your video. Once approved, your views are counted and your earnings go up.")}</T>
          </Card>
        )}
      </Screen>
      {toast}
    </View>
  );
}
