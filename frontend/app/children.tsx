import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type RiskLevel } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import {
  fetchHouseholdRisk,
  type HouseholdRisk,
  loadCachedHouseholdRisk,
} from '@/lib/household';
import {
  type CaregiverProfile,
  loadProfile,
  MAX_CHILDREN,
  removeChild,
  selectChild,
} from '@/lib/profile';
import { riskBg, riskText } from '@/lib/risk';

export default function ChildrenScreen() {
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [household, setHousehold] = useState<HouseholdRisk | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHousehold = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      setHousehold(await fetchHouseholdRisk());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load household risk.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [loaded, cached] = await Promise.all([loadProfile(), loadCachedHouseholdRisk()]);

        if (!active) return;

        setProfile(loaded);
        setHousehold(cached);

        // On-demand + cached: only spend calls when there is nothing to show yet.
        if (!cached) refreshHousehold();
      })();

      return () => {
        active = false;
      };
    }, [refreshHousehold])
  );

  const children = profile?.children ?? [];
  const selectedId = profile?.selectedChildId;
  const atCap = children.length >= MAX_CHILDREN;

  const levelFor = (childId: string): RiskLevel | null =>
    household?.children.find((c) => c.childId === childId)?.level ?? null;

  const onSelect = async (id: string) => {
    await selectChild(id);
    router.replace('/');
  };

  const onDelete = async (id: string, name: string) => {
    if (children.length <= 1) {
      await confirmAction(
        'Cannot remove',
        'At least one child profile is required. Add another child before removing this one.',
        'OK'
      );
      return;
    }

    const ok = await confirmAction(
      `Remove ${name}?`,
      "This deletes the child's profile from this device. This cannot be undone.",
      'Remove',
      true
    );

    if (!ok) return;

    setProfile(await removeChild(id));
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#101828" />
        </Pressable>
        <View>
          <Text style={styles.title}>My Children</Text>
          <Text style={styles.subtitle}>
            {children.length} of {MAX_CHILDREN} · tap a child to view their dashboard
          </Text>
        </View>
      </View>

      <HouseholdCard
        household={household}
        refreshing={refreshing}
        error={error}
        onRefresh={refreshHousehold}
      />

      {children.map((child) => {
        const level = levelFor(child.id);
        const selected = child.id === selectedId;

        return (
          <Pressable
            key={child.id}
            style={[styles.childCard, selected && styles.childCardSelected]}
            onPress={() => onSelect(child.id)}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#2F6B9A" />
            </View>

            <View style={styles.childInfo}>
              <Text style={styles.childName} numberOfLines={1}>
                {child.name}
              </Text>
              <Text style={styles.childMeta}>
                {child.age} {child.age === 1 ? 'year' : 'years'} · {ageGroupLabel(child.age_group)}
              </Text>
              {selected && <Text style={styles.selectedTag}>Currently viewing</Text>}
            </View>

            <View style={styles.childRight}>
              <RiskBadge level={level} />
              <View style={styles.rowActions}>
                <Pressable
                  hitSlop={8}
                  onPress={() => router.push(`/child-form?childId=${child.id}`)}
                  accessibilityLabel={`Edit ${child.name}`}
                >
                  <Ionicons name="create-outline" size={20} color="#2F6BFF" />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => onDelete(child.id, child.name)}
                  accessibilityLabel={`Remove ${child.name}`}
                >
                  <Ionicons name="trash-outline" size={19} color="#B91C1C" />
                </Pressable>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.addButton, atCap && styles.addButtonDisabled]}
        onPress={() => router.push('/child-form')}
        disabled={atCap}
      >
        <Ionicons name="add" size={22} color={atCap ? '#94A3B8' : '#2F6BFF'} />
        <Text style={[styles.addText, atCap && styles.addTextDisabled]}>
          {atCap ? `Maximum ${MAX_CHILDREN} children` : `Add child (${children.length}/${MAX_CHILDREN})`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HouseholdCard({
  household,
  refreshing,
  error,
  onRefresh,
}: {
  household: HouseholdRisk | null;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const level = household?.overall ?? null;

  return (
    <View style={[styles.householdCard, { backgroundColor: level ? riskBg(level) : '#FFFFFF' }]}>
      <View style={styles.householdTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.householdLabel}>Overall Household Risk</Text>
          <Text style={[styles.householdLevel, { color: level ? riskText(level) : '#667085' }]}>
            {refreshing && !household ? 'Checking…' : level ? level.toUpperCase() : 'UNKNOWN'}
          </Text>
        </View>

        <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={refreshing} hitSlop={8}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#2F6BFF" />
          ) : (
            <Ionicons name="refresh" size={20} color="#2F6BFF" />
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.householdError}>{error}</Text>
      ) : household ? (
        <>
          <View style={styles.countRow}>
            <CountPill label="High" value={household.counts.high} color="#B91C1C" bg="#FEE2E2" />
            <CountPill label="Moderate" value={household.counts.moderate} color="#92400E" bg="#FEF3C7" />
            <CountPill label="Low" value={household.counts.low} color="#166534" bg="#DCFCE7" />
            {household.counts.unknown > 0 && (
              <CountPill label="Unknown" value={household.counts.unknown} color="#475569" bg="#EEF2F7" />
            )}
          </View>
          <Text style={styles.updatedText}>Updated {formatUpdated(household.updatedAt)}</Text>
        </>
      ) : (
        <Text style={styles.updatedText}>Tap refresh to assess every child.</Text>
      )}
    </View>
  );
}

function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) {
    return (
      <View style={[styles.badge, { backgroundColor: '#EEF2F7' }]}>
        <Text style={[styles.badgeText, { color: '#94A3B8' }]}>—</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: riskBg(level) }]}>
      <Text style={[styles.badgeText, { color: riskText(level) }]}>{level.toUpperCase()}</Text>
    </View>
  );
}

function CountPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.countPill, { backgroundColor: bg }]}>
      <Text style={[styles.countValue, { color }]}>{value}</Text>
      <Text style={[styles.countLabel, { color }]}>{label}</Text>
    </View>
  );
}

function ageGroupLabel(group: string) {
  if (group === 'under5') return 'Under 5';
  if (group === 'child') return 'Child';
  return 'Adolescent';
}

function formatUpdated(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  title: { fontSize: 28, fontWeight: '900', color: '#101828', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: '#667085', marginTop: 2, maxWidth: 240 },
  householdCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 20,
  },
  householdTop: { flexDirection: 'row', alignItems: 'center' },
  householdLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  householdLevel: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  householdError: { marginTop: 10, fontSize: 13, color: '#B91C1C', fontWeight: '600', lineHeight: 18 },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  countPill: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  countValue: { fontSize: 18, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  updatedText: { fontSize: 12, color: '#667085', marginTop: 12 },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 12,
  },
  childCardSelected: { borderColor: '#2F6BFF', borderWidth: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCEEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childInfo: { flex: 1, minWidth: 0 },
  childName: { fontSize: 17, fontWeight: '900', color: '#101828' },
  childMeta: { fontSize: 13, color: '#667085', marginTop: 2 },
  selectedTag: { fontSize: 12, color: '#2F6BFF', fontWeight: '800', marginTop: 3 },
  childRight: { alignItems: 'flex-end', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, minWidth: 44, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  rowActions: { flexDirection: 'row', gap: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF5FF',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#D8E5FF',
  },
  addButtonDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  addText: { color: '#2F6BFF', fontSize: 15, fontWeight: '900' },
  addTextDisabled: { color: '#94A3B8' },
});
