import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchEnvironmentRisk, type RiskLevel } from './api';
import { getCurrentCoords, loadProfile } from './profile';

export const HOUSEHOLD_CACHE_KEY = 'householdRisk';

// One request per child at the same location; capped so a 10-child household
// cannot fire ten simultaneous calls at the rate-limited upstream.
const CONCURRENCY = 3;

const RANK: Record<RiskLevel, number> = { low: 1, moderate: 2, high: 3 };

export type ChildRisk = {
  childId: string;
  name: string;
  age: number;
  level: RiskLevel | null; // null = this child's fetch failed
};

export type HouseholdRisk = {
  overall: RiskLevel | null; // worst level among children with data
  counts: { high: number; moderate: number; low: number; unknown: number };
  children: ChildRisk[];
  updatedAt: string;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

export async function loadCachedHouseholdRisk(): Promise<HouseholdRisk | null> {
  const raw = await AsyncStorage.getItem(HOUSEHOLD_CACHE_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as HouseholdRisk;
  } catch {
    return null;
  }
}

/**
 * Fetches each child's risk at the current location and aggregates it into an
 * overall household figure. A single child's failure degrades to `level: null`
 * rather than failing the whole household. Throws only when location itself is
 * unavailable (via getCurrentCoords).
 */
export async function fetchHouseholdRisk(): Promise<HouseholdRisk> {
  const profile = await loadProfile();
  const children = profile?.children ?? [];

  const { lat, lon } = await getCurrentCoords();

  const risks = await mapWithConcurrency(children, CONCURRENCY, async (child): Promise<ChildRisk> => {
    try {
      const data = await fetchEnvironmentRisk(child, lat, lon);
      return { childId: child.id, name: child.name, age: child.age, level: data.priority_alert };
    } catch {
      return { childId: child.id, name: child.name, age: child.age, level: null };
    }
  });

  const counts = { high: 0, moderate: 0, low: 0, unknown: 0 };
  let overall: RiskLevel | null = null;

  for (const risk of risks) {
    if (!risk.level) {
      counts.unknown++;
      continue;
    }

    counts[risk.level]++;

    if (!overall || RANK[risk.level] > RANK[overall]) {
      overall = risk.level;
    }
  }

  const result: HouseholdRisk = {
    overall,
    counts,
    children: risks,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(HOUSEHOLD_CACHE_KEY, JSON.stringify(result));

  return result;
}
