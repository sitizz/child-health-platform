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

import { ApiError, type RiskLevel } from '@/lib/api';
import { deleteChild, selectServerChild } from '@/lib/children-api';
import { confirmAction } from '@/lib/confirm';
import { ageGroup, ageGroupLabel, childDisplayName } from '@/lib/current-child';
import { routeForGateError } from '@/lib/gate';
import { type ChildRiskSummary, getPanelOverview, type PanelOverview } from '@/lib/panel-api';
import { riskBg, riskText } from '@/lib/risk';

const MAX_CHILDREN = 10;

export default function ChildrenScreen() {
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<PanelOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await getPanelOverview());
    } catch (err) {
      if (routeForGateError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Unable to load your children.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) await load();
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  const summaries = overview?.children ?? [];
  const atCap = summaries.length >= MAX_CHILDREN;

  const counts = summaries.reduce(
    (acc, s) => {
      if (s.latest_priority) acc[s.latest_priority]++;
      else acc.unknown++;
      return acc;
    },
    { high: 0, moderate: 0, low: 0, unknown: 0 }
  );

  const onSelect = async (id: string) => {
    try {
      await selectServerChild(id);
      router.replace('/');
    } catch (err) {
      routeForGateError(err);
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (summaries.length <= 1) {
      await confirmAction('Cannot remove', 'At least one child is required. Add another child first.', 'OK');
      return;
    }
    const ok = await confirmAction(`Remove ${name}?`, "This deletes the child's profile. This cannot be undone.", 'Remove', true);
    if (!ok) return;

    try {
      await deleteChild(id);
      await load();
    } catch (err) {
      if (!routeForGateError(err)) {
        await confirmAction('Could not remove', err instanceof ApiError ? err.message : 'Please try again.', 'OK');
      }
    }
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
            {summaries.length} of {MAX_CHILDREN} · tap a child to view their dashboard
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.householdCard, { backgroundColor: overview?.household_priority ? riskBg(overview.household_priority) : '#FFFFFF' }]}>
            <Text style={styles.householdLabel}>Overall Household Risk</Text>
            <Text style={[styles.householdLevel, { color: overview?.household_priority ? riskText(overview.household_priority) : '#667085' }]}>
              {overview?.household_priority ? overview.household_priority.toUpperCase() : 'UNKNOWN'}
            </Text>
            <View style={styles.countRow}>
              <CountPill label="High" value={counts.high} color="#B91C1C" bg="#FEE2E2" />
              <CountPill label="Moderate" value={counts.moderate} color="#92400E" bg="#FEF3C7" />
              <CountPill label="Low" value={counts.low} color="#166534" bg="#DCFCE7" />
              {counts.unknown > 0 && <CountPill label="Pending" value={counts.unknown} color="#475569" bg="#EEF2F7" />}
            </View>
          </View>

          {summaries.map((summary) => (
            <ChildCard
              key={summary.child.id}
              summary={summary}
              selected={summary.child.id === overview?.selected_child_id}
              onSelect={() => onSelect(summary.child.id)}
              onEdit={() => router.push(`/child-form?childId=${summary.child.id}`)}
              onDelete={() => onDelete(summary.child.id, childDisplayName(summary.child))}
            />
          ))}

          <Pressable
            style={[styles.addButton, atCap && styles.addButtonDisabled]}
            onPress={() => router.push('/child-form')}
            disabled={atCap}
          >
            <Ionicons name="add" size={22} color={atCap ? '#94A3B8' : '#2F6BFF'} />
            <Text style={[styles.addText, atCap && styles.addTextDisabled]}>
              {atCap ? `Maximum ${MAX_CHILDREN} children` : `Add child (${summaries.length}/${MAX_CHILDREN})`}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function ChildCard({ summary, selected, onSelect, onEdit, onDelete }: { summary: ChildRiskSummary; selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  const child = summary.child;
  const level = summary.latest_priority as RiskLevel | null;

  return (
    <Pressable style={[styles.childCard, selected && styles.childCardSelected]} onPress={onSelect}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#2F6B9A" />
      </View>
      <View style={styles.childInfo}>
        <Text style={styles.childName} numberOfLines={1}>{childDisplayName(child)}</Text>
        <Text style={styles.childMeta}>
          {child.age} {child.age === 1 ? 'year' : 'years'} · {ageGroupLabel(ageGroup(child.age))}
        </Text>
        {selected && <Text style={styles.selectedTag}>Currently viewing</Text>}
      </View>
      <View style={styles.childRight}>
        <View style={[styles.badge, { backgroundColor: level ? riskBg(level) : '#EEF2F7' }]}>
          <Text style={[styles.badgeText, { color: level ? riskText(level) : '#94A3B8' }]}>
            {level ? level.toUpperCase() : '—'}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable hitSlop={8} onPress={onEdit} accessibilityLabel="Edit child">
            <Ionicons name="create-outline" size={20} color="#2F6BFF" />
          </Pressable>
          <Pressable hitSlop={8} onPress={onDelete} accessibilityLabel="Remove child">
            <Ionicons name="trash-outline" size={19} color="#B91C1C" />
          </Pressable>
        </View>
      </View>
    </Pressable>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6EBF2' },
  title: { fontSize: 28, fontWeight: '900', color: '#101828', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: '#667085', marginTop: 2, maxWidth: 240 },
  errorCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E6EBF2' },
  errorText: { color: '#475569', fontSize: 14, textAlign: 'center' },
  retry: { backgroundColor: '#2F6BFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 28 },
  retryText: { color: '#FFFFFF', fontWeight: '900' },
  householdCard: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#E6EBF2', marginBottom: 20 },
  householdLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  householdLevel: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  countPill: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  countValue: { fontSize: 18, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  childCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E6EBF2', marginBottom: 12 },
  childCardSelected: { borderColor: '#2F6BFF', borderWidth: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCEEFF', alignItems: 'center', justifyContent: 'center' },
  childInfo: { flex: 1, minWidth: 0 },
  childName: { fontSize: 17, fontWeight: '900', color: '#101828' },
  childMeta: { fontSize: 13, color: '#667085', marginTop: 2 },
  selectedTag: { fontSize: 12, color: '#2F6BFF', fontWeight: '800', marginTop: 3 },
  childRight: { alignItems: 'flex-end', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, minWidth: 44, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  rowActions: { flexDirection: 'row', gap: 16 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF5FF', borderRadius: 18, paddingVertical: 16, marginTop: 4, borderWidth: 1, borderColor: '#D8E5FF' },
  addButtonDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  addText: { color: '#2F6BFF', fontSize: 15, fontWeight: '900' },
  addTextDisabled: { color: '#94A3B8' },
});
