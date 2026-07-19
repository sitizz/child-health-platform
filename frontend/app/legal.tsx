import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Doc = { title: string; intro: string; sections: { heading: string; body: string }[] };

const DOCS: Record<'privacy' | 'terms', Doc> = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This is a pilot summary of how Child Guard Health handles your information. A full legal Privacy Policy will be provided before public release.',
    sections: [
      {
        heading: 'Information we collect',
        body: 'Account details (name, email), your child’s profile (age, health conditions, optional symptoms), your device location when permitted, and device information needed for notifications and app functionality.',
      },
      {
        heading: 'How we use it',
        body: 'To generate personalised environmental health recommendations, deliver alerts and notifications, improve the platform, and support public health research using anonymised or aggregated data where appropriate.',
      },
      {
        heading: 'Storage during the pilot',
        body: 'In this pilot build, your profile and consent are stored locally on your device. Environmental risk requests are sent to the Child Guard service to return local risk guidance.',
      },
      {
        heading: 'Your rights',
        body: 'You may access and update your information, delete your account, withdraw consent at any time, and manage location and notification permissions from the Settings screen.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro:
      'This is a pilot summary of the terms for using Child Guard Health. Full Terms of Use will be provided before public release.',
    sections: [
      {
        heading: 'Guidance only',
        body: 'Child Guard Health provides environmental health guidance and preventive recommendations only. It does not diagnose conditions, replace healthcare professionals, prescribe treatment, or provide emergency medical services.',
      },
      {
        heading: 'Seek medical care when needed',
        body: 'If your child develops severe symptoms or you are concerned about their health, seek advice from a qualified healthcare professional or contact your local emergency services immediately.',
      },
      {
        heading: 'Appropriate use',
        body: 'You confirm that you are the child’s parent, legal guardian, or authorised caregiver, and that the information you provide is accurate to the best of your knowledge.',
      },
      {
        heading: 'Pilot limitation',
        body: 'This is an early pilot prototype. Risk thresholds and recommendations should be reviewed with public health, clinical, and school stakeholders before real-world deployment.',
      },
    ],
  },
};

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const content = doc === 'terms' ? DOCS.terms : DOCS.privacy;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color="#101828" />
      </Pressable>

      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.intro}>{content.intro}</Text>

      {content.sections.map((section) => (
        <View key={section.heading} style={styles.card}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  container: {
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  intro: {
    fontSize: 15,
    color: '#667085',
    lineHeight: 23,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  heading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
});
