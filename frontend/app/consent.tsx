import { useState } from 'react';
import { Text, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyAlertPreference } from '@/lib/alerts';
import {
  allRequiredConfirmed,
  type ConsentConfirmations,
  EMPTY_CONFIRMATIONS,
  saveConsentDeclined,
  saveConsentGranted,
} from '@/lib/consent';
import { loadSelectedChild } from '@/lib/profile';

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();

  const [confirmations, setConfirmations] = useState<ConsentConfirmations>(EMPTY_CONFIRMATIONS);
  const [notificationsOptIn, setNotificationsOptIn] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (key: keyof ConsentConfirmations) =>
    setConfirmations((prev) => ({ ...prev, [key]: !prev[key] }));

  const canContinue = allRequiredConfirmed(confirmations);

  const agreeAndContinue = async () => {
    if (!canContinue || busy) return;

    setBusy(true);

    try {
      await saveConsentGranted(confirmations, notificationsOptIn);

      // Per the spec, OS permissions are requested only after the user agrees.
      // A denial does not undo the recorded consent; the app re-prompts when the
      // feature is next used.
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch (err) {
        console.warn('Location permission request skipped:', err);
      }

      if (notificationsOptIn) {
        const child = await loadSelectedChild();
        await applyAlertPreference(true, child?.name);
      }

      const child = await loadSelectedChild();
      router.replace(child ? '/' : '/profile-setup');
    } finally {
      setBusy(false);
    }
  };

  const continueWithLimitedAccess = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await saveConsentDeclined();
      // Ensure no alerts remain scheduled from a previous granted session.
      await applyAlertPreference(false);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  if (declined) {
    return (
      <View style={[styles.screen, styles.declineWrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed-outline" size={38} color="#B45309" />
        </View>

        <Text style={styles.title}>Consent Required</Text>

        <Text style={styles.declineBody}>
          Personalised features, including child profiles, environmental risk assessments, and
          alerts, require your consent. You may continue using limited features or return later to
          provide consent.
        </Text>

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={continueWithLimitedAccess}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Continue with Limited Access</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => setDeclined(false)} disabled={busy}>
          <Text style={styles.secondaryButtonText}>Review Consent Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="shield-checkmark-outline" size={38} color="#2F6BFF" />
      </View>

      <Text style={styles.title}>Welcome to Child Guard Health</Text>
      <Text style={styles.tagline}>Smarter Signals. Safer Children.</Text>

      <Section title="About Child Guard Health">
        <Paragraph>
          Child Guard Health (CG Health) is an AI-powered environmental intelligence platform
          designed to help caregivers better understand climate-related environmental health risks
          affecting children.
        </Paragraph>
        <Paragraph>
          By combining environmental information with your child&apos;s profile, CG Health provides
          personalised insights, early warnings, and preventive recommendations to support informed
          decisions before health risks escalate.
        </Paragraph>
      </Section>

      <Section title="Information We Collect">
        <Bullet>Your account information (e.g. name and email address)</Bullet>
        <Bullet>Your child&apos;s profile (e.g. age, existing health conditions, and optional symptoms)</Bullet>
        <Bullet>Your location (with your permission) to provide local environmental information</Bullet>
        <Bullet>Device information required for notifications and app functionality</Bullet>
      </Section>

      <Section title="How Your Information Is Used">
        <Bullet>Generate personalised environmental health recommendations</Bullet>
        <Bullet>Deliver environmental alerts and notifications</Bullet>
        <Bullet>Improve platform performance and user experience</Bullet>
        <Bullet>Support future research and public health initiatives using anonymised or aggregated data where appropriate</Bullet>
      </Section>

      <View style={styles.disclaimerCard}>
        <View style={styles.disclaimerHeader}>
          <Ionicons name="medkit-outline" size={20} color="#B91C1C" />
          <Text style={styles.disclaimerTitle}>Important Medical Disclaimer</Text>
        </View>
        <Paragraph>
          Child Guard Health provides environmental health guidance and preventive recommendations
          only. The platform does not diagnose medical conditions, replace healthcare professionals,
          prescribe treatment or medication, or provide emergency medical services.
        </Paragraph>
        <Paragraph>
          If your child develops severe symptoms or you are concerned about their health, please
          seek advice from a qualified healthcare professional or contact your local emergency
          services immediately.
        </Paragraph>
      </View>

      <Section title="Your Privacy">
        <Paragraph>
          We are committed to protecting your information through responsible data practices and
          secure systems. You may:
        </Paragraph>
        <Bullet>Access and update your information</Bullet>
        <Bullet>Delete your account</Bullet>
        <Bullet>Withdraw your consent at any time</Bullet>
        <Bullet>Manage location and notification permissions in Settings</Bullet>
      </Section>

      <Text style={styles.consentHeading}>Consent</Text>
      <Text style={styles.consentIntro}>Before continuing, please confirm the following:</Text>

      <View style={styles.checkboxCard}>
        <CheckboxRow
          checked={confirmations.guardian}
          onToggle={() => toggle('guardian')}
          label="I confirm that I am the child's parent, legal guardian, or authorised caregiver."
        />
        <CheckboxRow
          checked={confirmations.read}
          onToggle={() => toggle('read')}
          label="I have read and understood the information above."
        />
        <CheckboxRow
          checked={confirmations.notMedical}
          onToggle={() => toggle('notMedical')}
          label="I understand that Child Guard Health provides environmental health guidance and is not a diagnostic, treatment, or emergency medical service."
        />
        <CheckboxRow
          checked={confirmations.dataProcessing}
          onToggle={() => toggle('dataProcessing')}
          label="I consent to the collection and processing of my personal information and my child's information for the purposes described above."
        />
        <CheckboxRow
          checked={confirmations.location}
          onToggle={() => toggle('location')}
          label="I consent to the use of my location to provide personalised environmental health recommendations."
        />
        <CheckboxRow
          checked={notificationsOptIn}
          onToggle={() => setNotificationsOptIn((v) => !v)}
          label="I agree to receive environmental alerts and notifications."
          optional
          last
        />
      </View>

      <Text style={styles.legalLine}>
        By selecting Agree &amp; Continue, you acknowledge that you have read and agree to the{' '}
        <Text style={styles.legalLink} onPress={() => router.push('/legal?doc=privacy')}>
          Privacy Policy
        </Text>{' '}
        and{' '}
        <Text style={styles.legalLink} onPress={() => router.push('/legal?doc=terms')}>
          Terms of Use
        </Text>
        .
      </Text>

      {!canContinue && (
        <Text style={styles.requiredHint}>
          Please confirm all required items above to continue. Notifications are optional.
        </Text>
      )}

      <Pressable
        style={[styles.button, (!canContinue || busy) && styles.buttonDisabled]}
        onPress={agreeAndContinue}
        disabled={!canContinue || busy}
      >
        <Text style={styles.buttonText}>Agree &amp; Continue</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => setDeclined(true)} disabled={busy}>
        <Text style={styles.secondaryButtonText}>Decline</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  label,
  optional,
  last,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  optional?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.checkRow, !last && styles.checkRowDivider]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
      <Text style={styles.checkLabel}>
        {label}
        {optional && <Text style={styles.optionalTag}>  (optional)</Text>}
      </Text>
    </Pressable>
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
  declineWrap: {
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2F6BFF',
    marginBottom: 8,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2F6BFF',
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
  },
  disclaimerCard: {
    marginTop: 22,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B91C1C',
  },
  consentHeading: {
    marginTop: 28,
    fontSize: 22,
    fontWeight: '900',
    color: '#101828',
  },
  consentIntro: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 14,
    color: '#667085',
  },
  checkboxCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 16,
  },
  checkRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#2F6BFF',
    borderColor: '#2F6BFF',
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    fontWeight: '600',
  },
  optionalTag: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  legalLine: {
    marginTop: 18,
    fontSize: 13,
    color: '#667085',
    lineHeight: 20,
  },
  legalLink: {
    color: '#2F6BFF',
    fontWeight: '800',
  },
  requiredHint: {
    marginTop: 14,
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
    lineHeight: 18,
  },
  button: {
    marginTop: 18,
    backgroundColor: '#2F6BFF',
    borderRadius: 18,
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
  secondaryButton: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: '#D0D9E6',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  declineBody: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 25,
    marginBottom: 12,
  },
});
