import { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    if (!email || !password) {
      alert('Please enter email and password.');
      return;
    }

    await AsyncStorage.setItem(
      'authSession',
      JSON.stringify({
        logged_in: true,
        email,
        login_type: 'demo',
      })
    );

    const consent = await AsyncStorage.getItem('pilotConsent');

    if (!consent) {
      router.replace('/consent');
      return;
    }

    const profile = await AsyncStorage.getItem('caregiverProfile');

    if (!profile) {
      router.replace('/profile-setup');
      return;
    }

    router.replace('/');
  };

  const demoLogin = async () => {
    await AsyncStorage.setItem(
      'authSession',
      JSON.stringify({
        logged_in: true,
        email: 'demo@childguard.app',
        login_type: 'demo',
      })
    );

    const consent = await AsyncStorage.getItem('pilotConsent');

    if (!consent) {
      router.replace('/consent');
      return;
    }

    const profile = await AsyncStorage.getItem('caregiverProfile');

    if (!profile) {
      router.replace('/profile-setup');
      return;
    }

    router.replace('/');
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

          <Pressable style={styles.primaryButton} onPress={login}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={demoLogin}>
            <Text style={styles.secondaryButtonText}>Continue with Demo Login</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/signup')}>
            <Text style={styles.linkText}>Create caregiver account</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          This platform provides environmental risk guidance only and does not replace medical advice.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#667085',
    lineHeight: 24,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
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
  primaryButton: {
    backgroundColor: '#2F6BFF',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#EEF5FF',
    borderRadius: 18,
    paddingVertical: 15,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#2F6BFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  linkText: {
    color: '#2F6BFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  footerText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 24,
  },
});