import { useState } from 'react';
import { Button, Card, Field, Section, Sheet, T } from './ui';
import { useAuth } from '../lib/auth';
import { friendlyError, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

/** Name, username, sign out and delete account. Shared by every role. */
export function AccountSection({ onToast }: { onToast: (t: string) => void }) {
  const { profile, refreshProfile, signOut } = useAuth();
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
    onToast('Profile saved');
  };

  const remove = async () => {
    setBusy(true);
    const { error: e } = await supabase.rpc('delete_my_account');
    setBusy(false);
    if (e) return setError(friendlyError(e));
    await signOut();
  };

  return (
    <Section title="Account">
      <Card style={{ gap: 12 }}>
        <T variant="muted">Signed in as {profile?.name || 'you'}{profile?.handle ? ` (@${profile.handle})` : ''}</T>
        <Button kind="ghost" title="Edit name and username" onPress={() => { setName(profile?.name ?? ''); setHandle(profile?.handle ?? ''); setEditing(true); }} />
        <Button kind="ghost" title="Sign out" onPress={signOut} />
        <Button kind="danger" title="Delete account" onPress={() => { setConfirm(''); setError(null); setDeleting(true); }} />
      </Card>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Your profile">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
          hint="Lowercase letters, numbers, dots or underscores" error={error} />
        <Button title="Save" onPress={save} />
      </Sheet>

      <Sheet visible={deleting} onClose={() => setDeleting(false)} title="Delete your account?">
        <T variant="muted">This removes your account, your linked TikTok accounts and your videos. Money you have not been paid yet is lost. This cannot be undone.</T>
        <Field label='Type DELETE to confirm' value={confirm} onChangeText={setConfirm} autoCapitalize="characters" error={error} />
        <Button kind="danger" title="Delete my account" onPress={remove} busy={busy} disabled={confirm !== 'DELETE'} />
        <T variant="small" style={{ color: colors.muted }}>Owed money? Ask for a payout first.</T>
      </Sheet>
    </Section>
  );
}
