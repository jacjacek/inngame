import React, { createContext, PropsWithChildren, useContext } from 'react';
import { Platform } from 'react-native';

const sharedTheme = {
  radius: {
    small: 12,
    medium: 18,
    large: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 30,
    xxl: 40,
  },
  font: {
    display: Platform.select({ ios: 'System', android: 'sans-serif-light', default: 'System' }),
    body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  },
} as const;

const lightColors = {
    background: '#F7F8F3',
    backgroundDeep: '#EDF2E6',
    surface: '#FFFFFF',
    surfaceElevated: '#ECEFE5',
    surfaceSoft: '#FFFFFF',
    surfaceGlass: 'rgba(255,255,252,0.94)',
    lime: '#C7E12E',
    accentText: '#647500',
    accentSoft: 'rgba(124,148,0,0.10)',
    accentBorder: 'rgba(100,117,0,0.22)',
    coral: '#D9553B',
    sky: '#247399',
    skySoft: 'rgba(36,115,153,0.09)',
    skyBorder: 'rgba(36,115,153,0.22)',
    white: '#FFFFFF',
    text: '#171914',
    secondaryText: '#5C6254',
    tertiaryText: '#666D5F',
    border: 'rgba(23,25,20,0.13)',
    divider: 'rgba(23,25,20,0.09)',
    pressed: 'rgba(23,25,20,0.07)',
    track: 'rgba(23,25,20,0.10)',
    danger: '#C24940',
    dangerSoft: 'rgba(194,73,64,0.09)',
    dangerBorder: 'rgba(194,73,64,0.24)',
    success: '#48752D',
    successSoft: 'rgba(72,117,45,0.10)',
    onAccent: '#171914',
    heroText: '#FFFFFF',
    heroSecondary: 'rgba(255,255,255,0.74)',
    scrim: 'rgba(17,20,14,0.42)',
    shadow: '#20251A',
    messageMine: '#E5EDC4',
    switchTrackOff: '#CDD1C7',
    switchThumbOff: '#F8F9F5',
    calendarEvent: '#F2F5E8',
    calendarEmpty: 'rgba(23,25,20,0.018)',
    calendarSelection: 'rgba(124,148,0,0.035)',
    chartBar: 'rgba(100,117,0,0.28)',
} as const;

type ThemeColors = { [Key in keyof typeof lightColors]: string };

const darkColors: ThemeColors = {
  background: '#11120F',
  backgroundDeep: '#07100A',
  surface: '#20211E',
  surfaceElevated: '#2A2B27',
  surfaceSoft: '#1A1B18',
  surfaceGlass: 'rgba(26,27,24,0.94)',
  lime: '#C7E12E',
  accentText: '#C7E12E',
  accentSoft: 'rgba(199,225,46,0.10)',
  accentBorder: 'rgba(199,225,46,0.22)',
  coral: '#FF6D4D',
  sky: '#57B8F2',
  skySoft: 'rgba(87,184,242,0.10)',
  skyBorder: 'rgba(87,184,242,0.22)',
  white: '#FFFFFF',
  text: '#F5F6F2',
  secondaryText: '#A8AA9F',
  tertiaryText: '#91948B',
  border: 'rgba(255,255,255,0.09)',
  divider: 'rgba(255,255,255,0.06)',
  pressed: 'rgba(255,255,255,0.07)',
  track: 'rgba(255,255,255,0.10)',
  danger: '#FF6D4D',
  dangerSoft: 'rgba(255,109,77,0.09)',
  dangerBorder: 'rgba(255,109,77,0.24)',
  success: '#98D75B',
  successSoft: 'rgba(152,215,91,0.10)',
  onAccent: '#11120F',
  heroText: '#FFFFFF',
  heroSecondary: 'rgba(255,255,255,0.74)',
  scrim: 'rgba(7,10,6,0.58)',
  shadow: '#000000',
  messageMine: 'rgba(199,225,46,0.16)',
  switchTrackOff: '#4A4D45',
  switchThumbOff: '#D7D9D2',
  calendarEvent: 'rgba(199,225,46,0.10)',
  calendarEmpty: 'rgba(255,255,255,0.018)',
  calendarSelection: 'rgba(199,225,46,0.035)',
  chartBar: 'rgba(199,225,46,0.28)',
} as const;

export const themes = {
  light: { ...sharedTheme, mode: 'light', colors: lightColors },
  dark: { ...sharedTheme, mode: 'dark', colors: darkColors },
} as const;

export type AppTheme = (typeof themes)[keyof typeof themes];
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>;

const AppThemeContext = createContext<AppTheme>(themes.light);

export function AppThemeProvider({ children, value }: PropsWithChildren<{ value: AppTheme }>) {
  return React.createElement(AppThemeContext.Provider, { value }, children);
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}

const themedStylesCache = new WeakMap<Function, WeakMap<object, unknown>>();

export function useThemeStyles<T>(factory: (activeTheme: AppTheme) => T) {
  const activeTheme = useAppTheme();
  let factoryCache = themedStylesCache.get(factory);
  if (!factoryCache) {
    factoryCache = new WeakMap();
    themedStylesCache.set(factory, factoryCache);
  }
  let styles = factoryCache.get(activeTheme) as T | undefined;
  if (!styles) {
    styles = factory(activeTheme);
    factoryCache.set(activeTheme, styles as object);
  }
  return { styles, theme: activeTheme };
}
