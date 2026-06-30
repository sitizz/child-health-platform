import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://child-health-platform.onrender.com';

export default function FullForecastScreen() {
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecast();
  }, []);

  async function fetchForecast() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        alert('Location permission is needed to load forecast.');
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
      setForecast(result.forecast || []);
      } catch (error) {
        console.error('Full forecast error:', error);
      } finally {
        setLoading(false);
      }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading full environmental forecast...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Full Environmental Forecast</Text>

      {forecast.map((day: any) => (
        <View key={day.day} style={styles.card}>
          <Text style={styles.day}>Day {day.day}</Text>

          <Text style={styles.temp}>{day.max_temperature}°C</Text>

          <Text style={styles.rain}>{day.rainfall}mm rainfall</Text>

          <Text style={styles.risk}>
            {day.predicted_risk?.toUpperCase()} RISK
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
    paddingTop: 70,
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
    color: '#D97706',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 14,
  },
});