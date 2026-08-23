import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthGate } from '@/auth/auth-gate';
import { AuthProvider } from '@/auth/auth-provider';
import { AppStoreProvider, useAppStore } from '@/state/app-store';
import { AppThemeProvider, themes } from '@/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const sheetOptions = {
  presentation: 'transparentModal' as const,
  animation: 'fade' as const,
  contentStyle: { backgroundColor: 'transparent' },
};

export default function WebRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppStoreProvider>
          <ThemedNavigation />
        </AppStoreProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigation() {
  const store = useAppStore();
  const systemScheme = useColorScheme();
  const resolvedMode = store.themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : store.themeMode;
  const theme = themes[resolvedMode];
  const navigationTheme = useMemo(() => {
    const base = resolvedMode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.lime,
        background: theme.colors.background,
        card: theme.colors.background,
        border: theme.colors.border,
        text: theme.colors.text,
        notification: theme.colors.coral,
      },
    };
  }, [resolvedMode, theme]);

  useEffect(() => {
    document.documentElement.style.backgroundColor = theme.colors.background;
    document.body.style.backgroundColor = theme.colors.background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.background);
  }, [theme]);

  return (
    <AppThemeProvider value={theme}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'default' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="booking" options={sheetOptions} />
            <Stack.Screen name="training/[id]" options={sheetOptions} />
            <Stack.Screen name="package/[id]" options={sheetOptions} />
            <Stack.Screen name="top-up/[id]" options={sheetOptions} />
            <Stack.Screen name="trainers" options={sheetOptions} />
            <Stack.Screen name="trainer/[id]" options={sheetOptions} />
            <Stack.Screen name="clubs" options={sheetOptions} />
            <Stack.Screen name="profile-form" options={sheetOptions} />
            <Stack.Screen name="sport-picker" options={sheetOptions} />
            <Stack.Screen name="tennis-level" options={sheetOptions} />
            <Stack.Screen name="training-note" options={sheetOptions} />
            <Stack.Screen name="availability-preferences" options={sheetOptions} />
          </Stack>
        </AuthGate>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
