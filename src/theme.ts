import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#11120F',
    backgroundDeep: '#07100A',
    surface: '#20211E',
    surfaceElevated: '#292A27',
    surfaceSoft: '#181916',
    lime: '#C7E12E',
    coral: '#FF6D4D',
    sky: '#57B8F2',
    white: '#FFFFFF',
    text: '#F7F7F3',
    secondaryText: 'rgba(255,255,255,0.62)',
    tertiaryText: 'rgba(255,255,255,0.38)',
    border: 'rgba(255,255,255,0.10)',
    divider: 'rgba(255,255,255,0.07)',
    danger: '#FF6B62',
    success: '#98D75B',
    scrim: 'rgba(0,0,0,0.48)',
  },
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
  },
  font: {
    display: Platform.select({ ios: 'System', android: 'sans-serif-light', default: 'System' }),
    body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  },
} as const;
