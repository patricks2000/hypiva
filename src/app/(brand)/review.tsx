import { View } from 'react-native';
import { ReviewList } from '../../components/ReviewList';
import { ErrorNote, Loading, Screen, T, useToast } from '../../components/ui';
import { SUB_FIELDS_WITH_CREATOR } from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import type { Submission } from '../../lib/types';
import { must, useLoad } from '../../lib/useLoad';

export default function Review() {
  const { toast, show } = useToast();
  const q = useLoad(async () =>
    must(await supabase.from('submissions').select(SUB_FIELDS_WITH_CREATOR).eq('status', 'pending').order('created_at')) as Submission[]);
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Review" onRefresh={q.refresh} refreshing={q.refreshing}>
        <T variant="muted">Approve videos that follow your brief. Only approved videos earn money.</T>
        {q.error ? <ErrorNote text={q.error} onRetry={q.reload} /> : null}
        {!q.data ? (q.error ? null : <Loading />) : <ReviewList subs={q.data} onChanged={q.reload} onToast={show} />}
      </Screen>
      {toast}
    </View>
  );
}
