import { useState } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ConsentScreen() {
  const [accepted, setAccepted] = useState(false);

  const continueToProfile = async () => {
    if (!accepted) {
      alert('Please confirm consent before continuing.');
      return;
    }

    await AsyncStorage.setItem(
      'pilotConsent',
      JSON.stringify({
        accepted: true,
        accepted_at: new Date().toISOString(),
        version: 'demo-pilot-v1',
      })
    );

    const profile = await AsyncStorage.getItem('caregiverProfile');

    if (!profile) {
      router.replace('/profile-setup');
      return;
    }

    router.replace('/');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="document-text-outline" size={38} color="#2F6BFF" />
      </View>

      <Text style={styles.title}>Consent & Safety Notice</Text>

      <Text style={styles.subtitle}>
        Please review this information before using Child Guard for child environmental health monitoring.
      </Text>

      <View style={styles.card}>
        <NoticeItem
          title="Environmental guidance only"
          text="Child Guard provides environmental risk guidance based on weather, air quality, rainfall, and child profile information. It does not diagnose, treat, or replace medical advice."
        />

        <NoticeItem
          title="Emergency care"
          text="If a child has breathing difficulty, severe dehydration, persistent fever, confusion, or appears seriously unwell, seek urgent medical care immediately."
        />

        <NoticeItem
          title="Child profile data"
          text="The app uses caregiver-entered child information such as age group, asthma history, cough, fever, dehydration, mosquito exposure, and flood exposure to personalise risk guidance."
        />

        <NoticeItem
          title="Location and environmental data"
          text="The app uses device location to retrieve local weather and air quality information from external environmental data providers."
        />

        <NoticeItem
          title="Pilot limitation"
          text="This is an early pilot prototype. Risk thresholds and recommendations should be reviewed with public health, clinical, and school stakeholders before real-world deployment."
        />
      </View>

      <View style={styles.consentBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.consentTitle}>I understand and agree</Text>
          <Text style={styles.consentText}>
            I confirm that I am a caregiver or authorised user, and I consent to using this app for environmental risk guidance only.
          </Text>
        </View>

        <Switch value={accepted} onValueChange={setAccepted} />
      </View>

      <Pressable
        style={[styles.button, !accepted && styles.buttonDisabled]}
        onPress={continueToProfile}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

function NoticeItem({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.noticeItem}>
      <View style={styles.bulletDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  container: {
    padding: 24,
    paddingTop: 78,
    paddingBottom: 120,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#667085',
    lineHeight: 24,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 18,
  },
  noticeItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2F6BFF',
    marginTop: 6,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#667085',
    lineHeight: 21,
  },
  consentBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 4,
  },
  consentText: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 19,
  },
  button: {
    backgroundColor: '#2F6BFF',
    borderRadius: 20,
    paddingVertical: 17,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
});