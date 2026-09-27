import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Empty, ErrorNote, Field, List, Loading, Pill, Row, Screen, Section, Sheet, T, Tile, Tiles, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { day, usd } from '../../lib/format';
import { loadCreator, weekLabel } from '../../lib/queries';
import { friendlyError, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

const MIN_PAYOUT = 1000;

export default function Wallet() {
  const { profile, refreshProfile } = useAuth();
  const q = useLoad(() => loadCreator(profile!.id));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<'paypal' | 'bank'>(profile?.payout_method ?? 'paypal');
  const [details, setDetails] = useState(profile?.payout_details ?? '');
  const { toast, show } = useToast();
  const d = q.data;
  const hasMethod = !!profile?.payout_method && !!profile?.payout_details;

  const request = async () => {
    if (!hasMethod) { setEditing(true); return; }
    setBusy(true);
    const { error } = await supabase.rpc('request_payout');
    setBusy(false);
    if (error) return show(friendlyError(error));
    show('Payout requested. You will be paid soon.');
    q.reload();
  };

  const saveMethod = async () => {
    if (!details.trim()) return;
    const { error } = await supabase.from('profiles').update({ payout_method: method, payout_details: details.trim() }).eq('id', profile!.id);
    if (error) return show(friendlyError(error));
    await refreshProfile();
    setEditing(false);
    show('Payout details saved');
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Wallet" onRefresh={q.refresh} refreshing={q.refreshing}>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!d ? (q.error ? null : <Loading />) : (
          <>
            <Card style={{ gap: 10 }}>
              <T variant="label">Available to withdraw</T>
              <T variant="title" style={{ color: colors.money, fontSize: 40 }}>{usd(d.balance.available_cents)}</T>
              <T variant="muted">
                {d.balance.available_cents < MIN_PAYOUT
                  ? `You can withdraw from ${usd(MIN_PAYOUT)}. ${usd(MIN_PAYOUT - d.balance.available_cents)} to go.`
                  : 'Request a payout and we send it to your account.'}
              </T>
              <Button title={hasMethod ? 'Request payout' : 'Add payout details'} onPress={request} busy={busy}
                disabled={hasMethod && (d.balance.available_cents < MIN_PAYOUT || d.balance.requested_cents > 0)} />
              {d.balance.requested_cents > 0 ? <T variant="small">You have a request of {usd(d.balance.requested_cents)} open.</T> : null}
            </Card>
            <Tiles>
              <Tile label="Earned" value={usd(d.balance.earned_cents)} sub={d.balance.referral_earned_cents ? `${usd(d.balance.video_earned_cents)} videos + ${usd(d.balance.referral_earned_cents)} invites` : undefined} />
              <Tile label="Paid out" value={usd(d.balance.paid_cents)} />
            </Tiles>
            <Section title="Per week" hint="What your videos earned each week, as their views grew.">
              <List>
                {(() => {
                  const weeks = [...new Set(d.weeks.map((w) => w.week_start))];
                  return weeks.length ? weeks.map((w, i) => {
                    const cents = d.weeks.filter((x) => x.week_start === w).reduce((a, x) => a + x.video_cents, 0);
                    return <Row key={w} last={i === weeks.length - 1} title={weekLabel(w)} subtitle={i === 0 && w === d.weeks[0]?.week_start ? 'Most recent week' : undefined}
                      right={<T variant="bodyStrong" style={{ color: cents > 0 ? colors.money : colors.muted }}>{usd(cents)}</T>} />;
                  }) : <Empty text="Your weekly earnings show up here once your videos pass the minimum." />;
                })()}
              </List>
            </Section>
            <Section title="Paid to" right={<Button small kind="ghost" title={hasMethod ? 'Change' : 'Add'} onPress={() => setEditing(true)} />}>
              <Card>
                {hasMethod
                  ? <T variant="body">{profile!.payout_method === 'paypal' ? 'PayPal' : 'Bank'} · {profile!.payout_details}</T>
                  : <T variant="muted">Add your PayPal email or IBAN so we can pay you.</T>}
              </Card>
            </Section>
            <Section title="History">
              <List>
                {d.payouts.length ? d.payouts.map((p, i) => (
                  <Row key={p.id} last={i === d.payouts.length - 1} title={usd(p.amount_cents)}
                    subtitle={p.status === 'paid' && p.paid_at ? `Paid ${day(p.paid_at)}` : `Requested ${day(p.requested_at)}`}
                    right={<Pill kind={p.status} />} />
                )) : <Empty text="No payouts yet." />}
              </List>
            </Section>
          </>
        )}
      </Screen>
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Payout details">
        <Chips value={method} onChange={setMethod} options={[{ value: 'paypal', label: 'PayPal' }, { value: 'bank', label: 'Bank (IBAN)' }]} />
        <Field label={method === 'paypal' ? 'PayPal email' : 'IBAN and account name'} value={details} onChangeText={setDetails}
          autoCapitalize={method === 'paypal' ? 'none' : 'characters'} keyboardType={method === 'paypal' ? 'email-address' : 'default'}
          placeholder={method === 'paypal' ? 'you@example.com' : 'NL00 BANK 0123 4567 89, A. Rivera'} />
        <Button title="Save" onPress={saveMethod} disabled={!details.trim()} />
      </Sheet>
      {toast}
    </View>
  );
}
