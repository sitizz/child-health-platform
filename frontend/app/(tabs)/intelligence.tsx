import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const API_URL = 'https://child-health-platform.onrender.com';

export default function RiskIntelligenceScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskData();
  }, []);

  async function fetchRiskData() {
    try {
      const response = await fetch(
        `${API_URL}/environment-risk?lat=3.1390&lon=101.6869&age_group=under5`
      );

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Risk intelligence error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Analysing environmental risk intelligence...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>Unable to load risk intelligence.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Risk Intelligence</Text>
      <Text style={styles.subheader}>
        Environmental health risk analysis for vulnerable children
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Domains</Text>

        <View style={styles.grid}>
          <RiskCard title="Heat Stress" value={data.risks.heat_stress} />
          <RiskCard title="Respiratory Burden" value={data.risks.respiratory} />
          <RiskCard title="Dengue Watch" value={data.risks.dengue} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>72-Hour Outlook</Text>
        <Text style={styles.largeValue}>{data.trend.direction.toUpperCase()}</Text>
        <Text style={styles.bodyText}>{data.trend.message}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Forecast</Text>

        {data.forecast.map((day: any) => (
          <View key={day.day} style={styles.forecastRow}>
            <Text style={styles.forecastDay}>Day {day.day}</Text>
            <Text style={styles.forecastText}>
              {day.max_temperature}°C · {day.rainfall}mm rain
            </Text>
            <Text style={styles.riskBadge}>{day.predicted_risk.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Escalation Status</Text>
        <Text style={styles.largeValue}>{data.escalation.level.toUpperCase()}</Text>
        <Text style={styles.bodyText}>{data.escalation.reason}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Age-Specific Guidance</Text>
        <Text style={styles.bodyText}>{data.guidance.message}</Text>
      </View>
    </ScrollView>
  );
}

function RiskCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },
  content: {
    padding: 20,
    paddingTop: 70,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subheader: {
    marginTop: 8,
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  panel: {
    marginTop: 22,
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 22,
  },
  panelTitle: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 10,
  },
  largeValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: '#E5E7EB',
    lineHeight: 22,
  },
  forecastRow: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  forecastDay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  forecastText: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  riskBadge: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
});