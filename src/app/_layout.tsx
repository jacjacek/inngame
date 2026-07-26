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
            <Stack.Screen name="booking" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="training/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75],
                sheetInitialDetentIndex: 0,
                sheetGrabberVisible: true,
              }}
            />
            <Stack.Screen
              name="package/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.75],
                sheetInitialDetentIndex: 0,
                sheetGrabberVisible: true,
              }}
            />
            <Stack.Screen name="top-up/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="trainers" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="trainer/[id]" />
            <Stack.Screen name="clubs" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="profile-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="sport-picker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="tennis-level" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="training-note" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </ThemeProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}
