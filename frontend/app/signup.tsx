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

import { ApiError } from '@/lib/api';
import { register } from '@/lib/auth-api';
import { resolveStartRoute } from '@/lib/gate';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    if (busy) return;
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      const route = await resolveStartRoute();
      router.replace(route);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'An account with this email already exists. Try signing in.'
          : err instanceof ApiError && err.status === 422
            ? 'Please use a valid email and a stronger password (letters, a number and a symbol).'
            : err instanceof ApiError
              ? err.message
              : 'Unable to create your account. Please try again.'
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
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#101828" />
        </Pressable>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Set up a caregiver account to continue to consent and child profile setup.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Caregiver Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

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
            placeholder="At least 8 characters"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={onCreate}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Your information is stored securely on the Child Guard service and used only to
          personalise environmental health guidance.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { flex: 1, padding: 24 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E6EBF2',
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
  footerText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 24,
  },
});
