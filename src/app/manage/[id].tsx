import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chips, Empty, ErrorNote, Field, LinkButton, Loading, Pill, Screen, Section, Sheet, T, useToast } from '../../components/ui';
import { CONTENT_LANGUAGES, languageLabel } from '../../lib/languages';
import { homeFor, useAuth } from '../../lib/auth';
import { pickAndUploadImages } from '../../lib/content';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Campaign, ContentPack } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

/** Campaign content for admins and the brand that owns it. */
export default function ManageScreen() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return null;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  if (profile.role === 'creator') return <Redirect href={homeFor(profile.role)} />;
  return <Manage />;
}

function Manage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast, show } = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const q = useLoad(async () => {
    const [c, p, s] = await Promise.all([
      supabase.from('campaigns').select('*, brands(name)').eq('id', id).single(),
      supabase.from('content_packs').select('*, content_slides(*)').eq('campaign_id', id).order('created_at', { ascending: false }),
      supabase.from('submissions').select('content_pack_id').eq('campaign_id', id).not('content_pack_id', 'is', null),
    ]);
    const used = new Map<string, number>();
    for (const r of must(s) as { content_pack_id: string }[]) used.set(r.content_pack_id, (used.get(r.content_pack_id) ?? 0) + 1);
    const packs = (must(p) as ContentPack[]).map((x) => ({ ...x, content_slides: [...(x.content_slides ?? [])].sort((a, b) => a.position - b.position) }));
    return { c: must(c) as Campaign, packs, used };
  });
  const d = q.data;

  const toggle = async (p: ContentPack) => {
    const { error } = await supabase.from('content_packs').update({ active: !p.active }).eq('id', p.id);
    if (error) return show(friendlyError(error));
    q.reload();
  };
  const remove = async (p: ContentPack) => {
    const { error } = await supabase.from('content_packs').delete().eq('id', p.id);
    if (error) return show(friendlyError(error));
    show('Content removed');
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={q.refresh} refreshing={q.refreshing}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" hitSlop={10}>
          <T variant="bodyStrong" style={{ color: colors.accent }}>‹ Back</T>
        </Pressable>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <T variant="title" style={{ fontSize: 28 }}>{d.c.name}</T>
            <Card style={{ gap: 8 }}>
              <T variant="h2">Instructions and checklist</T>
              <T variant="muted" numberOfLines={4}>{d.c.instructions || 'No instructions yet. Tell creators how to post.'}</T>
              {d.c.requirements.map((r) => <T key={r} variant="body">• {r}</T>)}
              <Button small kind="ghost" title="Edit" onPress={() => setEditing(true)} />
            </Card>
            <Section title="Content" hint="Each creator account gets content it has not posted yet. Add enough so accounts don't run out."
              right={<Button small title="Add content" onPress={() => setAdding(true)} />}>
              {d.packs.length ? d.packs.map((p) => (
                <Card key={p.id} style={{ gap: 10, opacity: p.active ? 1 : 0.6 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {(p.content_slides ?? []).map((s) => (
                      <Image key={s.id} source={{ uri: s.image_url }} style={{ width: 64, height: 114, borderRadius: 8, backgroundColor: colors.surface2 }} contentFit="cover" />
                    ))}
                  </ScrollView>
                  <T variant="bodyStrong" numberOfLines={2}>{p.title || 'No title'}</T>
                  {p.hashtags ? <T variant="muted" numberOfLines={1}>{p.hashtags}</T> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pill kind={p.active ? 'live' : 'paused'} label={p.active ? 'Active' : 'Hidden'} />
                    <T variant="small" style={{ flex: 1 }}>{languageLabel(p.language)} · {p.content_slides?.length ?? 0} slides · posted {d.used.get(p.id) ?? 0}×</T>
                    <LinkButton title={p.active ? 'Hide' : 'Show'} onPress={() => toggle(p)} />
                    <LinkButton title="Delete" onPress={() => remove(p)} />
                  </View>
                </Card>
              )) : <Card><Empty text="No content yet. Add slides with a title and hashtags, and creators can post them straight away." /></Card>}
            </Section>
          </>
        )}
      </Screen>
      {editing && d ? <InstructionsSheet c={d.c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); show('Saved'); q.reload(); }} /> : null}
      {adding && d ? <AddContentSheet campaignId={d.c.id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); show('Content added'); q.reload(); }} /> : null}
      {toast}
    </View>
  );
}

function InstructionsSheet({ c, onClose, onSaved }: { c: Campaign; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(c.instructions || '1. Tap Start posting.\n2. Choose the TikTok account you post from.\n3. Save the slides and copy the caption.\n4. Post it on TikTok and send us the link.');
  const [reqs, setReqs] = useState((c.requirements.length ? c.requirements : ['The caption from the app is used', 'All hashtags are in the caption', 'Link sent within 30 minutes of posting']).join('\n'));
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const requirements = reqs.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 12);
    const { error: e } = await supabase.from('campaigns').update({ instructions: text.trim(), requirements }).eq('id', c.id);
    if (e) return setError(friendlyError(e));
    onSaved();
  };
  return (
    <Sheet visible onClose={onClose} title="Instructions and checklist">
      <Field label="How it works" value={text} onChangeText={setText} multiline />
      <Field label="Checklist (one per line)" value={reqs} onChangeText={setReqs} multiline
        hint="Creators tick every line before they can submit." error={error} />
      <Button title="Save" onPress={save} />
    </Sheet>
  );
}

function AddContentSheet({ campaignId, onClose, onSaved }: { campaignId: string; onClose: () => void; onSaved: () => void }) {
  const [slides, setSlides] = useState<{ url: string; text: string }[]>([]);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [language, setLanguage] = useState<string>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    setError(null); setBusy(true);
    try {
      const urls = await pickAndUploadImages(campaignId);
      setSlides((s) => [...s, ...urls.map((url) => ({ url, text: '' }))]);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const addLink = () => {
    if (!/^https?:\/\//i.test(link.trim())) return setError('Paste an image link that starts with https://');
    setSlides((s) => [...s, { url: link.trim(), text: '' }]); setLink(''); setError(null);
  };
  const save = async () => {
    setError(null);
    if (!slides.length && !title.trim()) return setError('Add at least one slide or a title.');
    setBusy(true);
    const { data, error: e } = await supabase.from('content_packs')
      .insert({ campaign_id: campaignId, title: title.trim(), description: description.trim(), hashtags: hashtags.trim(), language }).select('id').single();
    if (e || !data) { setBusy(false); return setError(friendlyError(e)); }
    if (slides.length) {
      const { error: e2 } = await supabase.from('content_slides')
        .insert(slides.map((s, i) => ({ pack_id: (data as { id: string }).id, position: i, image_url: s.url, overlay_text: s.text.trim() })));
      if (e2) { setBusy(false); return setError(friendlyError(e2)); }
    }
    setBusy(false);
    onSaved();
  };

  return (
    <Sheet visible onClose={onClose} title="Add content">
      <View style={{ gap: 8 }}>
        <T variant="label">Language of this post</T>
        <Chips value={language} onChange={setLanguage} options={CONTENT_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} />
        <T variant="small">Creators who pick this language get this post. Add the same post in more languages for foreign creators.</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} title="Pick images" onPress={upload} busy={busy} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label="Or add an image by link" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://..." /></View>
        <Button small kind="ghost" title="Add" onPress={addLink} disabled={!link.trim()} />
      </View>
      {slides.map((s, i) => (
        <Card key={s.url + i} style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
          <Image source={{ uri: s.url }} style={{ width: 54, height: 96, borderRadius: 8, backgroundColor: colors.surface2 }} contentFit="cover" />
          <View style={{ flex: 1, gap: 6 }}>
            <Field label={`Slide ${i + 1} text overlay`} value={s.text} onChangeText={(t) => setSlides((all) => all.map((x, j) => (j === i ? { ...x, text: t } : x)))} multiline />
            <LinkButton title="Remove" onPress={() => setSlides((all) => all.filter((_, j) => j !== i))} />
          </View>
        </Card>
      ))}
      <Field label="TikTok title" value={title} onChangeText={setTitle} placeholder="5 TOP-OEFENINGEN VOOR BUIKSPIEREN (de laatste is de beste)" multiline />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />
      <Field label="Hashtags" value={hashtags} onChangeText={setHashtags} autoCapitalize="none" placeholder="#training #fit #core" />
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title="Save content" onPress={save} busy={busy} />
    </Sheet>
  );
}
