import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, fetchEnvironmentRisk } from '@/lib/api';
import { childRiskInput, getSelectedChild } from '@/lib/current-child';
import { routeForGateError } from '@/lib/gate';
import { getCurrentCoords } from '@/lib/location';
import { riskText } from '@/lib/risk';

export default function FullForecastScreen() {
  const insets = useSafeAreaInsets();
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const selected = await getSelectedChild();

      if (!selected) {
        setError('Please add a child profile first.');
        return;
      }

      const { lat, lon } = await getCurrentCoords();
      const result = await fetchEnvironmentRisk(childRiskInput(selected), lat, lon);

      setForecast(result.forecast ?? []);
    } catch (err) {
      if (routeForGateError(err)) return;
      console.error('Full forecast error:', err);

      setError(
        err instanceof ApiError ? err.message : 'Unable to load the forecast.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading full environmental forecast...</Text>
      </View>
    );
  }

  // Previously an error left `forecast` empty and rendered a bare header with no
  // explanation of why the page was blank.
  if (error || !forecast.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
        <Text style={styles.errorTitle}>Forecast unavailable</Text>
        <Text style={styles.loadingText}>{error ?? 'No forecast data was returned.'}</Text>

        <Pressable style={styles.retryButton} onPress={fetchForecast}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>

        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#101828" />
     </Pressable>

      <Text style={styles.header}>Full Environmental Forecast</Text>

      {forecast.map((day: any) => (
        <View key={day.day} style={styles.card}>
          <Text style={styles.day}>Day {day.day}</Text>

          <Text style={styles.temp}>{day.max_temperature}°C</Text>

          <Text style={styles.rain}>{day.rainfall}mm rainfall</Text>

          <Text style={[styles.risk, { color: riskText(day.predicted_risk) }]}>
            {day.predicted_risk?.toUpperCase() ?? 'UNKNOWN'} RISK
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  content: {
    padding: 24,
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
    color: '#667085',
    fontSize: 15,
    textAlign: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5EAF2',
  },
  day: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  temp: {
    color: '#101828',
    fontSize: 32,
    fontWeight: '900',
  },
  rain: {
    color: '#667085',
    fontSize: 15,
    marginTop: 6,
  },
  risk: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 14,
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '900',
    color: '#101828',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2F6BFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 30,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  backLink: {
    marginTop: 14,
    paddingVertical: 8,
  },
  backLinkText: {
    color: '#2F6BFF',
    fontSize: 15,
    fontWeight: '800',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  
});