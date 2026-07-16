import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { ApiError, fetchEnvironmentRisk } from '@/lib/api';
import { getCurrentCoords, loadSelectedChild } from '@/lib/profile';

export default function RegionalRiskMapScreen() {
  const [region, setRegion] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRegionalRisk = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const selected = await loadSelectedChild();

      if (!selected) {
        setError('Please complete the child profile first.');
        return;
      }

      const { lat, lon } = await getCurrentCoords();

      setRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });

      const samplePoints = [
        { label: 'Current area', lat, lon },
        { label: 'North zone', lat: lat + 0.05, lon },
        { label: 'South zone', lat: lat - 0.05, lon },
        { label: 'East zone', lat, lon: lon + 0.05 },
        { label: 'West zone', lat, lon: lon - 0.05 },
      ];

      const results = await Promise.allSettled(
        samplePoints.map(async (point) => {
          const data = await fetchEnvironmentRisk(selected, point.lat, point.lon);
          const reasons = data.risk_reasons || {};

          return {
            ...point,
            priority_alert: data.priority_alert,
            top_threat: getTopThreat(data.risks),
            reason:
              reasons.heat_stress?.[0] ||
              reasons.respiratory?.[0] ||
              reasons.dengue?.[0] ||
              reasons.flood?.[0] ||
              'No major risk driver detected',
            action: data.action,
          };
        })
      );

      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map((result) => result.value);

      // Every zone failing means the service is unreachable, not that the area
      // is risk-free. Showing an empty map would imply the latter.
      if (!successfulResults.length) {
        const firstRejection = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected'
        );

        throw firstRejection?.reason instanceof ApiError
          ? firstRejection.reason
          : new ApiError(0, 'Unable to load regional risk map.');
      }

      setPoints(successfulResults);
    } catch (err) {
      console.error('Regional map error:', err);

      setError(
        err instanceof ApiError ? err.message : 'Unable to load regional risk map.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegionalRisk();
  }, [loadRegionalRisk]);

  function getTopThreat(risks: any) {
    if (risks.heat_stress === 'high') return 'Heat stress';
    if (risks.respiratory === 'high') return 'Respiratory';
    if (risks.dengue === 'high') return 'Dengue';
    if (risks.flood === 'high') return 'Flood';

    if (risks.heat_stress === 'moderate') return 'Heat stress';
    if (risks.respiratory === 'moderate') return 'Respiratory';
    if (risks.dengue === 'moderate') return 'Dengue';
    if (risks.flood === 'moderate') return 'Flood';

    return 'Low combined risk';
  }

  function riskRank(risk: string) {
    if (risk === 'high') return 3;
    if (risk === 'moderate') return 2;
    return 1;
  }

  function markerColour(risk: string) {
    if (risk === 'high') return 'red';
    if (risk === 'moderate') return 'orange';
    return 'green';
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Building regional risk map...</Text>
      </View>
    );
  }

  // Previously `loading || !region` — once loading finished with no region
  // (denied permission, missing profile), this spun forever with no way out.
  if (error || !region) {
    return (
      <View style={styles.center}>
        <Ionicons name="map-outline" size={44} color="#94A3B8" />
        <Text style={styles.errorTitle}>Regional map unavailable</Text>
        <Text style={styles.loadingText}>{error ?? 'Location is required to build the map.'}</Text>

        <Pressable style={styles.retryButton} onPress={loadRegionalRisk}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
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
            title={`${point.label}: ${point.priority_alert?.toUpperCase() ?? 'UNKNOWN'}`}
            description={`Top threat: ${point.top_threat}. Driver: ${point.reason}`}
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

        <View style={styles.priorityList}>
         <Text style={styles.priorityTitle}>Regional Priority Zones</Text>

         {[...points]
             .sort((a, b) => riskRank(b.priority_alert) - riskRank(a.priority_alert))
             .slice(0, 3)
             .map((point, index) => (
             <View key={index} style={styles.priorityItem}>
                 <Text style={styles.priorityZone}>
                 {index + 1}. {point.label} — {point.priority_alert?.toUpperCase() ?? 'UNKNOWN'}
                 </Text>
                 <Text style={styles.priorityReason}>
                 Driver: {point.reason}
                 </Text>
              </View>
             ))}
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
  priorityList: {
  marginTop: 14,
  borderTopWidth: 1,
  borderTopColor: '#E5E7EB',
  paddingTop: 12,
},

priorityTitle: {
  fontSize: 14,
  fontWeight: '900',
  color: '#111827',
  marginBottom: 8,
},

priorityItem: {
  marginBottom: 8,
},

priorityZone: {
  fontSize: 13,
  fontWeight: '800',
  color: '#111827',
},

priorityReason: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
});