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

export default function SignupScreen() {
  const [caregiverName, setCaregiverName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const createAccount = async () => {
    if (!caregiverName || !email || !password) {
      alert('Please complete all required fields.');
      return;
    }

    await AsyncStorage.setItem(
      'authSession',
      JSON.stringify({
        logged_in: true,
        caregiver_name: caregiverName,
        email,
        login_type: 'demo_signup',
      })
    );

    router.replace('/consent');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
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
            value={caregiverName}
            onChangeText={setCaregiverName}
          />

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
            placeholder="Create password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.primaryButton} onPress={createAccount}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          For pilot use, account details are stored locally on this device until a secure authentication system is connected.
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
    paddingTop: 70,
  },
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
  footerText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 24,
  },
});