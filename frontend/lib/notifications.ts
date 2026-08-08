import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { RiskLevel } from './api';

export const RISK_ALERT_CHANNEL_ID = 'risk-alerts';
const PREV_RISK_KEY = 'prevRiskLevel';

export const DAILY_REMINDER_ID = 'daily-risk-reminder';
export const DAILY_REMINDER_HOUR = 7;
export const DAILY_REMINDER_MINUTE = 30;

/**
 * Presents notifications while the app is in the foreground — without this,
 * locally-scheduled risk alerts fired during a risk check would be dropped
 * exactly when the caregiver is looking at the app.
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
 * AndroidNotificationPriority.HIGH cannot produce a heads-up alert.
 */
export async function registerNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(RISK_ALERT_CHANNEL_ID, {
      name: 'Risk Alerts',
      description: 'Environmental health alerts for your child.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (err) {
    console.warn('[notifications] channel registration failed:', err);
  }
}

/** Returns false when the caregiver declined or the platform can't notify. */
export async function ensureNotificationPermission(): Promise<boolean> {
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

/**
 * Delivers immediately. `trigger: null` would use Android's default channel and
 * bypass the high-importance channel above, so Android is routed through it.
 */
function immediateTrigger(): Notifications.NotificationTriggerInput {
  return Platform.OS === 'android' ? { channelId: RISK_ALERT_CHANNEL_ID } : null;
}

/**
 * Local, offline daily reminder to open the app and check risk. Delivered by the
 * OS without any server. Re-scheduling with the same identifier replaces the
 * existing entry rather than stacking reminders.
 */
export async function scheduleDailyRiskReminder(childName?: string): Promise<boolean> {
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
    // Nothing scheduled / unsupported platform.
  }
}

/**
 * Fires a local alert when the child's risk crosses into or out of HIGH, based
 * on the previously seen level (persisted so transitions survive app restarts).
 * Entirely offline — no server push. Safe to call after every risk check.
 */
export async function maybeNotifyRiskTransition(level: RiskLevel, actionText?: string): Promise<void> {
  try {
    const prev = await AsyncStorage.getItem(PREV_RISK_KEY);

    if (level === 'high' && prev !== 'high') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 High Risk Alert',
          body: actionText || 'Environmental risk is high for your child. Reduce exposure now.',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: immediateTrigger(),
      });
    } else if (prev === 'high' && level !== 'high') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Risk Improved',
          body: 'Risk levels have improved. Conditions are safer now.',
          sound: true,
        },
        trigger: immediateTrigger(),
      });
    }

    await AsyncStorage.setItem(PREV_RISK_KEY, level);
  } catch (err) {
    console.warn('[notifications] transition alert failed (ignored):', err);
  }
}

/**
 * One-call local setup: request permission, register the channel, and schedule
 * the daily reminder. Returns whether notifications are active.
 */
export async function enableLocalNotifications(childName?: string): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  await registerNotificationChannel();
  await scheduleDailyRiskReminder(childName);
  return true;
}

/** Turns off local reminders (used from Settings). */
export async function disableLocalNotifications(): Promise<void> {
  await cancelDailyRiskReminder();
}
