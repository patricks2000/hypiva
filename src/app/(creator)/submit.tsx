import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, Loading, Screen, T, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { isTikTokUrl, short, usd } from '../../lib/format';
import { loadCreator } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

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
  const chosen = d?.joined.find((c) => c.id === campaign);

  const send = async () => {
    setError(null);
    if (!isTikTokUrl(url)) return setError('Paste a link that starts with https://www.tiktok.com/ or https://vm.tiktok.com/');
    setBusy(true);
    const { error: e } = await supabase.from('submissions').insert({
      campaign_id: campaign, creator_id: profile!.id, tiktok_account_id: account, url: url.trim(),
    });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    setUrl('');
    show('Sent in. You will see it under Your videos.');
    q.reload();
    setTimeout(() => router.push('/(creator)/home'), 900);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Submit a video">
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : !d.joined.length ? (
          <Card><Empty text="Join a campaign before sending in a video." action={<LinkButton title="Browse campaigns" onPress={() => router.push('/(creator)/discover')} />} /></Card>
        ) : !d.accounts.length ? (
          <Card><Empty text="Link your TikTok account first so we know the video is yours." action={<LinkButton title="Link TikTok account" onPress={() => router.push('/(creator)/profile')} />} /></Card>
        ) : (
          <Card style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <T variant="label">Campaign</T>
              <Chips value={campaign} onChange={setCampaign} options={d.joined.map((c) => ({ value: c.id, label: c.name }))} />
              {chosen ? <T variant="small">{usd(chosen.cpm_cents)} per 1K views. The video needs {short(chosen.min_views)} views on its own to start earning.</T> : null}
            </View>
            <View style={{ gap: 8 }}>
              <T variant="label">TikTok account</T>
              <Chips value={account} onChange={setAccount} options={d.accounts.map((a) => ({ value: a.id, label: '@' + a.username }))} />
            </View>
            <Field label="TikTok link" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
              placeholder="https://www.tiktok.com/@you/video/..." error={error}
              hint="In TikTok: Share → Copy link, then paste it here." />
            <Button title="Send for review" onPress={send} busy={busy} disabled={!url.trim()} />
            <T variant="small" style={{ color: colors.muted }}>The brand checks your video. Once approved, your views are counted and your earnings go up.</T>
          </Card>
        )}
      </Screen>
      {toast}
    </View>
  );
}
