import { View, Text, StyleSheet } from 'react-native';

export default function RegionalRiskMapWebScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Regional Risk Map</Text>

      <Text style={styles.subtitle}>
        The interactive map is available on the mobile app. This web preview focuses on dashboard and intelligence features.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 600,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 420,
  },
});