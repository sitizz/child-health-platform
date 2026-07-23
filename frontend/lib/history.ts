import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RiskLevel } from './api';

const HISTORY_KEY = 'riskHistory';
const MAX_ENTRIES = 100;

export type RiskHistoryEntry = {
  id: string;
  childId: string;
  childName: string;
  level: RiskLevel;
  temperature: number | null;
  aqi: number | null;
  at: string;
};

export async function loadRiskHistory(): Promise<RiskHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RiskHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records a risk reading only when the level differs from the child's most recent
 * entry, so the timeline captures meaningful transitions ("went HIGH at 2pm")
 * rather than a noisy row for every 5-minute poll that reported the same level.
 */
export async function appendRiskHistory(entry: Omit<RiskHistoryEntry, 'id'>): Promise<void> {
  const history = await loadRiskHistory();

  const lastForChild = history.find((e) => e.childId === entry.childId);

  if (lastForChild && lastForChild.level === entry.level) return;

  const next = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry },
    ...history,
  ].slice(0, MAX_ENTRIES);

  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}
