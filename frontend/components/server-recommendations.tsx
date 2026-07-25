import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RecommendationResult } from '@/lib/children-api';

const SECTION_META: Record<string, { icon: any; color: string; bg: string }> = {
  priority: { icon: 'alert-circle', color: '#B91C1C', bg: '#FEE2E2' },
  secondary: { icon: 'ellipse', color: '#2F6BFF', bg: '#EEF5FF' },
  monitoring: { icon: 'eye', color: '#92400E', bg: '#FEF3C7' },
  escalation: { icon: 'medkit', color: '#B91C1C', bg: '#FEE2E2' },
};

export function ServerRecommendations({ result }: { result: RecommendationResult }) {
  return (
    <View style={styles.wrap}>
      {result.explanation?.why ? (
        <View style={styles.whyCard}>
          <Text style={styles.whyText}>{result.explanation.why}</Text>
          {result.explanation.child_factors?.length > 0 && (
            <View style={styles.chips}>
              {result.explanation.child_factors.map((factor, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{factor}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <ActionSection kind="priority" title="Priority actions" items={result.priority_actions} />
      <ActionSection kind="secondary" title="Also recommended" items={result.secondary_actions} />
      <ActionSection kind="monitoring" title="What to monitor" items={result.monitoring_advice} />
      <ActionSection kind="escalation" title="Seek care if" items={result.escalation_advice} />

      {result.disclaimer ? <Text style={styles.disclaimer}>{result.disclaimer}</Text> : null}
    </View>
  );
}

function ActionSection({ kind, title, items }: { kind: string; title: string; items: string[] }) {
  if (!items?.length) return null;
  const meta = SECTION_META[kind];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {items.map((item, i) => (
        <View key={i} style={styles.itemRow}>
          <Text style={[styles.bullet, { color: meta.color }]}>•</Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  whyCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6EBF2' },
  whyText: { fontSize: 14, color: '#334155', lineHeight: 21, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#E7EEFB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, color: '#2F55B5', fontWeight: '700' },
  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#101828' },
  itemRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  itemText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 20 },
  disclaimer: { fontSize: 11, color: '#94A3B8', lineHeight: 16, marginTop: 2, fontStyle: 'italic' },
});
