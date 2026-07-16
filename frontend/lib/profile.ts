import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { ApiError, type ChildProfile } from './api';

export type CaregiverProfile = {
  caregiver: { name: string; phone: string; location: string };
  children: ChildProfile[];
  selectedChildId: string;
  profile_completed?: boolean;
};

export const AGE_MIN = 0;
export const AGE_MAX = 18;

export function getAgeGroup(age: number): ChildProfile['age_group'] {
  if (age < 5) return 'under5';
  if (age < 12) return 'child';
  return 'adolescent';
}

/**
 * `Number('abc')` is NaN, which fails every comparison in getAgeGroup and would
 * silently classify the child as 'adolescent'. Callers must validate first.
 */
export function parseAge(raw: string): number | null {
  const age = Number(raw);

  if (!raw.trim() || !Number.isFinite(age)) return null;
  if (!Number.isInteger(age)) return null;
  if (age < AGE_MIN || age > AGE_MAX) return null;

  return age;
}

export async function loadProfile(): Promise<CaregiverProfile | null> {
  const saved = await AsyncStorage.getItem('caregiverProfile');

  if (!saved) return null;

  try {
    return JSON.parse(saved) as CaregiverProfile;
  } catch {
    return null;
  }
}

export function findSelectedChild(profile: CaregiverProfile | null): ChildProfile | null {
  if (!profile?.children?.length) return null;

  return (
    profile.children.find((child) => child.id === profile.selectedChildId) ??
    profile.children[0] ??
    null
  );
}

export async function loadSelectedChild(): Promise<ChildProfile | null> {
  return findSelectedChild(await loadProfile());
}

/**
 * Throws ApiError so screens can render one consistent error path for both
 * permission failures and request failures.
 */
export async function getCurrentCoords(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new ApiError(
      0,
      'Location permission is needed to check local environmental risk. Please enable it in Settings.'
    );
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return { lat: location.coords.latitude, lon: location.coords.longitude };
}
