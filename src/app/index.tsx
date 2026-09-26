import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { homeFor, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  return <Redirect href={homeFor(profile.role)} />;
}
