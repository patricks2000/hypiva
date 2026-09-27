import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Icon } from '../../components/Icon';
import { Avatar, Button, Card, Empty, ErrorNote, Field, LinkButton, List, Loading, Row, Screen, T, hueFor, useToast } from '../../components/ui';
import { homeFor, useAuth } from '../../lib/auth';
import { copy, saveToPhotos } from '../../lib/content';
import { isTikTokUrl } from '../../lib/format';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Campaign, ContentPack, TikTokAccount } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

type Step = 'account' | 'content' | 'submit';

export default function PostScreen() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return null;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  if (profile.role !== 'creator') return <Redirect href={homeFor(profile.role)} />;
  return <PostFlow />;
}

function PostFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast, show } = useToast();
  const [step, setStep] = useState<Step>('account');
  const [account, setAccount] = useState<TikTokAccount | null>(null);
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [noNewContent, setNoNewContent] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const [c, a, p] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('tiktok_accounts').select('*').eq('creator_id', profile!.id).order('created_at'),
      supabase.from('content_packs').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('active', true),
    ]);
    return { c: must(c) as Campaign, accounts: must(a) as TikTokAccount[], hasContent: (p.count ?? 0) > 0 };
  });
  const d = q.data;

  const back = () => {
    if (step === 'submit') setStep(pack ? 'content' : 'account');
    else if (step === 'content') setStep('account');
    else if (router.canGoBack()) router.back();
    else router.replace('/(creator)/home');
  };

  const pickAccount = async (a: TikTokAccount) => {
    setAccount(a);
    setNoNewContent(false);
    if (!d?.hasContent) { setPack(null); setStep('submit'); return; }
    setBusy(true);
    const { data: packId, error } = await supabase.rpc('next_content', { p_campaign: id, p_account: a.id });
    if (error) { setBusy(false); return show(friendlyError(error)); }
    if (!packId) { setBusy(false); setPack(null); setNoNewContent(true); setStep('content'); return; }
    const { data, error: e2 } = await supabase.from('content_packs').select('*, content_slides(*)').eq('id', packId as string).single();
    setBusy(false);
    if (e2) return show(friendlyError(e2));
    const p = data as ContentPack;
    p.content_slides = [...(p.content_slides ?? [])].sort((x, y) => x.position - y.position);
    setPack(p);
    setStep('content');
  };

  const title = step === 'account' ? 'Select account' : step === 'content' ? 'Content' : 'Submit clip';

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" color={colors.text} />
          </Pressable>
          <T variant="h2" style={{ flex: 1 }}>{title}</T>
        </View>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : step === 'account' ? (
          <AccountStep accounts={d.accounts} busy={busy} onPick={pickAccount} />
        ) : step === 'content' ? (
          noNewContent || !pack
            ? <Card><Empty text={`@${account?.username} already posted all content for this campaign. Try another account, or check back later for new content.`}
                action={<LinkButton title="Choose another account" onPress={() => setStep('account')} />} /></Card>
            : <ContentStep pack={pack} onToast={show} onNext={() => setStep('submit')} />
        ) : account ? (
          <SubmitStep campaign={d.c} account={account} packId={pack?.id ?? null} onToast={show} />
        ) : null}
      </Screen>
      {toast}
    </View>
  );
}

function AccountStep({ accounts, busy, onPick }: { accounts: TikTokAccount[]; busy: boolean; onPick: (a: TikTokAccount) => void }) {
  return (
    <>
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 12 }}>
        <T variant="title" style={{ fontSize: 26, textAlign: 'center' }}>Choose where you will post</T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          Use no more than three TikTok accounts per phone. TikTok may otherwise limit the accounts as suspected spam.
        </T>
      </View>
      {busy ? <Loading /> : null}
      <List>
        {accounts.map((a, i) => (
          <Row key={a.id} last={false} onPress={() => onPick(a)} left={<Avatar name={a.username} color={hueFor(a.id)} />}
            title={a.username} subtitle={'@' + a.username} right={<Icon name="chevron" color={colors.muted} size={20} />} />
        ))}
        <Row last onPress={() => router.push('/(creator)/profile')} left={<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="add" color={colors.accent} /></View>}
          title="Add TikTok account" subtitle="Link an account you post from" right={<Icon name="chevron" color={colors.muted} size={20} />} />
      </List>
    </>
  );
}

function ContentStep({ pack, onToast, onNext }: { pack: ContentPack; onToast: (t: string) => void; onNext: () => void }) {
  const { width } = useWindowDimensions();
  const slides = pack.content_slides ?? [];
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const slide = slides[i];
  const w = Math.min(width, 480) - 32 - 2;

  const save = async (urls: string[]) => {
    setSaving(true);
    try {
      const n = await saveToPhotos(urls);
      onToast(n === 1 ? 'Slide saved to your photos' : `${n} slides saved to your photos`);
    } catch (e) {
      onToast(friendlyError(e));
    } finally { setSaving(false); }
  };
  const copyText = async (text: string, what: string) => { await copy(text); onToast(`${what} copied`); };

  return (
    <>
      <T variant="title" style={{ fontSize: 24 }}>Here&apos;s your slideshow</T>
      <T variant="muted">Save the slides and copy the text to post on TikTok.</T>
      {slides.length ? (
        <Card style={{ padding: 12, gap: 12 }}>
          <Image source={{ uri: slide.image_url }} style={{ width: w - 24, aspectRatio: 9 / 16, borderRadius: 14, backgroundColor: colors.surface2 }} contentFit="cover" accessibilityLabel={`Slide ${i + 1}`} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Button small kind="ghost" title="Prev" onPress={() => setI(Math.max(0, i - 1))} disabled={i === 0} />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {slides.map((s, k) => <View key={s.id} style={{ width: k === i ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? colors.accent : colors.line }} />)}
            </View>
            <Button small kind="ghost" title="Next" onPress={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} />
          </View>
          {slide.overlay_text ? (
            <Card style={{ backgroundColor: colors.surface2, gap: 8, padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <T variant="body" style={{ flex: 1 }} selectable>{slide.overlay_text}</T>
                <Button small kind="ghost" title="Copy" onPress={() => copyText(slide.overlay_text, 'Text')} />
              </View>
              <T variant="small">Add this as a text overlay in TikTok</T>
            </Card>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} kind="ghost" title="Save slide" onPress={() => save([slide.image_url])} disabled={saving} />
            <Button style={{ flex: 1 }} title="Save all" onPress={() => save(slides.map((s) => s.image_url))} busy={saving} />
          </View>
        </Card>
      ) : null}
      {pack.title ? <CopyCard label="Title" text={pack.title} hint="Paste as the TikTok title." onCopy={() => copyText(pack.title, 'Title')} /> : null}
      {pack.description ? <CopyCard label="Description" text={pack.description} hint="Paste as the description." onCopy={() => copyText(pack.description, 'Description')} /> : null}
      {pack.hashtags ? <CopyCard label="Hashtags" text={pack.hashtags} hint="Paste these hashtags with the post." onCopy={() => copyText(pack.hashtags, 'Hashtags')} /> : null}
      <Button title="I posted it: submit video" onPress={onNext} />
    </>
  );
}

function CopyCard({ label, text, hint, onCopy }: { label: string; text: string; hint: string; onCopy: () => void }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T variant="label" style={{ flex: 1 }}>{label}</T>
        <Button small kind="ghost" title="Copy" onPress={onCopy} />
      </View>
      <T variant="body" style={{ fontSize: 17 }} selectable>{text}</T>
      <T variant="small">{hint}</T>
    </Card>
  );
}

function SubmitStep({ campaign, account, packId, onToast }: { campaign: Campaign; account: TikTokAccount; packId: string | null; onToast: (t: string) => void }) {
  const { profile } = useAuth();
  const checks = [`Posted from @${account.username}`, ...campaign.requirements];
  const [ticked, setTicked] = useState<boolean[]>(checks.map(() => false));
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const all = ticked.every(Boolean);

  const send = async () => {
    setError(null);
    if (!isTikTokUrl(url)) return setError('Paste a link that starts with https://www.tiktok.com/ or https://vm.tiktok.com/');
    setBusy(true);
    const { error: e } = await supabase.from('submissions').insert({
      campaign_id: campaign.id, creator_id: profile!.id, tiktok_account_id: account.id, url: url.trim(), content_pack_id: packId,
    });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    onToast('Sent in. You will see it under Your videos.');
    setTimeout(() => router.replace('/(creator)/home'), 900);
  };

  return (
    <Card style={{ gap: 14 }}>
      <Field label="TikTok video link" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        placeholder="Paste TikTok video link" error={error}
        hint="Copy the video link from TikTok and paste it here. New posts can be under review at TikTok for a few minutes before you can share the link." />
      <T variant="bodyStrong">Before you submit</T>
      <T variant="muted">Tick every requirement your post meets:</T>
      {checks.map((c, k) => (
        <Pressable key={c} onPress={() => setTicked((t) => t.map((v, j) => (j === k ? !v : v)))} accessibilityRole="checkbox" accessibilityState={{ checked: ticked[k] }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: ticked[k] ? colors.money : colors.faint, backgroundColor: ticked[k] ? colors.money : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {ticked[k] ? <T variant="bodyStrong" style={{ color: colors.onMoney, fontSize: 13 }}>✓</T> : null}
          </View>
          <T variant="body" style={{ flex: 1 }}>{c}</T>
        </Pressable>
      ))}
      <Button title="Submit video" onPress={send} busy={busy} disabled={!all || !url.trim()} />
    </Card>
  );
}
