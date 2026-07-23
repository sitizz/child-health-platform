import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = 'notificationLog';
const MAX_ENTRIES = 50;

export type NotificationType = 'high' | 'improved' | 'info';

export type NotificationEntry = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  childName?: string;
  at: string;
};

export async function loadNotifications(): Promise<NotificationEntry[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NotificationEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records an in-app copy of an alert at the moment it is generated (foreground or
 * background), so the caregiver dashboard has a feed even though OS-delivered
 * notifications are not otherwise queryable.
 */
export async function logNotification(entry: Omit<NotificationEntry, 'id'>): Promise<void> {
  const log = await loadNotifications();

  const next = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry },
    ...log,
  ].slice(0, MAX_ENTRIES);

  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));
}
