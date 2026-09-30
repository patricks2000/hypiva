import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Logo } from '../components/Logo';
import { Button, Card, Field, Loading, Screen, T } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { friendlyError, supabase } from '../lib/supabase';

/** Opened from the "reset your password" email: the link signs you in, here you pick a new password. */
export default function ResetPassword() {
  const { session, profile, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading) return <Screen><Loading /></Screen>;
  if (!session) return <Redirect href="/sign-in" />;

  const save = async () => {
    if (password.length < 8) return setError(t('At least 8 characters'));
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    router.replace(profile ? homeFor(profile.role) : '/');
  };

  return (
    <Screen>
      <View style={{ marginTop: 40, marginBottom: 12 }}><Logo size={34} /></View>
      <Card style={{ gap: 14 }}>
        <T variant="h2">{t('Choose a new password')}</T>
        <Field label={t('New password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword"
          placeholder={t('At least 8 characters')} error={error} onSubmitEditing={save} returnKeyType="go" />
        <Button title={t('Save password')} onPress={save} busy={busy} />
      </Card>
    </Screen>
  );
}
