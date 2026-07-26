import Ionicons from '@expo/vector-icons/Ionicons';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import React, { ComponentProps, forwardRef, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { theme } from '@/theme';

const MOBILE_BREAKPOINT = 768;
const MOBILE_TAB_BAR_HEIGHT = 64;
const MOBILE_TAB_BAR_GAP = 0;

const glassBackdrop = {
  backdropFilter: 'blur(24px) saturate(180%)',
} as ViewStyle & { backdropFilter: string };

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs = [
  {
    name: 'index',
    href: '/',
    label: 'Start',
    icon: 'tennisball-outline',
    activeIcon: 'tennisball',
  },
  {
    name: 'schedule',
    href: '/schedule',
    label: 'Kalendarz',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    name: 'chat',
    href: '/chat',
    label: 'Czat',
    icon: 'chatbubbles-outline',
    activeIcon: 'chatbubbles',
    badge: 2,
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'Profil',
    icon: 'person-circle-outline',
    activeIcon: 'person-circle',
  },
] as const;

type WebTabButtonProps = ComponentProps<typeof Pressable> & {
  activeIcon: IconName;
  badge?: number;
  icon: IconName;
  isFocused?: boolean;
  isMobile: boolean;
  label: string;
};

const WebTabButton = forwardRef<View, WebTabButtonProps>(function WebTabButton(
  {
    activeIcon,
    badge,
    icon,
    isFocused = false,
    isMobile,
    label,
    ...pressableProps
  },
  ref,
) {
  const focus = useSharedValue(isFocused ? 1 : 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, {
      damping: 20,
      stiffness: 260,
      mass: 0.58,
      reduceMotion: ReduceMotion.System,
    });
  }, [focus, isFocused]);

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: reduceMotion ? 1 : interpolate(focus.value, [0, 1], [0.82, 1.08]) }],
  }), [reduceMotion]);
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - focus.value,
    transform: [{ scale: reduceMotion ? 1 : interpolate(focus.value, [0, 1], [1, 0.88]) }],
  }), [reduceMotion]);
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.secondaryText, theme.colors.lime],
    ),
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scaleX: reduceMotion ? 1 : interpolate(focus.value, [0, 1], [0.55, 1]) }],
  }), [reduceMotion]);

  return (
    <Pressable
      {...pressableProps}
      ref={ref}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tab,
        isMobile ? styles.mobileTab : styles.desktopTab,
        isFocused && (isMobile ? styles.selectedMobileTab : styles.selectedDesktopTab),
        pressed && styles.pressedTab,
      ]}>
      {isMobile ? <Animated.View style={[styles.mobileTabHighlight, highlightStyle]} /> : null}
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.iconLayer, inactiveIconStyle]}>
          <Ionicons name={icon} size={22} color={theme.colors.secondaryText} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, activeIconStyle]}>
          <Ionicons name={activeIcon} size={22} color={theme.colors.lime} />
        </Animated.View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Animated.Text style={[styles.label, labelStyle, isFocused && styles.selectedLabel]}>
        {label}
      </Animated.Text>
      {!isMobile ? <Animated.View style={[styles.activeIndicator, highlightStyle]} /> : null}
    </Pressable>
  );
});

export default function WebTabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < MOBILE_BREAKPOINT;
  const mobileBarOffset = Math.max(insets.bottom, MOBILE_TAB_BAR_GAP);
  const mobileContentInset = MOBILE_TAB_BAR_HEIGHT + mobileBarOffset + 8;

  const tabBar = (
    <TabList
      style={[
        styles.tabList,
        isMobile
          ? [
              styles.mobileTabList,
              glassBackdrop,
              {
                bottom: mobileBarOffset,
                height: MOBILE_TAB_BAR_HEIGHT,
              },
            ]
          : styles.desktopTabList,
      ]}>
      {tabs.map((tab) => (
        <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
          <WebTabButton
            label={tab.label}
            icon={tab.icon}
            activeIcon={tab.activeIcon}
            badge={'badge' in tab ? tab.badge : undefined}
            isMobile={isMobile}
          />
        </TabTrigger>
      ))}
    </TabList>
  );

  return (
    <Tabs style={styles.tabs} options={{ backBehavior: 'history' }}>
      {isMobile ? null : tabBar}
      <TabSlot
        style={[
          styles.tabSlot,
          isMobile && { marginBottom: mobileContentInset },
        ]}
      />
      {isMobile ? tabBar : null}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.background,
  },
  tabSlot: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  tabList: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.border,
    zIndex: 20,
  },
  mobileTabList: {
    position: 'absolute',
    right: 0,
    left: 0,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
    backgroundColor: 'rgba(24,25,22,0.94)',
  },
  desktopTabList: {
    height: 70,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.radius.medium,
  },
  mobileTab: {
    flex: 1,
    minWidth: 0,
    borderRadius: 0,
  },
  desktopTab: {
    width: 132,
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  selectedDesktopTab: {
    backgroundColor: 'rgba(199,225,46,0.08)',
  },
  selectedMobileTab: { backgroundColor: 'transparent' },
  pressedTab: {
    opacity: 0.76,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 25,
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabHighlight: {
    position: 'absolute',
    top: 3,
    width: 42,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(199,225,46,0.1)',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  selectedLabel: {
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 3,
    width: 24,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.lime,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.coral,
    borderWidth: 2,
    borderColor: theme.colors.surfaceSoft,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
