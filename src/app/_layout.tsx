import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppStoreProvider } from '@/state/app-store';
import { theme } from '@/theme';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.lime,
    background: theme.colors.background,
    card: theme.colors.background,
    border: theme.colors.border,
    text: theme.colors.text,
    notification: theme.colors.coral,
  },
};

const sheetOptions = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.75],
  sheetInitialDetentIndex: 0,
  sheetGrabberVisible: true,
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStoreProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              animation: 'default',
            }}>
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
        </ThemeProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}
