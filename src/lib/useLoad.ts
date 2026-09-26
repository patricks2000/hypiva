import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from './supabase';

/** Loads data when the screen opens or comes back into view, with pull-to-refresh support. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  const reload = useCallback(async () => {
    try {
      setError(null);
      setData(await loadRef.current());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, error, reload, refresh, refreshing, loading: data === null && !error };
}

/** Throws Supabase errors so useLoad can show them. */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
