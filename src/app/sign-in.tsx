import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Chips, Field, Screen, T } from '../components/ui';
import { Logo } from '../components/Logo';
import { homeFor, useAuth } from '../lib/auth';
import { friendlyError, isConfigured, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { currentLang, t } from '../lib/i18n';
import { CONTENT_LANGUAGES } from '../lib/languages';

type Mode = 'signin' | 'signup';

/** Full link to a page of this website (for email links); undefined in the phone app. */
const webUrl = (path: string) => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + path : undefined);

export default function SignIn() {
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ code?: string; signup?: string }>();
  const [mode, setMode] = useState<Mode>(params.code || params.signup ? 'signup' : 'signin');
  const [invite, setInvite] = useState(params.code ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [postLang, setPostLang] = useState<string>(currentLang());
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
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: webUrl('/sign-in'), data: { name: name.trim(), referral_code: invite.trim().toUpperCase(), content_language: postLang } } });
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
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: webUrl('/reset-password') });
    if (e) setError(friendlyError(e)); else setInfo(t('We sent you an email to set a new password.'));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ marginTop: 40, marginBottom: 12, gap: 8 }}>
          <Logo size={38} />
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
            <View style={{ gap: 8 }}>
              <T variant="label" style={{ letterSpacing: 0, textTransform: 'none', fontSize: 13 }}>{t('Which language do you post in?')}</T>
              <Chips value={postLang} onChange={setPostLang} options={CONTENT_LANGUAGES.map((l) => ({ value: l.value as string, label: l.label }))} />
              <T variant="small">{t('You get ready-made posts in this language. You can change it later in your profile.')}</T>
            </View>
          ) : null}
          {mode === 'signup' ? (
            <Field label={t("Invite code (optional)")} value={invite} onChangeText={setInvite} autoCapitalize="characters" autoCorrect={false}
              placeholder="HY..." hint={t("Got a code from another creator? Enter it here.")} />
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
          New accounts start as creators. Brand and admin access is given by the Hypiva team.
        </T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
