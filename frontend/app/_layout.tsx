import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { useColorScheme } from '@/hooks/use-color-scheme';
// Imported for its side effect: defines the background risk task. This must run
// on every launch, including headless background launches where no screen ever
// mounts, so it is anchored in the root layout rather than in a tab screen.
import '@/lib/background';
// Importing this module installs the foreground notification handler.
import { registerNotificationChannel } from '@/lib/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    registerNotificationChannel();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="consent" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="full-forecast" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="legal" />
          <Stack.Screen name="children" />
          <Stack.Screen name="child-form" />
      </Stack>
      </ErrorBoundary>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
