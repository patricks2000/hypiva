import { useState } from 'react';
import { View } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { Avatar, Button, Card, Chips, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Sheet, T, hueFor, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { day } from '../../lib/format';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Brand, Profile, Role } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

const ROLE_LABEL: Record<Role, string> = { creator: 'Creator', brand: 'Brand', admin: 'Admin' };

export default function People() {
  const { profile: me } = useAuth();
  const { toast, show } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Role>('all');
  const [editing, setEditing] = useState<Profile | null>(null);
  const q = useLoad(async () => {
    const [p, b] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
    ]);
    return { people: must(p) as Profile[], brands: must(b) as Brand[] };
  });
  const needle = search.trim().toLowerCase().replace(/^@/, '');
  const list = (q.data?.people ?? []).filter((p) => (filter === 'all' || p.role === filter) &&
    (!needle || `${p.name} ${p.handle ?? ''}`.toLowerCase().includes(needle)));

  return (
    <View style={{ flex: 1 }}>
      <Screen title="People" onRefresh={q.refresh} refreshing={q.refreshing}>
        <Card style={{ gap: 4, backgroundColor: colors.surface2 }}>
          <T variant="bodyStrong">{me?.is_owner ? 'You are the owner' : 'Only the owner can change roles'}</T>
          <T variant="muted">{me?.is_owner
            ? 'Everyone starts as a creator. Tap a person to make them a brand user or give them admin access. Only you can do this.'
            : 'You can see everyone, but giving or taking away access is done by the owner.'}</T>
        </Card>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name or @username" autoCapitalize="none" />
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'Everyone' }, { value: 'creator', label: 'Creators' }, { value: 'brand', label: 'Brands' }, { value: 'admin', label: 'Admins' },
        ]} />
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : (
          <List>
            {list.length ? list.map((p, i) => (
              <Row key={p.id} last={i === list.length - 1} left={<Avatar name={p.name || '?'} color={hueFor(p.id)} />}
                title={p.name || 'No name'}
                subtitle={`${p.handle ? '@' + p.handle + ' · ' : ''}joined ${day(p.created_at)}${p.role === 'brand' ? ' · ' + (q.data!.brands.find((b) => b.id === p.brand_id)?.name ?? 'no brand') : ''}`}
                onPress={me?.is_owner && p.id !== me.id ? () => setEditing(p) : undefined}
                right={p.is_owner ? <Pill kind="live" label="Owner" /> : <Pill kind={p.role === 'admin' ? 'live' : p.role === 'brand' ? 'requested' : 'linked'} label={ROLE_LABEL[p.role]} />} />
            )) : <Empty text="Nobody matches." />}
          </List>
        )}
        <AccountSection onToast={show} />
      </Screen>
      {editing && q.data ? (
        <RoleSheet person={editing} brands={q.data.brands} onClose={() => setEditing(null)}
          onSaved={(m) => { show(m); setEditing(null); q.reload(); }} />
      ) : null}
      {toast}
    </View>
  );
}

function RoleSheet({ person, brands, onClose, onSaved }: { person: Profile; brands: Brand[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [role, setRole] = useState<Role>(person.role);
  const [brand, setBrand] = useState(person.brand_id ?? brands[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('set_user_role', { p_user: person.id, p_role: role, p_brand: role === 'brand' ? brand : null });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    onSaved(`${person.name || 'User'} is now ${ROLE_LABEL[role].toLowerCase()}`);
  };
  return (
    <Sheet visible onClose={onClose} title={person.name || 'User'}>
      <T variant="muted">Choose what this person can see and do.</T>
      <Chips value={role} onChange={setRole} options={[
        { value: 'creator', label: 'Creator' }, { value: 'brand', label: 'Brand' }, { value: 'admin', label: 'Admin' },
      ]} />
      <Card style={{ backgroundColor: colors.surface2 }}>
        <T variant="muted">
          {role === 'creator' ? 'Sees only their own videos, views and money.'
            : role === 'brand' ? 'Sees and reviews videos for their brand\'s campaigns. Cannot see money owed to creators.'
            : 'Sees everything: all creators, money, videos and campaigns. Only give this to people you trust.'}
        </T>
      </Card>
      {role === 'brand' ? (
        brands.length ? <Chips value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
          : <T variant="muted" style={{ color: colors.warn }}>Add a brand under Campaigns first.</T>
      ) : null}
      {error ? <T variant="muted" style={{ color: colors.bad }}>{error}</T> : null}
      <Button title="Save" onPress={save} busy={busy} disabled={role === person.role && (role !== 'brand' || brand === person.brand_id) || (role === 'brand' && !brand)} />
    </Sheet>
  );
}
