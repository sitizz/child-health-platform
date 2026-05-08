import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const API_URL = 'https://child-health-platform.onrender.com';

export default function RegionalRiskMapScreen() {
  const [region, setRegion] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegionalRisk();
  }, []);

  async function loadRegionalRisk() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        alert('Location permission is needed to build the regional risk map.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      setRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });

      const samplePoints = [
        { label: 'Current area', lat, lon },
        { label: 'North zone', lat: lat + 0.03, lon },
        { label: 'South zone', lat: lat - 0.03, lon },
        { label: 'East zone', lat, lon: lon + 0.03 },
        { label: 'West zone', lat, lon: lon - 0.03 },
      ];

      const results = await Promise.all(
        samplePoints.map(async point => {
          const response = await fetch(
            `${API_URL}/environment-risk?lat=${point.lat}&lon=${point.lon}&age_group=under5`
          );

          const text = await response.text();

          if (!response.ok) {
            throw new Error(text);
          }

          const data = JSON.parse(text);

          return {
            ...point,
            priority_alert: data.priority_alert,
            top_threat: getTopThreat(data.risks),
            action: data.action,
          };
        })
      );

      setPoints(results);
    } catch (error) {
      console.error('Regional map error:', error);
      alert('Unable to load regional risk map.');
    } finally {
      setLoading(false);
    }
  }

  function getTopThreat(risks: any) {
    if (risks.heat_stress === 'high') return 'Heat stress';
    if (risks.respiratory === 'high') return 'Respiratory';
    if (risks.dengue === 'high') return 'Dengue';

    if (risks.heat_stress === 'moderate') return 'Heat stress';
    if (risks.respiratory === 'moderate') return 'Respiratory';
    if (risks.dengue === 'moderate') return 'Dengue';

    return 'Low combined risk';
  }

  function markerColour(risk: string) {
    if (risk === 'high') return 'red';
    if (risk === 'moderate') return 'orange';
    return 'green';
  }

  if (loading || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Building regional risk map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {points.map((point, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: point.lat,
              longitude: point.lon,
            }}
            pinColor={markerColour(point.priority_alert)}
            title={`${point.label}: ${point.priority_alert.toUpperCase()}`}
            description={`Top threat: ${point.top_threat}`}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.title}>Regional Risk Map</Text>
        <Text style={styles.subtitle}>
          Live location-based climate-health risk intelligence
        </Text>

        <View style={styles.legendRow}>
          <Text style={styles.legend}>Red: High</Text>
          <Text style={styles.legend}>Orange: Moderate</Text>
          <Text style={styles.legend}>Green: Low</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#4B5563',
    fontSize: 15,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 70,
    left: 18,
    right: 18,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 14,
  },
  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legend: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
});