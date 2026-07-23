import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RecPriority, Recommendation } from '@/lib/recommendations';

const PRIORITY_STYLE: Record<RecPriority, { bg: string; fg: string; label: string; icon: any }> = {
  urgent: { bg: '#FEE2E2', fg: '#B91C1C', label: 'URGENT', icon: 'alert-circle' },
  important: { bg: '#FEF3C7', fg: '#92400E', label: 'IMPORTANT', icon: 'warning' },
  advisory: { bg: '#EEF5FF', fg: '#2F6BFF', label: 'ADVISORY', icon: 'information-circle' },
};

export function PersonalisedRecommendations({ items }: { items: Recommendation[] }) {
  return (
    <View style={styles.list}>
      {items.map((rec) => {
        const style = PRIORITY_STYLE[rec.priority];

        return (
          <View key={rec.id} style={[styles.card, { borderLeftColor: style.fg }]}>
            <View style={[styles.pill, { backgroundColor: style.bg }]}>
              <Ionicons name={style.icon} size={12} color={style.fg} />
              <Text style={[styles.pillText, { color: style.fg }]}>{style.label}</Text>
            </View>

            <Text style={styles.title}>{rec.title}</Text>
            <Text style={styles.detail}>{rec.detail}</Text>

            {rec.reasons.length > 0 && (
              <View style={styles.reasons}>
                {rec.reasons.map((reason, i) => (
                  <View key={i} style={styles.reasonChip}>
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderLeftWidth: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 8,
  },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '900', color: '#101828' },
  detail: { fontSize: 13, color: '#475569', lineHeight: 20, marginTop: 4 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  reasonChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reasonText: { fontSize: 11, color: '#475569', fontWeight: '700' },
});
