import { useEffect, useId, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** The brand gradient used on the website: orange to pink. */
export const BRAND_GRADIENT = ['#FF8A3D', '#FF5A3D', '#E8307A'];

// On the website animations run in JavaScript; in the app they run on the native side.
const NATIVE = Platform.OS !== 'web';

/** Fills its parent with a diagonal colour gradient. Put it first inside a view with `overflow: 'hidden'`. */
export function Gradient({ colors = BRAND_GRADIENT, vertical }: { colors?: string[]; vertical?: boolean }) {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2="1">
          {colors.map((c, i) => <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Soft orange and pink light at the top of a screen, behind the content. */
export function Glow() {
  const id = 'w' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 460 }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id + 'a'} cx="12%" cy="0%" rx="60%" ry="70%">
            <Stop offset="0" stopColor="#FF6A3D" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FF6A3D" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id + 'b'} cx="95%" cy="10%" rx="55%" ry="70%">
            <Stop offset="0" stopColor="#E8307A" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#E8307A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}a)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
      </Svg>
    </View>
  );
}

/** Children fade in and rise a little when the screen opens. `order` staggers items below each other. */
export function Rise({ children, order = 0, style }: { children: ReactNode; order?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: Math.min(order, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, order]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Slowly sways its children in 3D, like a card held in the hand. Stays still when the phone asks for less motion. */
export function Float3D({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let stopped = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || stopped) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => { stopped = true; loop?.stop(); };
  }, [v]);
  return (
    <Animated.View style={[style, {
      transform: [
        { perspective: 900 },
        { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) },
        { rotateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['5deg', '2deg', '5deg'] }) },
        { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] }) },
      ],
    }]}>
      {children}
    </Animated.View>
  );
}
