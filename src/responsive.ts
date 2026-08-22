import { useWindowDimensions } from 'react-native';

export const breakpoints = {
  tablet: 600,
  navigationRail: 768,
  desktop: 1024,
  sidebar: 1180,
  wide: 1440,
} as const;

export const layout = {
  readableMaxWidth: 760,
  contentMaxWidth: 1180,
  wideMaxWidth: 1320,
  sheetMaxWidth: 860,
  navigationRailWidth: 92,
  navigationSidebarWidth: 244,
} as const;

export type ResponsiveLayout = {
  contentMaxWidth: number;
  fontScale: number;
  gutter: number;
  height: number;
  isCompact: boolean;
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isWide: boolean;
  usesNavigationRail: boolean;
  width: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height, fontScale } = useWindowDimensions();
  const isPhone = width < breakpoints.tablet;
  const isCompact = width < 420;
  const isTablet = width >= breakpoints.tablet && width < breakpoints.desktop;
  const isDesktop = width >= breakpoints.desktop;
  const isWide = width >= breakpoints.wide;
  const gutter = width < 360
    ? 12
    : isPhone
      ? 16
      : isTablet
        ? 24
        : isWide
          ? 40
          : 32;

  return {
    contentMaxWidth: isWide ? layout.wideMaxWidth : layout.contentMaxWidth,
    fontScale,
    gutter,
    height,
    isCompact,
    isDesktop,
    isPhone,
    isTablet,
    isWide,
    usesNavigationRail: width >= breakpoints.navigationRail,
    width,
  };
}
