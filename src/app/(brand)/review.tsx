import { Linking, View } from 'react-native';
import { Avatar, Empty, ErrorNote, List, Loading, Pill, Row, Screen, T, hueFor } from '../../components/ui';
import { day, short } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { Submission } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

/** Brands see every video in their campaigns with its views. The Hypiva team does the reviewing. */
export default function Videos() {
  const q = useLoad(async () =>
    must(await supabase.from('submissions')
      .select('id, url, status, views, created_at, creator_id, campaigns(name), tiktok_accounts(username)')
      .order('created_at', { ascending: false }).limit(200)) as unknown as Submission[]);
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Videos" onRefresh={q.refresh} refreshing={q.refreshing}>
        <T variant="muted">All videos in your campaigns. The Hypiva team checks every video before it counts. Tap a video to open it in TikTok.</T>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : (
          <List>
            {q.data.length ? q.data.map((s, i) => (
              <Row key={s.id} last={i === q.data!.length - 1}
                left={<Avatar name={s.tiktok_accounts?.username || '?'} color={hueFor(s.creator_id)} />}
                title={'@' + (s.tiktok_accounts?.username ?? '')}
                subtitle={`${s.campaigns?.name ?? ''} · ${day(s.created_at)}`}
                onPress={() => Linking.openURL(s.url)}
                right={<>
                  <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{short(s.views)} views</T>
                  <Pill kind={s.status} />
                </>} />
            )) : <Empty text="No videos yet. They show up here as soon as creators post." />}
          </List>
        )}
      </Screen>
    </View>
  );
}
