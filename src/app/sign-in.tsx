import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Chips, Field, Screen, T } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { friendlyError, isConfigured, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { t } from '../lib/i18n';

type Mode = 'signin' | 'signup';

export default function SignIn() {
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const [mode, setMode] = useState<Mode>(params.code ? 'signup' : 'signin');
  const [invite, setInvite] = useState(params.code ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (session && profile) return <Redirect href={homeFor(profile.role)} />;

  const submit = async () => {
    setError(null); setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('Enter a valid email address.'));
    if (password.length < 8) return setError(t('Use at least 8 characters for your password.'));
    if (mode === 'signup' && !name.trim()) return setError(t('Enter your name.'));
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim(), referral_code: invite.trim().toUpperCase() } } });
        if (e) throw e;
        if (!data.session) setInfo(t('Check your email and tap the link to confirm your account, then sign in.'));
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('Enter your email first, then tap "Forgot password".'));
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (e) setError(friendlyError(e)); else setInfo(t('We sent you an email to set a new password.'));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ marginTop: 40, marginBottom: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] }} />
            <T variant="title" style={{ fontSize: 38 }}>{t("Viewtra")}</T>
          </View>
          <T variant="muted" style={{ fontSize: 16 }}>{t("Post for brands. Get paid for your views.")}</T>
        </View>

        {!isConfigured ? (
          <Card style={{ borderColor: colors.warn }}>
            <T variant="bodyStrong" style={{ color: colors.warn }}>{t("Not connected yet")}</T>
            <T variant="muted">{t("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the .env file. See SETUP.md.")}</T>
          </Card>
        ) : null}

        <Card style={{ gap: 14 }}>
          <Chips<Mode> value={mode} onChange={(m) => { setMode(m); setError(null); setInfo(null); }}
            options={[{ value: 'signin', label: t('Sign in') }, { value: 'signup', label: t('Create account') }]} />
          {mode === 'signup' ? (
            <Field label={t("Your name")} value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder={t("Alex Rivera")} />
          ) : null}
          {mode === 'signup' ? (
            <Field label={t("Invite code (optional)")} value={invite} onChangeText={setInvite} autoCapitalize="characters" autoCorrect={false}
              placeholder="VT..." hint={t("Got a code from another creator? Enter it here.")} />
          ) : null}
          <Field label={t("Email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
          <Field label={t("Password")} value={password} onChangeText={setPassword} secureTextEntry
            textContentType={mode === 'signup' ? 'newPassword' : 'password'} placeholder={t("At least 8 characters")}
            onSubmitEditing={submit} returnKeyType="go" />
          {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
          {info ? <T variant="muted" style={{ color: colors.money }}>{info}</T> : null}
          <Button title={mode === 'signin' ? t('Sign in') : t('Create account')} onPress={submit} busy={busy} />
          {mode === 'signin' ? <Button title={t("Forgot password")} kind="ghost" onPress={resetPassword} /> : null}
        </Card>
        <T variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
          New accounts start as creators. Brand and admin access is given by the Viewtra team.
        </T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
