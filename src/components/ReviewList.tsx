import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Empty, Field, List, Row, Sheet, T, hueFor, Avatar } from './ui';
import { day } from '../lib/format';
import { friendlyError, supabase } from '../lib/supabase';
import type { Submission } from '../lib/types';

/** Pending videos with approve / reject. Used by brands and admins. */
export function ReviewList({ subs, onChanged, onToast }: { subs: Submission[]; onChanged: () => void; onToast: (t: string) => void }) {
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');

  const set = async (s: Submission, status: 'approved' | 'rejected', why?: string) => {
    const { error } = await supabase.from('submissions').update({ status, reject_reason: why ?? null }).eq('id', s.id);
    if (error) return onToast(friendlyError(error));
    onToast(status === 'approved' ? 'Approved' : 'Rejected');
    setRejecting(null); setReason('');
    onChanged();
  };

  return (
    <>
      <List>
        {subs.length ? subs.map((s, i) => (
          <Row key={s.id} last={i === subs.length - 1}
            left={<Avatar name={s.profiles?.name || s.tiktok_accounts?.username || '?'} color={hueFor(s.creator_id)} />}
            title={'@' + (s.tiktok_accounts?.username ?? '')}
            lines={3}
            subtitle={`${s.campaigns?.name ?? ''} · ${day(s.created_at)}\n${s.tiktok_accounts?.verified ? '✓ Account verified' : '⚠ Account not verified yet: check the video is really theirs'}`}
            onPress={() => Linking.openURL(s.url)}
            right={<View style={{ flexDirection: 'row', gap: 6 }}>
              <Button small kind="danger" title="Reject" onPress={() => { setReason(''); setRejecting(s); }} />
              <Button small kind="money" title="Approve" onPress={() => set(s, 'approved')} />
            </View>} />
        )) : <Empty text="All caught up. New videos show up here." />}
      </List>
      {subs.length ? <T variant="small">Tap a video to open it in TikTok.</T> : null}
      <Sheet visible={!!rejecting} onClose={() => setRejecting(null)} title="Reject this video?">
        <Field label="Reason (the creator sees this)" value={reason} onChangeText={setReason} placeholder="App is not shown in the video" />
        <Button kind="danger" title="Reject video" onPress={() => rejecting && set(rejecting, 'rejected', reason.trim() || undefined)} />
      </Sheet>
    </>
  );
}
