import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const RISK_ALERT_CHANNEL_ID = 'risk-alerts';

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
 * Delivers immediately on both platforms. `trigger: null` would deliver on
 * Android's default channel and silently bypass the high-importance channel
 * above, so Android is routed through it explicitly.
 */
export function immediateTrigger(): Notifications.NotificationTriggerInput {
  return Platform.OS === 'android' ? { channelId: RISK_ALERT_CHANNEL_ID } : null;
}

export const DAILY_REMINDER_ID = 'daily-risk-reminder';
export const DAILY_REMINDER_HOUR = 7;
export const DAILY_REMINDER_MINUTE = 30;

/**
 * A locally scheduled notification is delivered by the OS without waking the JS
 * context, so it cannot contain a live risk level. It is therefore worded as a
 * prompt to open the app rather than as a risk statement — the alternative would
 * be showing a risk figure that could be hours stale.
 *
 * Rescheduled rather than duplicated: scheduling repeatedly with the same
 * identifier replaces the existing entry instead of stacking reminders.
 */
export async function scheduleDailyRiskReminder(childName?: string): Promise<boolean> {
  // Scheduling is unavailable on web and throws there. Callers treat the
  // reminder as optional, so a failure must not propagate and abort app start-up.
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: '🛡️ Daily Risk Check',
        body: childName
          ? `Check today's environmental risk for ${childName}.`
          : "Check today's environmental risk for your child.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_REMINDER_HOUR,
        minute: DAILY_REMINDER_MINUTE,
        ...(Platform.OS === 'android' ? { channelId: RISK_ALERT_CHANNEL_ID } : {}),
      },
    });

    return true;
  } catch (err) {
    console.warn('[notifications] daily reminder could not be scheduled:', err);
    return false;
  }
}

export async function cancelDailyRiskReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch {
    // Nothing to cancel on platforms without scheduling.
  }
}

export async function getScheduledCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
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
