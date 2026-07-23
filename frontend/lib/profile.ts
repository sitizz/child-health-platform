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
export const MAX_CHILDREN = 10;

/** The health/exposure flags shared by every child record. */
export type ChildFlags = Pick<
  ChildProfile,
  'asthma' | 'fever' | 'cough' | 'dehydration' | 'mosquito_exposure' | 'flood_exposure'
>;

export const EMPTY_CHILD_FLAGS: ChildFlags = {
  asthma: false,
  fever: false,
  cough: false,
  dehydration: false,
  mosquito_exposure: false,
  flood_exposure: false,
};

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

async function saveProfile(profile: CaregiverProfile): Promise<CaregiverProfile> {
  await AsyncStorage.setItem('caregiverProfile', JSON.stringify(profile));
  return profile;
}

function newChildId(): string {
  // Date.now() alone can collide when two children are added within the same
  // millisecond, so a random suffix keeps ids unique.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildChild(fields: { name: string; age: number } & Partial<ChildFlags>): ChildProfile {
  return {
    id: newChildId(),
    name: fields.name.trim(),
    age: fields.age,
    age_group: getAgeGroup(fields.age),
    ...EMPTY_CHILD_FLAGS,
    ...pickFlags(fields),
  };
}

function pickFlags(source: Partial<ChildFlags>): Partial<ChildFlags> {
  return {
    asthma: source.asthma,
    fever: source.fever,
    cough: source.cough,
    dehydration: source.dehydration,
    mosquito_exposure: source.mosquito_exposure,
    flood_exposure: source.flood_exposure,
  };
}

export function findChild(profile: CaregiverProfile | null, id: string): ChildProfile | null {
  return profile?.children?.find((c) => c.id === id) ?? null;
}

/**
 * Appends a child (up to MAX_CHILDREN) and selects it. Returns null if the
 * household is already full so the caller can inform the user.
 */
export async function addChild(child: ChildProfile): Promise<CaregiverProfile | null> {
  const profile = await loadProfile();

  if (!profile) return null;
  if (profile.children.length >= MAX_CHILDREN) return null;

  return saveProfile({
    ...profile,
    children: [...profile.children, child],
    selectedChildId: child.id,
  });
}

export async function updateChild(
  id: string,
  updates: { name: string; age: number } & Partial<ChildFlags>
): Promise<CaregiverProfile | null> {
  const profile = await loadProfile();

  if (!profile) return null;

  return saveProfile({
    ...profile,
    children: profile.children.map((child) =>
      child.id === id
        ? {
            ...child,
            name: updates.name.trim(),
            age: updates.age,
            age_group: getAgeGroup(updates.age),
            ...pickFlags(updates),
          }
        : child
    ),
  });
}

/**
 * Removes a child. If the removed child was selected, selection falls back to
 * the first remaining child. Refuses to remove the last child, since the app
 * requires at least one profile to function.
 */
export async function removeChild(id: string): Promise<CaregiverProfile | null> {
  const profile = await loadProfile();

  if (!profile || profile.children.length <= 1) return null;

  const remaining = profile.children.filter((child) => child.id !== id);
  const selectedChildId =
    profile.selectedChildId === id ? remaining[0].id : profile.selectedChildId;

  return saveProfile({ ...profile, children: remaining, selectedChildId });
}

export async function selectChild(id: string): Promise<CaregiverProfile | null> {
  const profile = await loadProfile();

  if (!profile || !findChild(profile, id)) return null;

  return saveProfile({ ...profile, selectedChildId: id });
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
