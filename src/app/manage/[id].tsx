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

type LangText = { title: string; description: string; overlays: string[] };
const emptyText = (n: number): LangText => ({ title: '', description: '', overlays: Array(n).fill('') });

/**
 * Add one post in one or more languages at once. The slides (images) and hashtags are shared;
 * title, description and slide texts are per language. "Translate" fills the other languages from the first.
 */
function AddContentSheet({ campaignId, onClose, onSaved }: { campaignId: string; onClose: () => void; onSaved: () => void }) {
  const [images, setImages] = useState<string[]>([]);
  const [link, setLink] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [langs, setLangs] = useState<string[]>(['en']);
  const [texts, setTexts] = useState<Record<string, LangText>>({ en: emptyText(0) });
  const [open, setOpen] = useState('en');
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = langs[0];

  const setText = (l: string, patch: Partial<LangText>) => setTexts((all) => ({ ...all, [l]: { ...(all[l] ?? emptyText(images.length)), ...patch } }));
  const addImages = (urls: string[]) => {
    setImages((im) => [...im, ...urls]);
    setTexts((all) => Object.fromEntries(Object.entries(all).map(([l, x]) => [l, { ...x, overlays: [...x.overlays, ...urls.map(() => '')] }])));
  };
  const removeImage = (i: number) => {
    setImages((im) => im.filter((_, j) => j !== i));
    setTexts((all) => Object.fromEntries(Object.entries(all).map(([l, x]) => [l, { ...x, overlays: x.overlays.filter((_, j) => j !== i) }])));
  };
  const toggleLang = (l: string) => {
    if (langs.includes(l)) {
      if (langs.length === 1) return;
      const next = langs.filter((x) => x !== l);
      setLangs(next);
      if (open === l) setOpen(next[0]);
    } else {
      setLangs([...langs, l]);
      setTexts((all) => (all[l] ? all : { ...all, [l]: emptyText(images.length) }));
    }
  };

  const upload = async () => {
    setError(null); setBusy(true);
    try { addImages(await pickAndUploadImages(campaignId)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const addLink = () => {
    if (!/^https?:\/\//i.test(link.trim())) return setError('Paste an image link that starts with https://');
    addImages([link.trim()]); setLink(''); setError(null);
  };

  const translate = async () => {
    const from = texts[source] ?? emptyText(images.length);
    const targets = langs.filter((l) => l !== source);
    if (!targets.length) return setError('Tick at least one more language to translate to.');
    if (!from.title.trim() && !from.overlays.some((o) => o.trim())) return setError(`Write the ${languageLabel(source)} text first.`);
    setError(null); setTranslating(true);
    const { data, error: e } = await supabase.functions.invoke('translate-content', {
      body: { source, targets, texts: [from.title, from.description, ...from.overlays] },
    });
    setTranslating(false);
    if (e) {
      const msg = await (e as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => null);
      return setError(msg ?? friendlyError(e));
    }
    const out = (data as { translations: Record<string, string[]> }).translations;
    setTexts((all) => {
      const next = { ...all };
      for (const [l, arr] of Object.entries(out)) next[l] = { title: arr[0] ?? '', description: arr[1] ?? '', overlays: arr.slice(2) };
      return next;
    });
    setOpen(targets[0]);
  };

  const save = async () => {
    setError(null);
    const missing = langs.find((l) => !(texts[l]?.title.trim()) && !images.length);
    if (missing) return setError(`Add images or a ${languageLabel(missing)} title.`);
    setBusy(true);
    for (const l of langs) {
      const x = texts[l] ?? emptyText(images.length);
      const { data, error: e } = await supabase.from('content_packs')
        .insert({ campaign_id: campaignId, title: x.title.trim(), description: x.description.trim(), hashtags: hashtags.trim(), language: l }).select('id').single();
      if (e || !data) { setBusy(false); return setError(friendlyError(e)); }
      if (images.length) {
        const { error: e2 } = await supabase.from('content_slides')
          .insert(images.map((url, i) => ({ pack_id: (data as { id: string }).id, position: i, image_url: url, overlay_text: (x.overlays[i] ?? '').trim() })));
        if (e2) { setBusy(false); return setError(friendlyError(e2)); }
      }
    }
    setBusy(false);
    onSaved();
  };

  const cur = texts[open] ?? emptyText(images.length);
  return (
    <Sheet visible onClose={onClose} title="Add content">
      <T variant="label">1. Images (the same in every language)</T>
      <Button title="Pick images" onPress={upload} busy={busy} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label="Or add an image by link" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://..." /></View>
        <Button small kind="ghost" title="Add" onPress={addLink} disabled={!link.trim()} />
      </View>
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((url, i) => (
            <View key={url + i} style={{ gap: 4, alignItems: 'center' }}>
              <Image source={{ uri: url }} style={{ width: 64, height: 114, borderRadius: 8, backgroundColor: colors.surface2 }} contentFit="cover" />
              <LinkButton title="Remove" onPress={() => removeImage(i)} />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <T variant="label">2. Languages (the first one is where you write)</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CONTENT_LANGUAGES.map((l) => {
          const on = langs.includes(l.value);
          return (
            <Pressable key={l.value} onPress={() => toggleLang(l.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accentSoft : 'transparent' }}>
              <T variant="bodyStrong" style={{ color: on ? colors.text : colors.muted, fontSize: 14 }}>{on ? '✓ ' : ''}{l.label}</T>
            </Pressable>
          );
        })}
      </View>
      {langs.length > 1 ? (
        <Button kind="ghost" title={`Translate ${languageLabel(source)} to ${langs.length - 1} other language${langs.length > 2 ? 's' : ''}`} onPress={translate} busy={translating} />
      ) : null}

      <T variant="label">3. Text</T>
      {langs.length > 1 ? <Chips value={open} onChange={setOpen} options={langs.map((l) => ({ value: l, label: languageLabel(l) }))} /> : null}
      <Field label={`TikTok title (${languageLabel(open)})`} value={cur.title} onChangeText={(v) => setText(open, { title: v })} multiline
        placeholder="5 exercises for strong abs (the last one is the best)" />
      <Field label="Description (optional)" value={cur.description} onChangeText={(v) => setText(open, { description: v })} multiline />
      {images.map((url, i) => (
        <Field key={url + i} label={`Slide ${i + 1} text overlay`} value={cur.overlays[i] ?? ''} multiline
          onChangeText={(v) => setText(open, { overlays: images.map((_, j) => (j === i ? v : cur.overlays[j] ?? '')) })} />
      ))}
      <Field label="Hashtags (all languages)" value={hashtags} onChangeText={setHashtags} autoCapitalize="none" placeholder="#training #fit #core" />
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title={langs.length > 1 ? `Save in ${langs.length} languages` : 'Save content'} onPress={save} busy={busy} />
    </Sheet>
  );
}
