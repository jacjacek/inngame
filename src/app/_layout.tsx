import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthGate } from '@/auth/auth-gate';
import { AuthProvider } from '@/auth/auth-provider';
import { AppStoreProvider, useAppStore } from '@/state/app-store';
import { AppThemeProvider, themes } from '@/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const detailSheetOptions = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.9, 1],
  sheetInitialDetentIndex: 0,
  sheetGrabberVisible: true,
};

const formSheetOptions = {
  ...detailSheetOptions,
  sheetAllowedDetents: [0.82, 1],
};

const compactSheetOptions = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: 'fitToContents' as const,
  sheetGrabberVisible: true,
};

export default function RootLayout() {
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

  return (
    <AppThemeProvider value={theme}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              animation: 'default',
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="booking" options={detailSheetOptions} />
            <Stack.Screen name="training/[id]" options={detailSheetOptions} />
            <Stack.Screen name="package/[id]" options={detailSheetOptions} />
            <Stack.Screen name="top-up/[id]" options={formSheetOptions} />
            <Stack.Screen name="trainers" options={detailSheetOptions} />
            <Stack.Screen name="trainer/[id]" options={detailSheetOptions} />
            <Stack.Screen name="clubs" options={detailSheetOptions} />
            <Stack.Screen name="profile-form" options={formSheetOptions} />
            <Stack.Screen name="sport-picker" options={compactSheetOptions} />
            <Stack.Screen name="tennis-level" options={detailSheetOptions} />
            <Stack.Screen name="training-note" options={formSheetOptions} />
            <Stack.Screen name="availability-preferences" options={formSheetOptions} />
          </Stack>
        </AuthGate>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
