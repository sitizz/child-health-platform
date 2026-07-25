import { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { ApiError } from '@/lib/api';
import { login } from '@/lib/auth-api';
import { resolveStartRoute } from '@/lib/gate';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      const route = await resolveStartRoute();
      router.replace(route);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect email or password.'
          : err instanceof ApiError
            ? err.message
            : 'Unable to sign in. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark-outline" size={42} color="#2F6BFF" />
        </View>

        <Text style={styles.title}>Welcome to Child Guard</Text>
        <Text style={styles.subtitle}>
          Sign in to access personalised environmental health risk alerts for children.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="caregiver@example.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={onSignIn}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/signup')} disabled={busy}>
            <Text style={styles.linkText}>Create caregiver account</Text>
          </Pressable>
        </View>

        <DisclaimerBanner style={styles.disclaimer} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { flex: 1, padding: 24 },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: { fontSize: 38, fontWeight: '900', color: '#101828', letterSpacing: -1, marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#667085', lineHeight: 24, marginBottom: 28 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  label: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: '#101828',
    marginBottom: 16,
  },
  error: { color: '#B91C1C', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  primaryButton: {
    backgroundColor: '#2F6BFF',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 4,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#94A3B8' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  linkText: {
    color: '#2F6BFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  disclaimer: { marginTop: 24 },
});
