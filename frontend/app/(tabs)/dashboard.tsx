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

import { ServerRecommendations } from '@/components/server-recommendations';
import { type RiskLevel } from '@/lib/api';
import { type RecommendationResult, selectServerChild } from '@/lib/children-api';
import { childDisplayName } from '@/lib/current-child';
import { type EngagementMetrics, getEngagementMetrics } from '@/lib/engagement-api';
import { routeForGateError } from '@/lib/gate';
import {
  getPanelHistory,
  getPanelOverview,
  getPanelRecommendations,
  type HistoryItem,
  type PanelOverview,
} from '@/lib/panel-api';
import { riskBg, riskText } from '@/lib/risk';

export default function CaregiverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<PanelOverview | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, hist, recs, mets] = await Promise.all([
        getPanelOverview(),
        getPanelHistory(),
        getPanelRecommendations(),
        getEngagementMetrics().catch(() => null),
      ]);
      setOverview(ov);
      setHistory(hist.items ?? []);
      setRecommendations(recs.items ?? []);
      setMetrics(mets);
    } catch (err) {
      if (routeForGateError(err)) return;
      setError('Unable to load your dashboard. Pull to retry.');
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

  const counts = (overview?.children ?? []).reduce(
    (acc, s) => {
      if (s.latest_priority) acc[s.latest_priority]++;
      else acc.unknown++;
      return acc;
    },
    { high: 0, moderate: 0, low: 0, unknown: 0 }
  );

  const notifications = history.filter((h) => h.kind === 'notification');
  const assessments = history.filter((h) => h.kind === 'assessment');
  const topRecommendation = recommendations[0];

  const openChild = async (id: string) => {
    try {
      await selectServerChild(id);
      router.navigate('/');
    } catch (err) {
      routeForGateError(err);
    }
  };

  if (loading && !overview) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Caregiver Dashboard</Text>
      <Text style={styles.pageSubtitle}>Overview across your household</Text>

      {error && (
        <Pressable style={styles.errorBanner} onPress={load}>
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      )}

      {/* Household risk */}
      <View style={[styles.card, styles.householdCard, { backgroundColor: overview?.household_priority ? riskBg(overview.household_priority) : '#FFFFFF' }]}>
        <View style={styles.householdTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.householdLabel}>Overall Household Risk</Text>
            <Text style={[styles.householdLevel, { color: overview?.household_priority ? riskText(overview.household_priority) : '#667085' }]}>
              {overview?.household_priority ? overview.household_priority.toUpperCase() : 'UNKNOWN'}
            </Text>
          </View>
          <Pressable style={styles.iconButton} onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={20} color="#2F6BFF" />
          </Pressable>
        </View>
        <View style={styles.countRow}>
          <CountPill label="High" value={counts.high} color="#B91C1C" bg="#FEE2E2" />
          <CountPill label="Moderate" value={counts.moderate} color="#92400E" bg="#FEF3C7" />
          <CountPill label="Low" value={counts.low} color="#166534" bg="#DCFCE7" />
          {counts.unknown > 0 && <CountPill label="Pending" value={counts.unknown} color="#475569" bg="#EEF2F7" />}
        </View>
        {overview && overview.open_alerts_count > 0 && (
          <Text style={styles.alertsText}>{overview.open_alerts_count} open alert{overview.open_alerts_count === 1 ? '' : 's'}</Text>
        )}
      </View>

      {/* Engagement activity */}
      {metrics && (
        <>
          <SectionHeader title="Your Activity" />
          <View style={[styles.card, styles.activityCard]}>
            <ActivityStat label="Risk checks" value={metrics.by_type?.risk_check ?? 0} />
            <View style={styles.activityDivider} />
            <ActivityStat label="Shares" value={metrics.by_type?.share_summary ?? 0} />
            <View style={styles.activityDivider} />
            <ActivityStat label="Children added" value={metrics.by_type?.add_child ?? 0} />
          </View>
        </>
      )}

      {/* Registered children */}
      <SectionHeader title="Registered Children" actionLabel="Manage" onAction={() => router.push('/children')} />
      <View style={styles.card}>
        {(overview?.children ?? []).map((summary, i, arr) => {
          const level = summary.latest_priority as RiskLevel | null;
          return (
            <Pressable key={summary.child.id} style={[styles.childRow, i < arr.length - 1 && styles.rowDivider]} onPress={() => openChild(summary.child.id)}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color="#2F6B9A" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.childName} numberOfLines={1}>
                  {childDisplayName(summary.child)}
                  {summary.child.id === overview?.selected_child_id && <Text style={styles.viewingTag}>  · viewing</Text>}
                </Text>
                <Text style={styles.childMeta}>{summary.child.age} {summary.child.age === 1 ? 'year' : 'years'} old</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: level ? riskBg(level) : '#EEF2F7' }]}>
                <Text style={[styles.badgeText, { color: level ? riskText(level) : '#94A3B8' }]}>{level ? level.toUpperCase() : '—'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C3CDDB" />
            </Pressable>
          );
        })}
      </View>

      {/* Recommendations */}
      <SectionHeader title="Recommendations" />
      {topRecommendation ? (
        <View style={styles.card}>
          <ServerRecommendations result={topRecommendation} />
        </View>
      ) : (
        <View style={styles.card}>
          <EmptyState icon="bulb-outline" text="Open the Home tab to generate recommendations for your child." />
        </View>
      )}

      {/* Notifications */}
      <SectionHeader title="Notifications" />
      <View style={styles.card}>
        {notifications.length ? (
          notifications.slice(0, 8).map((n, i, arr) => (
            <View key={n.id} style={[styles.notifRow, i < arr.length - 1 && styles.rowDivider]}>
              <View style={styles.notifIcon}>
                <Ionicons name="notifications" size={16} color="#2F6BFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.notifTitle}>{n.title ?? 'Alert'}</Text>
                {!!n.body && <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>}
              </View>
              <Text style={styles.notifTime}>{relTime(n.created_at)}</Text>
            </View>
          ))
        ) : (
          <EmptyState icon="notifications-outline" text="No alerts yet. High-risk and improvement alerts will appear here." />
        )}
      </View>

      {/* Risk history */}
      <SectionHeader title="Risk History" />
      <View style={styles.card}>
        {assessments.length ? (
          assessments.slice(0, 12).map((h, i, arr) => {
            const level = h.priority as RiskLevel | null;
            return (
              <View key={h.id} style={[styles.historyRow, i < arr.length - 1 && styles.rowDivider]}>
                <View style={[styles.historyDot, { backgroundColor: level ? riskText(level) : '#94A3B8' }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyLevel}>
                    <Text style={{ color: level ? riskText(level) : '#94A3B8' }}>{level ? level.toUpperCase() : 'ASSESSED'}</Text>
                    {!!h.title && <Text style={styles.historyChild}> · {h.title}</Text>}
                  </Text>
                </View>
                <Text style={styles.historyTime}>{relTime(h.created_at)}</Text>
              </View>
            );
          })
        ) : (
          <EmptyState icon="time-outline" text="No risk history yet. It builds as risk checks run." />
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

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.activityStat}>
      <Text style={styles.activityValue}>{value}</Text>
      <Text style={styles.activityLabel}>{label}</Text>
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
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 30, fontWeight: '900', color: '#101828', letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 15, color: '#667085', marginTop: 4, marginBottom: 20 },
  errorBanner: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FCD34D' },
  errorText: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E6EBF2', marginBottom: 8 },
  householdCard: { padding: 18, marginBottom: 22 },
  householdTop: { flexDirection: 'row', alignItems: 'center' },
  householdLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  householdLevel: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6EBF2' },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  countPill: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  countValue: { fontSize: 18, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  alertsText: { fontSize: 12, color: '#B91C1C', fontWeight: '700', marginTop: 12 },
  activityCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, marginBottom: 22 },
  activityStat: { flex: 1, alignItems: 'center' },
  activityValue: { fontSize: 24, fontWeight: '900', color: '#101828' },
  activityLabel: { fontSize: 11, color: '#667085', fontWeight: '700', marginTop: 3 },
  activityDivider: { width: 1, height: 34, backgroundColor: '#E6EBF2' },
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
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  notifIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 14, fontWeight: '800', color: '#101828' },
  notifBody: { fontSize: 12, color: '#667085', marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyLevel: { fontSize: 14, fontWeight: '900' },
  historyChild: { fontSize: 13, fontWeight: '700', color: '#667085' },
  historyTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, maxWidth: 260 },
});
