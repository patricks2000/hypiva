import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../lib/theme';
import { initials } from '../lib/format';
import { t } from '../lib/i18n';

/* ---------- text ---------- */
export function T({ children, style, variant = 'body', numberOfLines, selectable }: {
  children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean;
  variant?: 'title' | 'h2' | 'body' | 'bodyStrong' | 'muted' | 'small' | 'label' | 'big';
}) {
  return <Text selectable={selectable} numberOfLines={numberOfLines} style={[s[variant], style]}>{children}</Text>;
}

/* ---------- screen ---------- */
export function Screen({ title, right, children, onRefresh, refreshing = false }: {
  title?: string; right?: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120, paddingHorizontal: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined}
    >
      {title ? (
        <View style={s.header}>
          <T variant="title" style={{ flex: 1 }}>{title}</T>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Section({ title, right, children, hint }: { title: string; right?: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 10, marginTop: 16 }}>
      <View style={s.rowCenter}>
        <T variant="h2" style={{ flex: 1 }}>{title}</T>
        {right}
      </View>
      {hint ? <T variant="muted">{hint}</T> : null}
      {children}
    </View>
  );
}

/* ---------- surfaces ---------- */
export function Card({ children, style, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; highlight?: boolean }) {
  return <View style={[s.card, highlight && { borderColor: colors.accent }, style]}>{children}</View>;
}

export function Tile({ label, value, sub, color, highlight }: { label: string; value: string; sub?: string; color?: string; highlight?: boolean }) {
  return (
    <Card style={{ flex: 1, padding: 16 }} highlight={highlight}>
      <T variant="label">{label}</T>
      <T variant="big" style={color ? { color } : undefined} numberOfLines={1}>{value}</T>
      {sub ? <T variant="small">{sub}</T> : null}
    </Card>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 12 }}>{children}</View>;
}

export function List({ children }: { children: ReactNode }) {
  return <Card style={{ paddingVertical: 4 }}>{children}</Card>;
}

export function Row({ left, title, subtitle, right, onPress, last, lines = 2 }: {
  left?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; last?: boolean; lines?: number;
}) {
  const main = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="bodyStrong" numberOfLines={1}>{title}</T>
        {subtitle ? <T variant="muted" numberOfLines={lines}>{subtitle}</T> : null}
      </View>
    </>
  );
  // Only the left and middle are tappable, so buttons on the right never sit inside another button.
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      {onPress
        ? <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>{main}</Pressable>
        : main}
      {right ? <View style={{ alignItems: 'flex-end', gap: 4 }}>{right}</View> : null}
    </View>
  );
}

export function Avatar({ name, size = 40, color = colors.accent }: { name: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

/** Stable colour per person or brand. */
export const hueFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

/* ---------- controls ---------- */
type ButtonKind = 'primary' | 'ghost' | 'money' | 'danger';
export function Button({ title, onPress, kind = 'primary', disabled, busy, small, style }: {
  title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; busy?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.accent, ghost: colors.surface2, money: colors.money, danger: colors.badSoft }[kind];
  const fg = { primary: colors.onAccent, ghost: colors.text, money: colors.onMoney, danger: colors.bad }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10}>
      <Text style={{ color: colors.accent, fontFamily: fonts.bodySemi, fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

export function Chips<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[s.chip, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? colors.onAccent : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" style={{ letterSpacing: 0, textTransform: 'none', fontSize: 13 }}>{label}</T>
      <TextInput
        placeholderTextColor={colors.faint}
        {...input}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: colors.accent }, input.multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      />
      {error ? <T variant="small" style={{ color: colors.bad }}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

/* ---------- status ---------- */
const PILL = {
  approved: [colors.moneySoft, colors.money, 'Approved'],
  paid: [colors.moneySoft, colors.money, 'Paid'],
  linked: [colors.moneySoft, colors.money, 'Linked'],
  pending: [colors.warnSoft, colors.warn, 'In review'],
  requested: [colors.warnSoft, colors.warn, 'Requested'],
  rejected: [colors.badSoft, colors.bad, 'Rejected'],
  cancelled: [colors.surface2, colors.muted, 'Cancelled'],
  under: [colors.surface2, colors.muted, 'Under minimum'],
  live: [colors.accentSoft, colors.accent, 'Live'],
  paused: [colors.surface2, colors.muted, 'Paused'],
  ended: [colors.surface2, colors.muted, 'Ended'],
} as const;
export function Pill({ kind, label }: { kind: keyof typeof PILL; label?: string }) {
  const [bg, fg, text] = PILL[kind];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: 12 }}>{label ?? t(text)}</Text>
    </View>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 8, gap: 10 }}>
      <T variant="muted" style={{ textAlign: 'center' }}>{text}</T>
      {action}
    </View>
  );
}

export function Loading() {
  return <View style={{ paddingVertical: 40 }}><ActivityIndicator color={colors.muted} /></View>;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: colors.bad, gap: 8 }}>
      <T variant="bodyStrong" style={{ color: colors.bad }}>{t("Something went wrong")}</T>
      <T variant="muted">{text}</T>
      {onRetry ? <LinkButton title={t("Try again")} onPress={onRetry} /> : null}
    </Card>
  );
}

/* ---------- bottom sheet ---------- */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel={t("Close")} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grab} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
          <T variant="h2">{title}</T>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- small helpers ---------- */
export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={s.toast}>
      <Text style={{ color: colors.bg, fontFamily: fonts.bodySemi }}>{text}</Text>
    </View>
  );
}

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const show = (t: string) => { setText(t); setTimeout(() => setText(null), 2400); };
  return { toast: <Toast text={text} />, show };
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, lineHeight: 19 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: 2 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' },
  big: { fontFamily: fonts.display, fontSize: 27, color: colors.text, marginTop: 6, fontVariant: ['tabular-nums'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 13 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, padding: 12, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.line, paddingTop: 12, paddingHorizontal: 16, maxHeight: '90%' },
  grab: { width: 40, height: 4, borderRadius: 4, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
  toast: { position: 'absolute', bottom: 110, alignSelf: 'center', backgroundColor: colors.text, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
});
