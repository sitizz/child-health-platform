import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const RISK_ALERT_CHANNEL_ID = 'risk-alerts';

/**
 * Fetches the Expo push token for server-side push registration. Returns null on
 * web, in Expo Go, or without a device build — callers treat push as optional.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch (err) {
    console.warn('[notifications] Expo push token unavailable:', err);
    return null;
  }
}

/**
 * Without a handler, expo-notifications does not present notifications that
 * arrive while the app is in the foreground. Risk alerts are scheduled with
 * `trigger: null` from a 5-minute poll that only runs while the app is open, so
 * every alert would otherwise be dropped exactly when the caregiver is looking.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Android 8+ routes every notification through a channel, and a channel's
 * importance is fixed at creation. Without an explicit high-importance channel,
 * AndroidNotificationPriority.HIGH on the payload cannot produce a heads-up alert.
 */
export async function registerNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    await createRiskChannel();
  } catch (err) {
    console.warn('[notifications] channel registration failed:', err);
  }
}

async function createRiskChannel() {
  await Notifications.setNotificationChannelAsync(RISK_ALERT_CHANNEL_ID, {
    name: 'Risk Alerts',
    description: 'High-priority environmental health alerts for your child.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Returns false when the caregiver declined; callers should not treat a refusal
 * as an error, but alerts will not be delivered.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  // Permission APIs depend on the browser Notification API on web and can throw
  // in insecure or unsupported contexts. A refusal and an unsupported platform
  // are the same outcome to callers: no alerts.
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();

    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();

    return status === 'granted';
  } catch (err) {
    console.warn('[notifications] permission check unavailable:', err);
    return false;
  }
}
