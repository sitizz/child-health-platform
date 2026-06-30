import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View,  Pressable } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

const API_URL = 'https://child-health-platform.onrender.com';

export default function RiskIntelligenceScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskData();
  }, []);

  async function fetchRiskData() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

if (status !== 'granted') {
  alert('Location permission is needed to check local environmental risk.');
  return;
}

const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});

const lat = location.coords.latitude;
const lon = location.coords.longitude;

const savedProfile = await AsyncStorage.getItem('caregiverProfile');

if (!savedProfile) {
  alert('Please complete child profile first.');
  return;
}

const parsedProfile = JSON.parse(savedProfile);

const selected = parsedProfile.children.find(
  (child: any) => child.id === parsedProfile.selectedChildId
);

if (!selected) {
  alert('Selected child profile not found.');
  return;
}

const response = await fetch(
  `${API_URL}/environment-risk?lat=${lat}&lon=${lon}` +
  `&age_group=${selected.age_group}` +
  `&asthma=${selected.asthma}` +
  `&fever=${selected.fever}` +
  `&cough=${selected.cough}` +
  `&dehydration=${selected.dehydration}` +
  `&mosquito_exposure=${selected.mosquito_exposure}` +
  `&flood_exposure=${selected.flood_exposure}`
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
    <View style={styles.headerBlock}>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>AI-POWERED ANALYSIS</Text>
      </View>

      <Text style={styles.header}>Risk Intelligence</Text>

      <Text style={styles.subheader}>
        Environmental health risk analysis for vulnerable children
      </Text>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Risk Domains</Text>

      <View style={styles.domainGrid}>
        <RiskCard
          title="Heat Stress"
          value={data.predictive_domains.heat_stress}
          icon="thermometer"
        />

        <RiskCard
          title="Respiratory Burden"
          value={data.predictive_domains.respiratory}
          icon="lungs"
        />

        <RiskCard
          title="Dengue Watch"
          value={data.predictive_domains.dengue}
          icon="bug-outline"
        />

        <RiskCard
          title="Flood Risk"
          value={data.risks.flood}
          icon="waves-arrow-up"
        />
      </View>
    </View>

    <View style={styles.outlookPanel}>
      <View style={{ flex: 1 }}>
        <Text style={styles.panelTitle}>72-Hour Outlook</Text>
        <Text style={styles.largeValue}>{data.trend.direction.toUpperCase()}</Text>
        <Text style={styles.bodyText}>{data.trend.message}</Text>
      </View>

      <View style={styles.gauge}>
        <Text style={styles.gaugeValue}>
          {data.trend.direction === 'stable' ? '58' : '72'}
        </Text>
        <Text style={styles.gaugeLabel}>/100</Text>
      </View>
    </View>

    <View style={styles.workflowCard}>
      <View style={styles.workflowHeader}>
        <Ionicons name="sunny-outline" size={22} color="#1FAE9B" />
        <Text style={styles.workflowTitle}>Caregiver Actions</Text>
      </View>

      {data.recommended_action?.caregiver?.map((item: string, index: number) => (
        <Text key={index} style={styles.workflowText}>• {item}</Text>
      ))}
    </View>

    <View style={styles.workflowCard}>
      <View style={styles.workflowHeader}>
        <Ionicons name="school-outline" size={22} color="#2F6BFF" />
        <Text style={styles.workflowTitle}>School Advisory</Text>
      </View>

      {data.recommended_action?.school?.map((item: string, index: number) => (
        <Text key={index} style={styles.workflowText}>• {item}</Text>
      ))}
    </View>

    <View style={styles.workflowCard}>
      <View style={styles.workflowHeader}>
        <Ionicons name="people-outline" size={22} color="#6E5AEF" />
        <Text style={styles.workflowTitle}>Community Guidance</Text>
      </View>

      {data.recommended_action?.community?.map((item: string, index: number) => (
        <Text key={index} style={styles.workflowText}>• {item}</Text>
      ))}
    </View>

    <View style={styles.section}>
      <View style={styles.forecastHeader}>
        <Text style={styles.sectionTitle}>3-Day Forecast</Text>
        
        <Pressable onPress={() => router.push('/full-forecast')}>
          <Text style={styles.viewMore}>View Full Forecast ›</Text>
        </Pressable>
    </View>

      <View style={styles.forecastGrid}>
        {data.forecast.slice(0, 3).map((day: any) => (
          <View key={day.day} style={styles.forecastRow}>
            <Ionicons
              name={day.rainfall > 5 ? 'rainy-outline' : 'partly-sunny-outline'}
              size={26}
              color={day.rainfall > 5 ? '#2F6BFF' : '#D97706'}
            />
            <Text style={styles.forecastDay}>Day {day.day}</Text>
            <Text style={styles.forecastText}>
              {day.max_temperature}°C
            </Text>
            <Text style={styles.forecastRain}>{day.rainfall}mm rain</Text>
            <Text style={styles.riskBadge}>{day.predicted_risk.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={styles.bottomGrid}>
      <View style={styles.escalationPanel}>
        <Ionicons name="shield-checkmark-outline" size={28} color="#D97706" />
        <Text style={styles.panelTitle}>Escalation Status</Text>
        <Text style={styles.escalationValue}>{data.escalation.level.toUpperCase()}</Text>
        <Text style={styles.darkBodyText}>{data.escalation.reason}</Text>
      </View>

      <View style={styles.guidancePanel}>
        <Ionicons name="sparkles-outline" size={26} color="#2F6BFF" />
        <Text style={styles.guidanceTitle}>Age-Specific Guidance</Text>
        <Text style={styles.guidanceSummary}>{data.guidance.summary}</Text>
      </View>
    </View>

    <View style={styles.fullGuidanceCard}>
      <Text style={styles.workflowTitle}>Key Guidance Points</Text>

      {data.guidance.key_points?.map((point: string, index: number) => (
        <View key={index} style={styles.guidancePoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.guidanceText}>{point}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);
}

function RiskCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: any;
}) {
  const colour =
    value === 'high' ? '#DC2626' : value === 'moderate' ? '#D97706' : '#168C6E';

  const bgColour =
    value === 'high' ? '#FEE2E2' : value === 'moderate' ? '#FEF3C7' : '#DCFCE7';

  return (
    <View style={styles.card}>
      <View style={[styles.iconBubble, { backgroundColor: bgColour }]}>
        <MaterialCommunityIcons name={icon} size={26} color={colour} />
      </View>

      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardValue, { color: colour }]}>
        {value.toUpperCase()}
      </Text>

      <View style={[styles.trendLine, { backgroundColor: colour }]} />

      <Text style={styles.trendText}>
        Trend: {value === 'high' ? 'Rising ↗' : 'Stable'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F8FC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
  },
  headerBlock: {
    marginBottom: 26,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#36D399',
    marginRight: 8,
  },
  liveText: {
    color: '#1FAE9B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  header: {
    fontSize: 38,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -1,
  },
  subheader: {
    marginTop: 10,
    fontSize: 16,
    color: '#667085',
    lineHeight: 24,
    maxWidth: 330,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#667085',
    marginBottom: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  domainGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '800',
    minHeight: 34,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  trendLine: {
    height: 3,
    borderRadius: 3,
    opacity: 0.55,
    marginTop: 12,
    marginBottom: 8,
  },
  trendText: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '700',
  },
  outlookPanel: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  largeValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1FAE9B',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: '#667085',
    lineHeight: 22,
  },
  gauge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 10,
    borderColor: '#BEEFD0',
    backgroundColor: '#EDFFF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  gaugeValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#168C6E',
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#667085',
  },
  workflowCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 24,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  workflowTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#101828',
  },
  workflowText: {
    color: '#475569',
    lineHeight: 22,
    marginBottom: 6,
    fontSize: 14,
  },
  forecastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewMore: {
    color: '#2F6BFF',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 12,
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  forecastRow: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  forecastDay: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
    color: '#101828',
  },
  forecastText: {
    marginTop: 6,
    fontSize: 18,
    color: '#101828',
    fontWeight: '900',
  },
  forecastRain: {
    marginTop: 4,
    fontSize: 12,
    color: '#667085',
  },
  riskBadge: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '900',
    color: '#D97706',
  },
  bottomGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  escalationPanel: {
    flex: 1,
    backgroundColor: '#FFF7E8',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  escalationValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#D97706',
    marginBottom: 8,
  },
  darkBodyText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  guidancePanel: {
    flex: 1.3,
    backgroundColor: '#EEF5FF',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E5FF',
  },
  guidanceTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2F6BFF',
    marginTop: 8,
    marginBottom: 8,
  },
  guidanceSummary: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  fullGuidanceCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  guidancePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  bullet: {
    color: '#2F6BFF',
    fontSize: 18,
    marginRight: 8,
    lineHeight: 24,
  },
  guidanceText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
});