import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { listChildren } from '@/lib/children-api';
import { routeForGateError } from '@/lib/gate';
import {
  acknowledgeDisclaimer,
  type DisclaimerCurrent,
  getDisclaimerCurrent,
} from '@/lib/server-consent';

export default function DisclaimerScreen() {
  const insets = useSafeAreaInsets();
  const [copy, setCopy] = useState<DisclaimerCurrent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getDisclaimerCurrent()
      .then(setCopy)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Unable to load the safety notice.')
      );
  }, []);

  const onAcknowledge = async () => {
    if (busy) return;
    setBusy(true);
    setSubmitError(null);

    try {
      await acknowledgeDisclaimer();
      const children = await listChildren();
      router.replace(children.length ? '/' : '/profile-setup');
    } catch (err) {
      if (routeForGateError(err)) return;
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to continue. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
        <Text style={styles.errorTitle}>{loadError}</Text>
      </View>
    );
  }

  if (!copy) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="medkit-outline" size={38} color="#B91C1C" />
      </View>

      <Text style={styles.title}>Safety Notice</Text>
      <Text style={styles.subtitle}>Please read this before using Child Guard Health.</Text>

      <View style={styles.card}>
        <Text style={styles.body}>{copy.text}</Text>
      </View>

      {submitError && <Text style={styles.error}>{submitError}</Text>}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={onAcknowledge}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>I Understand &amp; Continue</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  container: { paddingHorizontal: 24 },
  errorTitle: { fontSize: 17, fontWeight: '800', color: '#101828', textAlign: 'center' },
  iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#101828', letterSpacing: -0.8, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#667085', lineHeight: 24, marginBottom: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#E6EBF2' },
  body: { fontSize: 15, color: '#334155', lineHeight: 24 },
  error: { color: '#B91C1C', fontSize: 13, fontWeight: '700', marginTop: 14 },
  button: { marginTop: 20, backgroundColor: '#2F6BFF', borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94A3B8' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
});
