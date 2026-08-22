import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { ComponentProps, PropsWithChildren, ReactNode, useEffect, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { MotionPressable } from '@/components/motion';
import { layout, useResponsiveLayout } from '@/responsive';
import { AppTheme, useThemeStyles } from '@/theme';

function useStyles() {
  return useThemeStyles(createStyles);
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

const subscribeToClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export function useClientReady() {
  return useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
}

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
  testID,
  maxWidth = 'content',
}: PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  maxWidth?: 'content' | 'readable' | 'wide';
}>) {
  const { styles } = useStyles();
  const responsive = useResponsiveLayout();
  const resolvedMaxWidth = maxWidth === 'readable'
    ? layout.readableMaxWidth
    : maxWidth === 'wide'
      ? layout.wideMaxWidth
      : responsive.contentMaxWidth;
  const responsiveContentStyle = { width: '100%' as const, maxWidth: resolvedMaxWidth, alignSelf: 'center' as const, paddingHorizontal: responsive.gutter };
  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.screenContent, responsiveContentStyle, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.staticScreenContent, responsiveContentStyle, contentStyle]}>{children}</View>
  );
  return <SafeAreaView testID={testID} style={styles.screen} edges={['top', 'left', 'right']}>{content}</SafeAreaView>;
}

export function LoadingScreen() {
  const { styles, theme } = useStyles();
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={theme.colors.accentText} />
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
  const { styles } = useStyles();
  const { isDesktop, isPhone } = useResponsiveLayout();
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text numberOfLines={2} style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop, isPhone && styles.headerTitlePhone]}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export type SheetSize = 'compact' | 'form' | 'detail';

export function SheetPage({ children, size = 'detail' }: PropsWithChildren<{ size?: SheetSize }>) {
  const { styles } = useStyles();
  const responsive = useResponsiveLayout();
  const clientReady = useClientReady();
  const entrance = useSharedValue(Platform.OS === 'web' ? 0 : 1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    entrance.value = withSpring(1, {
      damping: 22,
      stiffness: 230,
      mass: 0.72,
      overshootClamping: false,
      reduceMotion: ReduceMotion.System,
    });
  }, [entrance]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : entrance.value,
  }), [reduceMotion]);
  const panelStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : interpolate(entrance.value, [0, 0.35, 1], [0.45, 0.9, 1]),
    transform: [{ translateY: reduceMotion ? 0 : interpolate(entrance.value, [0, 1], [72, 0]) }],
  }), [reduceMotion]);

  if (Platform.OS !== 'web') return <>{children}</>;
  if (!clientReady) return <LoadingScreen />;

  const compactSheet = responsive.isPhone;
  const sizeMaxHeight = size === 'compact' ? 560 : size === 'form' ? 740 : 920;
  const panelWidth = compactSheet
    ? responsive.width
    : Math.min(responsive.width - responsive.gutter * 2, layout.sheetMaxWidth);
  const panelHeight = compactSheet
    ? Math.min(responsive.height * (size === 'compact' ? 0.88 : 0.94), sizeMaxHeight)
    : Math.min(responsive.height - responsive.gutter * 2, sizeMaxHeight);

  return (
    <View style={[styles.sheetBackdrop, compactSheet && styles.sheetBackdropCompact]}>
      <Animated.View pointerEvents="none" style={[styles.sheetBackdropTint, backdropStyle]} />
      <Animated.View style={[styles.sheetPanel, { width: panelWidth, height: panelHeight, maxHeight: panelHeight }, compactSheet && styles.sheetPanelCompact, panelStyle]}>{children}</Animated.View>
    </View>
  );
}

export function withSheetPage(Component: React.ComponentType, size: SheetSize = 'detail') {
  return function SheetRoute() {
    return <SheetPage size={size}><Component /></SheetPage>;
  };
}

export function ModalHeader({ title, doneLabel, onDone, trailing }: { title: string; doneLabel?: string; onDone?: () => void; trailing?: ReactNode }) {
  const { styles } = useStyles();
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={styles.modalHeaderSafe}>
      <View style={styles.modalHeader}>
        {doneLabel && onDone ? (
          <MotionPressable onPress={onDone} hitSlop={12} pressedScale={0.96}>
            <Text style={styles.doneText}>{doneLabel}</Text>
          </MotionPressable>
        ) : trailing ?? <View style={styles.headerSpacer} />}
        <Text style={styles.modalTitle}>{title}</Text>
        <IconButton icon="close" accessibilityLabel="Zamknij" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { styles } = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const { styles } = useStyles();
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
  const { styles, theme } = useStyles();
  return (
    <MotionPressable
      accessibilityRole="button"
      disabled={disabled}
      android_ripple={{ color: theme.colors.pressed }}
      pressedScale={0.985}
      onPress={() => {
        if (variant === 'primary') actionHaptic();
        else selectionHaptic();
        onPress();
      }}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.disabled,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={variant === 'primary' ? theme.colors.onAccent : variant === 'danger' ? theme.colors.danger : theme.colors.text} /> : null}
      <Text style={[
        styles.buttonText,
        variant === 'primary' && styles.buttonTextPrimary,
        variant === 'danger' && styles.buttonTextDanger,
      ]}>{title}</Text>
    </MotionPressable>
  );
}

export function IconButton({ icon, onPress, accessibilityLabel }: { icon: IconName; onPress: () => void; accessibilityLabel: string }) {
  const { styles, theme } = useStyles();
  return (
    <MotionPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={10}
      android_ripple={{ color: theme.colors.pressed, borderless: true }}
      pressedScale={0.92}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={styles.iconButton}>
      <Ionicons name={icon} size={21} color={theme.colors.text} />
    </MotionPressable>
  );
}

export function Pill({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const { styles, theme } = useStyles();
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={15} color={active ? theme.colors.onAccent : theme.colors.secondaryText} /> : null}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={[styles.pill, active && styles.pillActive]}>{content}</View>;
  return (
    <MotionPressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      pressedScale={0.96}
      style={[styles.pill, active && styles.pillActive]}>
      {content}
    </MotionPressable>
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
  const { styles, theme } = useStyles();
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
    <MotionPressable
      android_ripple={{ color: theme.colors.pressed }}
      pressedScale={0.99}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[styles.infoRow, flat && styles.flatListRow]}>
      {content}
    </MotionPressable>
  );
}

export function Divider({ inset = 54 }: { inset?: number }) {
  const { styles } = useStyles();
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
  const { styles, theme } = useStyles();
  return (
    <View style={[styles.toggleRow, flat && styles.flatListRow]}>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        {subtitle ? <Text style={styles.infoDetail}>{subtitle}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={(next) => {
          selectionHaptic();
          onValueChange(next);
        }}
        trackColor={{ false: theme.colors.switchTrackOff, true: theme.colors.lime }}
        thumbColor={Platform.OS === 'android' ? (value ? theme.colors.onAccent : theme.colors.switchThumbOff) : undefined}
      />
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { styles, theme } = useStyles();
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
  const { styles } = useStyles();
  return (
    <View style={styles.segmented}>
      {values.map((item) => (
        <MotionPressable
          key={item.value}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => {
            selectionHaptic();
            onChange(item.value);
          }}
          pressedScale={0.97}
          style={[styles.segment, value === item.value && styles.segmentSelected]}>
          <Text style={[styles.segmentText, value === item.value && styles.segmentTextSelected]}>{item.label}</Text>
        </MotionPressable>
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

const createStyles = (theme: AppTheme) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  screenContent: { paddingTop: 12, paddingBottom: 42, gap: 14 },
  staticScreenContent: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  headerTitle: { color: theme.colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
  headerTitleDesktop: { fontSize: 38, letterSpacing: -1 },
  headerTitlePhone: { fontSize: 30 },
  headerSubtitle: { color: theme.colors.secondaryText, fontSize: 14, marginTop: 3 },
  modalHeaderSafe: { backgroundColor: theme.colors.background },
  sheetBackdrop: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  sheetBackdropCompact: { justifyContent: 'flex-end' },
  sheetBackdropTint: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.scrim },
  sheetPanel: { overflow: 'hidden', borderRadius: 24, backgroundColor: theme.colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, shadowColor: theme.colors.shadow, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  sheetPanelCompact: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  modalHeader: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  modalTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  doneText: { color: theme.colors.accentText, fontSize: 16, fontWeight: '600' },
  headerSpacer: { width: 44 },
  card: { backgroundColor: theme.colors.surfaceSoft, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, overflow: 'hidden' },
  sectionHeader: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2, marginTop: 8 },
  sectionTitle: { flexShrink: 1, color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  button: { minHeight: 52, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonCompact: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12 },
  buttonPrimary: { backgroundColor: theme.colors.lime },
  buttonSecondary: { backgroundColor: theme.colors.surfaceElevated },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: theme.colors.dangerSoft },
  buttonText: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  buttonTextPrimary: { color: theme.colors.onAccent },
  buttonTextDanger: { color: theme.colors.danger },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pill: { minHeight: 40, paddingHorizontal: 12, borderRadius: theme.radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pillActive: { backgroundColor: theme.colors.lime, borderColor: theme.colors.lime },
  pillText: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: theme.colors.onAccent },
  infoRow: { minHeight: 62, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  infoIcon: { width: 26, alignItems: 'center' },
  infoTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '500' },
  infoDetail: { color: theme.colors.secondaryText, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider },
  toggleRow: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flatListRow: { paddingHorizontal: 2 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  field: { minHeight: 52, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, paddingHorizontal: 15, color: theme.colors.text, fontSize: 16, backgroundColor: theme.colors.surface },
  fieldMultiline: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: theme.colors.surfaceElevated },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentSelected: { backgroundColor: theme.colors.surface },
  segmentText: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  segmentTextSelected: { color: theme.colors.text },
});
