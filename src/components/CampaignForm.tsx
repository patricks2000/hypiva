import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Field, T } from './ui';
import { num, parseDollars, usd } from '../lib/format';
import { friendlyError, supabase } from '../lib/supabase';
import type { Brand, Campaign } from '../lib/types';

/** Create a campaign. Admins pick the brand; brand users always post for their own brand. */
export function CampaignForm({ brandId, brands, onDone }: { brandId?: string | null; brands?: Brand[]; onDone: (msg: string) => void }) {
  const [brand, setBrand] = useState(brandId ?? brands?.[0]?.id ?? '');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [kind, setKind] = useState<Campaign['kind']>('ready_to_post');
  const [cpm, setCpm] = useState('2.00');
  const [budget, setBudget] = useState('1000');
  const [minViews, setMinViews] = useState('1000');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cpmCents = parseDollars(cpm);
  const budgetCents = parseDollars(budget);
  const min = Number(minViews.replace(/\D/g, ''));

  const create = async () => {
    setError(null);
    if (!brand) return setError('Pick a brand first.');
    if (!name.trim() || !desc.trim()) return setError('Add a name and tell creators what to post.');
    if (!cpmCents) return setError('Enter what you pay per 1,000 views, for example 2.00.');
    if (!budgetCents || budgetCents < 5000) return setError('The budget has to be at least $50.');
    setBusy(true);
    const { error: e } = await supabase.from('campaigns').insert({
      brand_id: brand, name: name.trim(), description: desc.trim(), kind,
      cpm_cents: cpmCents, budget_cents: budgetCents, min_views: Number.isFinite(min) ? min : 1000,
    });
    setBusy(false);
    if (e) return setError(friendlyError(e));
    setName(''); setDesc('');
    onDone('Campaign is live');
  };

  return (
    <Card style={{ gap: 16 }}>
      {brands ? (
        <View style={{ gap: 8 }}>
          <T variant="label">Brand</T>
          {brands.length ? <Chips value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
            : <T variant="muted">Add a brand first.</T>}
        </View>
      ) : null}
      <Field label="Campaign name" value={name} onChangeText={setName} placeholder="Macro Snap: Summer Cut" />
      <Field label="What should creators post?" value={desc} onChangeText={setDesc} multiline
        placeholder="Faceless slideshows about hitting your protein goal. Show the app on the last slide." />
      <View style={{ gap: 8 }}>
        <T variant="label">Type</T>
        <Chips value={kind} onChange={setKind} options={[{ value: 'ready_to_post', label: 'Content included' }, { value: 'create_your_own', label: 'Film it yourself' }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field label="Pay per 1K views ($)" value={cpm} onChangeText={setCpm} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Budget ($)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" /></View>
      </View>
      <Field label="Minimum views per video" value={minViews} onChangeText={setMinViews} keyboardType="number-pad"
        hint="A video below this earns nothing. Views count per video, never added up." />
      {cpmCents && budgetCents ? (
        <T variant="small">{usd(budgetCents)} pays for about {num((budgetCents / cpmCents) * 1000)} views.</T>
      ) : null}
      {error ? <T variant="muted" style={{ color: '#FF5C7A' }}>{error}</T> : null}
      <Button title="Launch campaign" onPress={create} busy={busy} />
    </Card>
  );
}
