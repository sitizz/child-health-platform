import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { ApiError, fetchEnvironmentRisk, type EnvironmentRisk, type RiskLevel } from './api';
import { appendRiskHistory } from './history';
import { immediateTrigger } from './notifications';
import { logNotification } from './notifications-log';
import { loadSelectedChild } from './profile';

const PREV_RISK_KEY = 'prevRiskLevel';
const LAST_COORDS_KEY = 'lastKnownCoords';
const LAST_RESULT_KEY = 'lastRiskResult';

export type RiskCheckOutcome = {
  data: EnvironmentRisk | null;
  error: string | null;
  stale: boolean;
  updatedAt: string | null;
};

type Coords = { lat: number; lon: number };

async function cacheCoords(coords: Coords) {
  await AsyncStorage.setItem(LAST_COORDS_KEY, JSON.stringify(coords));
}

async function readCachedCoords(): Promise<Coords | null> {
  const raw = await AsyncStorage.getItem(LAST_COORDS_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lon) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Foreground may prompt and wait for a fresh fix. Background must not: a prompt
 * is impossible with no UI, and `getCurrentPositionAsync` can hang or fail
 * without background-location permission, which this app deliberately does not
 * request (it triggers Play Store review and is unnecessary here). Background
 * therefore uses the OS's last known fix, falling back to coords cached during
 * foreground use.
 */
async function resolveCoords(background: boolean): Promise<Coords> {
  const { status } = background
    ? await Location.getForegroundPermissionsAsync()
    : await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new ApiError(
      0,
      'Location permission is needed to check local environmental risk. Please enable it in Settings.'
    );
  }

  if (background) {
    const last = await Location.getLastKnownPositionAsync();

    if (last) {
      return { lat: last.coords.latitude, lon: last.coords.longitude };
    }

    const cached = await readCachedCoords();

    if (cached) return cached;

    throw new ApiError(0, 'No known location available for a background risk check.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const coords = { lat: position.coords.latitude, lon: position.coords.longitude };

  await cacheCoords(coords);

  return coords;
}

/**
 * Persisted rather than held in memory: transition alerts must survive the app
 * being closed, and the background task runs in a fresh JS context with no
 * component state at all.
 */
async function readPrevRisk(): Promise<string | null> {
  return AsyncStorage.getItem(PREV_RISK_KEY);
}

/**
 * Delivery is best-effort and must never invalidate a successful risk fetch:
 * scheduleNotificationAsync throws outright on web, and on native it can fail if
 * permission was revoked mid-session. Either way the risk data is still valid
 * and must still reach the screen.
 */
async function notifyOnTransition(
  prev: string | null,
  next: RiskLevel,
  action: string,
  childName: string
) {
  try {
    await deliverTransitionNotification(prev, next, action, childName);
  } catch (err) {
    console.warn('[risk-check] notification delivery failed (data unaffected):', err);
  }
}

async function deliverTransitionNotification(
  prev: string | null,
  next: RiskLevel,
  action: string,
  childName: string
) {
  if (next === 'high' && prev !== 'high') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 High Risk Alert',
        body: action,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: immediateTrigger(),
    });

    await logNotification({ type: 'high', title: 'High Risk Alert', body: action, childName, at: new Date().toISOString() });
  }

  if (prev === 'high' && next !== 'high') {
    const body = 'Risk levels have improved. Conditions are safer now.';

    await Notifications.scheduleNotificationAsync({
      content: { title: '✅ Risk Improved', body, sound: true },
      trigger: immediateTrigger(),
    });

    await logNotification({ type: 'improved', title: 'Risk Improved', body, childName, at: new Date().toISOString() });
  }
}

/**
 * The single risk-check path, shared by the home screen and the background task,
 * so alert rules cannot drift between them.
 */
export async function runRiskCheck(
  { background = false }: { background?: boolean } = {}
): Promise<RiskCheckOutcome> {
  try {
    const child = await loadSelectedChild();

    if (!child) {
      return {
        data: null,
        error: 'Please complete the child profile first.',
        stale: false,
        updatedAt: null,
      };
    }

    const { lat, lon } = await resolveCoords(background);
    const data = await fetchEnvironmentRisk(child, lat, lon);

    const prev = await readPrevRisk();

    await notifyOnTransition(prev, data.priority_alert, data.action, child.name);
    await AsyncStorage.setItem(PREV_RISK_KEY, data.priority_alert);

    // Change-based history for the caregiver dashboard timeline.
    await appendRiskHistory({
      childId: child.id,
      childName: child.name,
      level: data.priority_alert,
      temperature: data.environment?.temperature ?? null,
      aqi: data.environment?.aqi ?? null,
      at: new Date().toISOString(),
    });

    const updatedAt = new Date().toISOString();

    await AsyncStorage.setItem(
      LAST_RESULT_KEY,
      JSON.stringify({ data, cachedAt: updatedAt })
    );

    return { data, error: null, stale: false, updatedAt };
  } catch (err) {
    console.error('Risk check failed:', err);

    const message =
      err instanceof ApiError ? err.message : 'Unable to check risk right now. Please try again.';

    const cached = await AsyncStorage.getItem(LAST_RESULT_KEY);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);

        if (parsed?.data) {
          return {
            data: parsed.data,
            error: message,
            stale: true,
            updatedAt: parsed.cachedAt ?? null,
          };
        }
      } catch {
        // Corrupt cache is not worth surfacing over the live error.
      }
    }

    return { data: null, error: message, stale: false, updatedAt: null };
  }
}
