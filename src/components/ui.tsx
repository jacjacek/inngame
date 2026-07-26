import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function selectionHaptic() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick).catch(() => undefined);
  } else {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

export function actionHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.screenContent, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>{content}</SafeAreaView>;
}

export function LoadingScreen() {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={theme.colors.lime} />
    </View>
  );
}

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SheetPage({ children }: PropsWithChildren) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheetPanel}>{children}</View>
    </View>
  );
}

export function withSheetPage(Component: React.ComponentType) {
  return function SheetRoute() {
    return <SheetPage><Component /></SheetPage>;
  };
}

export function ModalHeader({ title, doneLabel, onDone, trailing }: { title: string; doneLabel?: string; onDone?: () => void; trailing?: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={styles.modalHeaderSafe}>
      <View style={styles.modalHeader}>
        {doneLabel && onDone ? (
          <Pressable onPress={onDone} hitSlop={12}>
            <Text style={styles.doneText}>{doneLabel}</Text>
          </Pressable>
        ) : trailing ?? <View style={styles.headerSpacer} />}
        <Text style={styles.modalTitle}>{title}</Text>
        <IconButton icon="close" accessibilityLabel="Zamknij" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      onPress={() => {
        if (variant === 'primary') actionHaptic();
        else selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && Platform.OS === 'ios' && styles.pressed,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={variant === 'primary' ? '#12130F' : variant === 'danger' ? theme.colors.danger : theme.colors.text} /> : null}
      <Text style={[
        styles.buttonText,
        variant === 'primary' && styles.buttonTextPrimary,
        variant === 'danger' && styles.buttonTextDanger,
      ]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, accessibilityLabel }: { icon: IconName; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={10}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.iconButton, pressed && Platform.OS === 'ios' && styles.pressed]}>
      <Ionicons name={icon} size={21} color={theme.colors.text} />
    </Pressable>
  );
}

export function Pill({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={15} color={active ? '#11120F' : theme.colors.secondaryText} /> : null}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={[styles.pill, active && styles.pillActive]}>{content}</View>;
  return (
    <Pressable
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function InfoRow({
  icon,
  title,
  detail,
  onPress,
  destructive,
  flat,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
  flat?: boolean;
}) {
  const content = (
    <>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={destructive ? theme.colors.danger : theme.colors.secondaryText} /></View>
      <View style={styles.flex}>
        <Text style={[styles.infoTitle, destructive && { color: theme.colors.danger }]}>{title}</Text>
        {detail ? <Text style={styles.infoDetail}>{detail}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={theme.colors.tertiaryText} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.infoRow, flat && styles.flatListRow]}>{content}</View>;
  return (
    <Pressable
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.infoRow, flat && styles.flatListRow, pressed && Platform.OS === 'ios' && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function Divider({ inset = 54 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  flat,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  flat?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, flat && styles.flatListRow]}>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        {subtitle ? <Text style={styles.infoDetail}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          selectionHaptic();
          onValueChange(next);
        }}
        trackColor={{ false: '#43443F', true: theme.colors.lime }}
        thumbColor={Platform.OS === 'android' ? (value ? '#1A1B15' : '#D5D5D0') : undefined}
      />
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.tertiaryText}
        selectionColor={theme.colors.lime}
        style={[styles.field, props.multiline && styles.fieldMultiline]}
        {...props}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  values,
  value,
  onChange,
}: {
  values: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {values.map((item) => (
        <Pressable
          key={item.value}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => {
            selectionHaptic();
            onChange(item.value);
          }}
          style={[styles.segment, value === item.value && styles.segmentSelected]}>
          <Text style={[styles.segmentText, value === item.value && styles.segmentTextSelected]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pl-PL', options ?? { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function endTime(training: { start: string; durationMinutes: number }) {
  const end = new Date(new Date(training.start).getTime() + training.durationMinutes * 60_000);
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(end);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  screenContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 42, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  headerTitle: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  headerSubtitle: { color: theme.colors.secondaryText, fontSize: 14, marginTop: 3 },
  modalHeaderSafe: { backgroundColor: theme.colors.background },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetPanel: { height: '75%', maxHeight: '75%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: theme.colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  modalHeader: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  modalTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  doneText: { color: theme.colors.lime, fontSize: 16, fontWeight: '600' },
  headerSpacer: { width: 44 },
  card: { backgroundColor: theme.colors.surfaceSoft, borderRadius: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: '600' },
  button: { minHeight: 52, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonCompact: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12 },
  buttonPrimary: { backgroundColor: theme.colors.lime },
  buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.055)' },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: 'rgba(255,107,98,0.09)' },
  buttonText: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  buttonTextPrimary: { color: '#12130F' },
  buttonTextDanger: { color: theme.colors.danger },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pill: { minHeight: 34, paddingHorizontal: 12, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pillActive: { backgroundColor: theme.colors.lime, borderColor: theme.colors.lime },
  pillText: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#10110E' },
  infoRow: { minHeight: 62, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  infoIcon: { width: 26, alignItems: 'center' },
  infoTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '500' },
  infoDetail: { color: theme.colors.secondaryText, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider },
  toggleRow: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flatListRow: { paddingHorizontal: 2 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  field: { minHeight: 52, borderRadius: 12, paddingHorizontal: 15, color: theme.colors.text, fontSize: 16, backgroundColor: theme.colors.surfaceSoft },
  fieldMultiline: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: theme.colors.surfaceElevated },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentSelected: { backgroundColor: '#55564F' },
  segmentText: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  segmentTextSelected: { color: theme.colors.text },
});
