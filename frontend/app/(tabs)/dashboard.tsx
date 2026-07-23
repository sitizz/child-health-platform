import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonalisedRecommendations } from '@/components/personalised-recommendations';
import { type ChildProfile, type EnvironmentRisk, type RiskLevel } from '@/lib/api';
import { generateRecommendations } from '@/lib/recommendations';
import {
  fetchHouseholdRisk,
  type HouseholdRisk,
  loadCachedHouseholdRisk,
} from '@/lib/household';
import { loadRiskHistory, type RiskHistoryEntry } from '@/lib/history';
import { loadNotifications, type NotificationEntry } from '@/lib/notifications-log';
import { loadProfile, selectChild } from '@/lib/profile';
import { riskBg, riskText } from '@/lib/risk';

export default function CaregiverDashboardScreen() {
  const insets = useSafeAreaInsets();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [household, setHousehold] = useState<HouseholdRisk | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [history, setHistory] = useState<RiskHistoryEntry[]>([]);
  const [latest, setLatest] = useState<{ data: EnvironmentRisk; cachedAt: string } | null>(null);

  const refreshHousehold = useCallback(async () => {
    setRefreshing(true);
    try {
      setHousehold(await fetchHouseholdRisk());
    } catch {
      // Household errors are non-fatal here; the rest of the dashboard still shows.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [profile, cachedHousehold, notifs, hist, lastRaw] = await Promise.all([
          loadProfile(),
          loadCachedHouseholdRisk(),
          loadNotifications(),
          loadRiskHistory(),
          AsyncStorage.getItem('lastRiskResult'),
        ]);

        if (!active) return;

        setChildren(profile?.children ?? []);
        setSelectedId(profile?.selectedChildId);
        setHousehold(cachedHousehold);
        setNotifications(notifs);
        setHistory(hist);

        try {
          setLatest(lastRaw ? JSON.parse(lastRaw) : null);
        } catch {
          setLatest(null);
        }

        if (!cachedHousehold) refreshHousehold();
      })();

      return () => {
        active = false;
      };
    }, [refreshHousehold])
  );

  const levelFor = (childId: string): RiskLevel | null =>
    household?.children.find((c) => c.childId === childId)?.level ?? null;

  const openChild = async (id: string) => {
    await selectChild(id);
    router.navigate('/');
  };

  const selectedChild = children.find((c) => c.id === selectedId);
  const recommendations =
    selectedChild && latest?.data
      ? generateRecommendations(selectedChild, latest.data, history)
      : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Caregiver Dashboard</Text>
      <Text style={styles.pageSubtitle}>Overview across your household</Text>

      {/* Household current risk */}
      <View style={[styles.card, styles.householdCard, { backgroundColor: household?.overall ? riskBg(household.overall) : '#FFFFFF' }]}>
        <View style={styles.householdTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.householdLabel}>Overall Household Risk</Text>
            <Text style={[styles.householdLevel, { color: household?.overall ? riskText(household.overall) : '#667085' }]}>
              {refreshing && !household ? 'Checking…' : household?.overall ? household.overall.toUpperCase() : 'UNKNOWN'}
            </Text>
          </View>
          <Pressable style={styles.iconButton} onPress={refreshHousehold} disabled={refreshing} hitSlop={8}>
            {refreshing ? <ActivityIndicator size="small" color="#2F6BFF" /> : <Ionicons name="refresh" size={20} color="#2F6BFF" />}
          </Pressable>
        </View>

        {household && (
          <View style={styles.countRow}>
            <CountPill label="High" value={household.counts.high} color="#B91C1C" bg="#FEE2E2" />
            <CountPill label="Moderate" value={household.counts.moderate} color="#92400E" bg="#FEF3C7" />
            <CountPill label="Low" value={household.counts.low} color="#166534" bg="#DCFCE7" />
            {household.counts.unknown > 0 && (
              <CountPill label="Unknown" value={household.counts.unknown} color="#475569" bg="#EEF2F7" />
            )}
          </View>
        )}
        {household && <Text style={styles.mutedSmall}>Updated {relTime(household.updatedAt)}</Text>}
      </View>

      {/* Registered children */}
      <SectionHeader
        title="Registered Children"
        actionLabel="Manage"
        onAction={() => router.push('/children')}
      />
      <View style={styles.card}>
        {children.map((child, i) => (
          <Pressable
            key={child.id}
            style={[styles.childRow, i < children.length - 1 && styles.rowDivider]}
            onPress={() => openChild(child.id)}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#2F6B9A" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.childName} numberOfLines={1}>
                {child.name}
                {child.id === selectedId && <Text style={styles.viewingTag}>  · viewing</Text>}
              </Text>
              <Text style={styles.childMeta}>{child.age} {child.age === 1 ? 'year' : 'years'} old</Text>
            </View>
            <RiskBadge level={levelFor(child.id)} />
            <Ionicons name="chevron-forward" size={18} color="#C3CDDB" />
          </Pressable>
        ))}
      </View>

      {/* Personalised recommendations */}
      <SectionHeader title="Recommendations" />
      {recommendations.length ? (
        <>
          {selectedChild && latest && (
            <Text style={styles.recoFor}>
              Personalised for {selectedChild.name} · updated {relTime(latest.cachedAt)}
            </Text>
          )}
          <PersonalisedRecommendations items={recommendations} />
          <View style={{ height: 22 }} />
        </>
      ) : (
        <View style={styles.card}>
          <EmptyState
            icon="bulb-outline"
            text="Open the Home tab to generate personalised recommendations for your child."
          />
        </View>
      )}

      {/* Notifications feed */}
      <SectionHeader title="Notifications" />
      <View style={styles.card}>
        {notifications.length ? (
          notifications.slice(0, 8).map((n, i) => (
            <View key={n.id} style={[styles.notifRow, i < Math.min(notifications.length, 8) - 1 && styles.rowDivider]}>
              <View style={[styles.notifIcon, { backgroundColor: n.type === 'high' ? '#FEE2E2' : n.type === 'improved' ? '#DCFCE7' : '#EEF5FF' }]}>
                <Ionicons
                  name={n.type === 'high' ? 'warning' : n.type === 'improved' ? 'checkmark' : 'notifications'}
                  size={16}
                  color={n.type === 'high' ? '#B91C1C' : n.type === 'improved' ? '#166534' : '#2F6BFF'}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.notifTitle}>
                  {n.title}
                  {n.childName ? <Text style={styles.notifChild}> · {n.childName}</Text> : null}
                </Text>
                <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
              </View>
              <Text style={styles.notifTime}>{relTime(n.at)}</Text>
            </View>
          ))
        ) : (
          <EmptyState
            icon="notifications-outline"
            text="No alerts yet. High-risk and risk-improvement alerts will appear here."
          />
        )}
      </View>

      {/* Risk history */}
      <SectionHeader title="Risk History" />
      <View style={[styles.card, styles.lastCard]}>
        {history.length ? (
          history.slice(0, 12).map((h, i) => (
            <View key={h.id} style={[styles.historyRow, i < Math.min(history.length, 12) - 1 && styles.rowDivider]}>
              <View style={[styles.historyDot, { backgroundColor: riskText(h.level) }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyLevel}>
                  <Text style={{ color: riskText(h.level) }}>{h.level.toUpperCase()}</Text>
                  <Text style={styles.historyChild}> · {h.childName}</Text>
                </Text>
                <Text style={styles.historyMeta}>
                  {h.temperature != null ? `${h.temperature}°C` : ''}
                  {h.aqi != null ? `${h.temperature != null ? ' · ' : ''}AQI ${h.aqi}` : ''}
                </Text>
              </View>
              <Text style={styles.historyTime}>{relTime(h.at)}</Text>
            </View>
          ))
        ) : (
          <EmptyState
            icon="time-outline"
            text="No risk history yet. It builds as risk checks run over time."
          />
        )}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel} ›</Text>
        </Pressable>
      )}
    </View>
  );
}

function RiskBadge({ level }: { level: RiskLevel | null }) {
  const bg = level ? riskBg(level) : '#EEF2F7';
  const fg = level ? riskText(level) : '#94A3B8';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{level ? level.toUpperCase() : '—'}</Text>
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

function EmptyState({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={26} color="#94A3B8" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function relTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 30, fontWeight: '900', color: '#101828', letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 15, color: '#667085', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 8,
  },
  lastCard: { marginBottom: 8 },
  householdCard: { padding: 18, marginBottom: 22 },
  householdTop: { flexDirection: 'row', alignItems: 'center' },
  householdLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  householdLevel: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  iconButton: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6EBF2',
  },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  countPill: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  countValue: { fontSize: 18, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  mutedSmall: { fontSize: 12, color: '#667085', marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#101828' },
  sectionAction: { fontSize: 14, fontWeight: '800', color: '#2F6BFF' },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCEEFF', alignItems: 'center', justifyContent: 'center' },
  childName: { fontSize: 15, fontWeight: '800', color: '#101828' },
  viewingTag: { fontSize: 12, fontWeight: '800', color: '#2F6BFF' },
  childMeta: { fontSize: 12, color: '#667085', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, minWidth: 44, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  recoFor: { fontSize: 12, color: '#667085', marginBottom: 12, fontWeight: '700' },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  notifIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '800', color: '#101828' },
  notifChild: { fontSize: 13, fontWeight: '700', color: '#667085' },
  notifBody: { fontSize: 12, color: '#667085', marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyLevel: { fontSize: 14, fontWeight: '900' },
  historyChild: { fontSize: 13, fontWeight: '700', color: '#667085' },
  historyMeta: { fontSize: 12, color: '#667085', marginTop: 2 },
  historyTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
});
