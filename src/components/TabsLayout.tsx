import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { homeFor, useAuth } from '../lib/auth';
import { colors, fonts } from '../lib/theme';
import type { Role } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { t as tr } from '../lib/i18n';

/** Bottom tabs for one role. Anyone with another role is sent to their own home. */
export function RoleTabs({ role, tabs }: { role: Role; tabs: { name: string; title: string; icon: IconName }[] }) {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return null;
  if (profile.role !== role) return <Redirect href={homeFor(profile.role)} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, boxShadow: '0 -14px 32px -14px rgba(0,0,0,0.7)', ...(Platform.OS === 'web' ? { height: 62 } : null) },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: tr(t.title), tabBarIcon: ({ color }) => <Icon name={t.icon} color={String(color)} /> }} />
      ))}
    </Tabs>
  );
}
