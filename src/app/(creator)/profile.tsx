import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { Icon } from '../../components/Icon';
import { PostingActivity } from '../../components/parts';
import { Avatar, Button, Card, LinkButton, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, hueFor, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { usd } from '../../lib/format';
import { colors } from '../../lib/theme';
import { friendlyError, supabase } from '../../lib/supabase';
import { loadCreator } from '../../lib/queries';
import { useLoad } from '../../lib/useLoad';
import { t } from '../../lib/i18n';

export default function Profile() {
  const { profile } = useAuth();
  const q = useLoad(() => loadCreator(profile!.id));
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast, show } = useToast();
  const d = q.data;

  const reviewed = d?.subs.filter((s) => s.status !== 'pending') ?? [];
  const quality = reviewed.length ? Math.round((reviewed.filter((s) => s.status === 'approved').length / reviewed.length) * 100) : 100;

  const addAccount = async () => {
    setError(null);
    const u = username.trim().replace(/^@/, '');
    const { error: e } = await supabase.from('tiktok_accounts').insert({ creator_id: profile!.id, username: u });
    if (e) return setError(friendlyError(e));
    setAdding(false); setUsername('');
    show(t('@{u} linked', { u }));
    q.reload();
  };

  const removeAccount = async (id: string, name: string) => {
    const { error: e } = await supabase.from('tiktok_accounts').delete().eq('id', id);
    if (e) return show(/foreign key/i.test(e.message) ? t('This account has videos, so it cannot be removed.') : friendlyError(e));
    show(t('@{u} removed', { u: name }));
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t("Profile")} onRefresh={q.refresh} refreshing={q.refreshing}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={profile?.name || '?'} size={56} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{profile?.name || t('Add your name')}</T>
            <T variant="muted">{profile?.handle ? '@' + profile.handle : t('No username yet')}</T>
          </View>
        </Card>
        <Pressable onPress={() => router.push('/invite')} accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="h2" style={{ color: colors.accent }}>+</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">{t("Invite & earn")}</T>
              <T variant="muted">{d && d.balance.invites ? t('{n} invited · {x} earned', { n: d.balance.invites, x: usd(d.balance.referral_earned_cents) }) : t('Get a share of what your invites earn')}</T>
            </View>
            <Icon name="chevron" color={colors.muted} size={20} />
          </Card>
        </Pressable>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <Tiles>
              <Tile label={t("Approval rate")} value={`${quality}%`} sub={t('Of your checked videos')} />
              <Tile label={t("Videos")} value={String(d.subs.length)} sub={t('{n} over the minimum', { n: d.balance.paid_videos })} />
            </Tiles>
            <Section title={t("Posts per day")} right={<T variant="muted">{d.subs.length} posts</T>}>
              <Card><PostingActivity subs={d.subs} /></Card>
            </Section>
            <Section title={t("Your TikTok accounts")} right={<Button small kind="ghost" title={t("Add")} onPress={() => { setError(null); setAdding(true); }} />}>
              <List>
                {d.accounts.length ? d.accounts.map((a, i) => (
                  <Row key={a.id} last={i === d.accounts.length - 1} left={<Avatar name={a.username} color={hueFor(a.id)} />}
                    title={'@' + a.username} subtitle={t('{n} videos', { n: d.subs.filter((s) => s.tiktok_account_id === a.id).length })}
                    right={<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Pill kind="linked" />
                      <LinkButton title={t('Remove')} onPress={() => removeAccount(a.id, a.username)} />
                    </View>} />
                )) : <Empty text={t("Link the TikTok accounts you post from.")} />}
              </List>
            </Section>
          </>
        )}
        <AccountSection onToast={show} />
      </Screen>
      <Sheet visible={adding} onClose={() => setAdding(false)} title={t("Link a TikTok account")}>
        <Field label={t("TikTok username")} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          placeholder={t("yourname")} error={error} hint={t("Only link accounts you own. We check this before paying out.")} />
        <Button title={t("Link account")} onPress={addAccount} disabled={!username.trim()} />
      </Sheet>
      {toast}
    </View>
  );
}
