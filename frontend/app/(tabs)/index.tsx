import { useEffect, useState } from 'react';
import { Text, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export default function HomeScreen() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [prevRisk, setPrevRisk] = useState<string | null>(null);

const checkRisk = async () => {
  try {
    setLoading(true);

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

const response = await fetch(
  `http://10.27.185.152:8000/environment-risk?lat=${lat}&lon=${lon}&age_group=under5`
);

const data = await response.json();

setResult(data);

// 🚨 Alert when risk becomes HIGH
if (data.priority_alert === "high" && prevRisk !== "high") {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 High Risk Alert',
      body: data.action,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}

// ✅ Alert when risk improves from HIGH
if (prevRisk === "high" && data.priority_alert !== "high") {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Risk Improved',
      body: 'Risk levels have improved. Situation is safer now.',
      sound: true,
    },
    trigger: null,
  });
}

// 🔁 Always update previous risk
setPrevRisk(data.priority_alert);

  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
useEffect(() => {
  // Ask notification permission ONLY once
  Notifications.requestPermissionsAsync();

  // Auto-check immediately when app opens
  checkRisk();

  // Re-check every 5 minutes
  const interval = setInterval(() => {
    checkRisk();
  }, 300000);

  return () => clearInterval(interval);
}, []);

  const riskColour = (risk: string) => {
    if (risk === 'high') return '#FEE2E2';
    if (risk === 'moderate') return '#FEF3C7';
    return '#DCFCE7';
  };

  const riskTextColour = (risk: string) => {
    if (risk === 'high') return '#B91C1C';
    if (risk === 'moderate') return '#92400E';
    return '#166534';
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>Child Risk Intelligence</Text>

      <Text style={styles.title}>Environmental Health Alert</Text>

      <Text style={styles.subtitle}>
        Real-time early warning for child heat stress, respiratory risk and dengue risk.
      </Text>

      <Pressable style={styles.button} onPress={checkRisk}>
        <Text style={styles.buttonText}>
          {loading ? 'Checking...' : 'Check Current Risk'}
        </Text>
      </Pressable>

      {result && (
        <View style={styles.section}>
          <View
            style={[
              styles.priorityCard,
              { backgroundColor: riskColour(result.priority_alert) },
            ]}
          >
            <Text style={styles.cardLabel}>Priority Alert</Text>
            <Text
              style={[
                styles.priorityText,
                { color: riskTextColour(result.priority_alert) },
              ]}
            >
              {result.priority_alert.toUpperCase()}
            </Text>
          </View>

          <View style={styles.grid}>
            <RiskCard title="Heat Stress" value={result.risks.heat_stress} emoji="🔥" />
            <RiskCard title="Respiratory" value={result.risks.respiratory} emoji="🌫️" />
            <RiskCard title="Dengue" value={result.risks.dengue} emoji="🦟" />
          </View>

          <View style={styles.dataCard}>
            <Text style={styles.cardTitle}>Live Environmental Data</Text>
            <Text>Temperature: {result.environment.temperature}°C</Text>
            <Text>Humidity: {result.environment.humidity}%</Text>
            <Text>Rainfall: {result.environment.rainfall} mm</Text>
            <Text>PM2.5: {result.environment.pm2_5}</Text>
          </View>

          <View style={styles.actionCard}>
            <Text style={styles.cardTitle}>Recommended Action</Text>
            <Text style={styles.actionText}>{result.action}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function RiskCard({ title, value, emoji }: any) {
  const colour =
    value === 'high' ? '#FEE2E2' : value === 'moderate' ? '#FEF3C7' : '#DCFCE7';

  const textColour =
    value === 'high' ? '#B91C1C' : value === 'moderate' ? '#92400E' : '#166534';

  return (
    <View style={[styles.riskCard, { backgroundColor: colour }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.riskTitle}>{title}</Text>
      <Text style={[styles.riskValue, { color: textColour }]}>
        {value.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#F8FAFC',
    minHeight: '100%',
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 28,
    lineHeight: 23,
  },
  button: {
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  section: {
    gap: 16,
  },
  priorityCard: {
    padding: 22,
    borderRadius: 24,
  },
  cardLabel: {
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
  },
  priorityText: {
    fontSize: 34,
    fontWeight: '900',
  },
  grid: {
    gap: 12,
  },
  riskCard: {
    padding: 18,
    borderRadius: 22,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  riskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  riskValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900',
  },
  dataCard: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 22,
  },
  actionCard: {
    backgroundColor: '#EFF6FF',
    padding: 18,
    borderRadius: 22,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    color: '#0F172A',
  },
  actionText: {
    color: '#1E3A8A',
    lineHeight: 22,
  },
});