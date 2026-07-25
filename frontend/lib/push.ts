import { Platform } from 'react-native';

import { registerDevice } from './devices-api';
import { ensureNotificationPermission, getExpoPushToken } from './notifications';

/**
 * Best-effort push registration: asks permission, gets the Expo token, and
 * registers the device server-side so the backend scheduler can send alerts.
 * Silently no-ops on web / Expo Go / permission refusal.
 */
export async function registerPushDevice(): Promise<boolean> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;

    const token = await getExpoPushToken();
    if (!token) return false;

    await registerDevice(token, Platform.OS);
    return true;
  } catch (err) {
    console.warn('[push] device registration failed:', err);
    return false;
  }
}
