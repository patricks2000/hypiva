import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { T } from './ui';
import { colors } from '../lib/theme';

/** The Hypiva mark: app icon plus the "hyp" + orange "iva" wordmark. */
export function Logo({ size = 38, style }: { size?: number; style?: object }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }, style]}>
      <Image source={require('../../assets/icon.png')} style={{ width: size * 1.1, height: size * 1.1, borderRadius: size * 0.25 }} accessibilityLabel="Hypiva" />
      <T variant="title" style={{ fontSize: size, letterSpacing: -size * 0.04 }}>hyp<Text style={{ color: colors.accent }}>iva</Text></T>
    </View>
  );
}
