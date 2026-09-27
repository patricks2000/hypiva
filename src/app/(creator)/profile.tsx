import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { Icon } from '../../components/Icon';
import { PostingActivity } from '../../components/parts';
import { Avatar, Button, Card, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, hueFor, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { usd } from '../../lib/format';
import { colors } from '../../lib/theme';
import { friendlyError, supabase } from '../../lib/supabase';
import { loadCreator } from '../../lib/queries';
import { useLoad } from '../../lib/useLoad';

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
    show(`@${u} linked`);
    q.reload();
  };

  const removeAccount = async (id: string, name: string) => {
    const { error: e } = await supabase.from('tiktok_accounts').delete().eq('id', id);
    if (e) return show(/foreign key/i.test(e.message) ? 'This account has videos, so it cannot be removed.' : friendlyError(e));
    show(`@${name} removed`);
    q.reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Profile" onRefresh={q.refresh} refreshing={q.refreshing}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={profile?.name || '?'} size={56} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{profile?.name || 'Add your name'}</T>
            <T variant="muted">{profile?.handle ? '@' + profile.handle : 'No username yet'}</T>
          </View>
        </Card>
        <Pressable onPress={() => router.push('/invite')} accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="h2" style={{ color: colors.accent }}>+</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">Your creator code</T>
              <T variant="muted">{d && d.balance.invites ? `${d.balance.invites} invited · ${usd(d.balance.referral_earned_cents)} earned` : 'Earn by inviting creators'}</T>
            </View>
            <Icon name="chevron" color={colors.muted} size={20} />
          </Card>
        </Pressable>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <Tiles>
              <Tile label="Quality score" value={`${quality}%`} sub="Approved of reviewed videos" />
              <Tile label="Videos" value={String(d.subs.length)} sub={`${d.balance.paid_videos} over the minimum`} />
            </Tiles>
            <Section title="Posting activity" right={<T variant="muted">{d.subs.length} posts</T>}>
              <Card><PostingActivity subs={d.subs} /></Card>
            </Section>
            <Section title="Linked TikTok accounts" right={<Button small kind="ghost" title="Add" onPress={() => { setError(null); setAdding(true); }} />}>
              <List>
                {d.accounts.length ? d.accounts.map((a, i) => (
                  <Row key={a.id} last={i === d.accounts.length - 1} left={<Avatar name={a.username} color={hueFor(a.id)} />}
                    title={'@' + a.username} subtitle={`${d.subs.filter((s) => s.tiktok_account_id === a.id).length} videos`}
                    right={<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Pill kind="linked" />
                      <Button small kind="ghost" title="Remove" onPress={() => removeAccount(a.id, a.username)} />
                    </View>} />
                )) : <Empty text="Link the TikTok accounts you post from." />}
              </List>
            </Section>
          </>
        )}
        <AccountSection onToast={show} />
      </Screen>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Link a TikTok account">
        <Field label="TikTok username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          placeholder="yourname" error={error} hint="Only link accounts you own. We check this before paying out." />
        <Button title="Link account" onPress={addAccount} disabled={!username.trim()} />
      </Sheet>
      {toast}
    </View>
  );
}
