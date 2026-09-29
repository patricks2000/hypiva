import { useState } from 'react';
import { Button, Card, Chips, Field, Section, Sheet, T } from './ui';
import { useAuth } from '../lib/auth';
import { friendlyError, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { LANGS, t, useLanguage } from '../lib/i18n';
import { CONTENT_LANGUAGES } from '../lib/languages';

/** Name, username, sign out and delete account. Shared by every role. */
export function AccountSection({ onToast }: { onToast: (t: string) => void }) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    const h = handle.trim().replace(/^@/, '').toLowerCase();
    const { error: e } = await supabase.from('profiles').update({ name: name.trim(), handle: h || null }).eq('id', profile!.id);
    if (e) return setError(friendlyError(e));
    await refreshProfile();
    setEditing(false);
    onToast(t('Profile saved'));
  };

  const setPostLang = async (l: string) => {
    const { error: e } = await supabase.from('profiles').update({ content_language: l }).eq('id', profile!.id);
    if (e) return onToast(friendlyError(e));
    await refreshProfile();
    onToast(t('Language saved'));
  };

  const remove = async () => {
    setBusy(true);
    const { error: e } = await supabase.rpc('delete_my_account');
    setBusy(false);
    if (e) return setError(friendlyError(e));
    await signOut();
  };

  return (
    <Section title={t("Account")}>
      <Card style={{ gap: 12 }}>
        <T variant="muted">{t('Signed in as {name}', { name: (profile?.name || '') + (profile?.handle ? ` (@${profile.handle})` : '') })}</T>
        <T variant="label">{t('Language')}</T>
        <Chips value={lang} onChange={setLang} options={LANGS} />
        {profile?.role === 'creator' ? (
          <>
            <T variant="label">{t('Language you post in')}</T>
            <Chips value={profile.content_language ?? lang} onChange={setPostLang}
              options={CONTENT_LANGUAGES.map((l) => ({ value: l.value as string, label: l.label }))} />
            <T variant="small">{t('You get ready-made posts in this language.')}</T>
          </>
        ) : null}
        <Button kind="ghost" title={t("Edit name and username")} onPress={() => { setName(profile?.name ?? ''); setHandle(profile?.handle ?? ''); setEditing(true); }} />
        <Button kind="ghost" title={t("Sign out")} onPress={signOut} />
        <Button kind="danger" title={t("Delete account")} onPress={() => { setConfirm(''); setError(null); setDeleting(true); }} />
      </Card>

      <Sheet visible={editing} onClose={() => setEditing(false)} title={t("Your profile")}>
        <Field label={t("Name")} value={name} onChangeText={setName} />
        <Field label={t("Username")} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
          hint={t("Lowercase letters, numbers, dots or underscores")} error={error} />
        <Button title={t("Save")} onPress={save} />
      </Sheet>

      <Sheet visible={deleting} onClose={() => setDeleting(false)} title={t("Delete your account?")}>
        <T variant="muted">{t("This removes your account, your linked TikTok accounts and your videos. Money you have not been paid yet is lost. This cannot be undone.")}</T>
        <Field label={t('Type DELETE to confirm')} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" error={error} />
        <Button kind="danger" title={t("Delete my account")} onPress={remove} busy={busy} disabled={confirm !== 'DELETE'} />
        <T variant="small" style={{ color: colors.muted }}>{t("Owed money? Ask for a payout first.")}</T>
      </Sheet>
    </Section>
  );
}
