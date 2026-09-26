import Svg, { Circle, Path, Rect } from 'react-native-svg';

const paths = {
  home: <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  discover: <><Circle cx="11" cy="11" r="7" /><Path d="M21 21l-4.3-4.3" /></>,
  plus: <><Circle cx="12" cy="12" r="10" /><Path d="M12 8v8M8 12h8" /></>,
  wallet: <><Rect x="3" y="6" width="18" height="14" rx="3" /><Path d="M3 10h18M16 15h2" /></>,
  profile: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  campaigns: <><Rect x="3" y="4" width="18" height="16" rx="3" /><Path d="M3 9h18" /></>,
  review: <Path d="M4 12l5 5L20 6" />,
  overview: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  videos: <><Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" /></>,
  people: <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><Path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5" /></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}
