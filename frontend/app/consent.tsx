import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { logout } from '@/lib/auth-api';
import { routeForGateError } from '@/lib/gate';
import {
  acceptConsent,
  type ConsentCheckboxes,
  type ConsentCurrent,
  getConsentCurrent,
} from '@/lib/server-consent';

const CHECKBOX_LABELS: Record<string, string> = {
  caregiver_authority: "I confirm that I am the child's parent, legal guardian, or authorised caregiver.",
  read_understood: 'I have read and understood the information above.',
  not_diagnostic:
    'I understand that Child Guard Health provides environmental health guidance and is not a diagnostic, treatment, or emergency medical service.',
  data_processing:
    "I consent to the collection and processing of my personal information and my child's information for the purposes described above.",
  location: 'I consent to the use of my location to provide personalised environmental health recommendations.',
  notifications_opt_in: 'I agree to receive environmental alerts and notifications.',
};

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const [copy, setCopy] = useState<ConsentCurrent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getConsentCurrent()
      .then(setCopy)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Unable to load the consent notice.')
      );
  }, []);

  const toggle = (key: string) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const allRequiredChecked = !!copy && copy.required_checkboxes.every((k) => checked[k]);

  const onAccept = async () => {
    if (!copy || !allRequiredChecked || busy) return;
    setBusy(true);
    setSubmitError(null);

    try {
      const checkboxes: ConsentCheckboxes = {
        caregiver_authority: !!checked.caregiver_authority,
        read_understood: !!checked.read_understood,
        not_diagnostic: !!checked.not_diagnostic,
        data_processing: !!checked.data_processing,
        location: !!checked.location,
        notifications_opt_in: !!checked.notifications_opt_in,
      };

      await acceptConsent(checkboxes);

      // Ask for location now, per the consent the user just gave (best effort).
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {
        // A denial does not undo consent; risk checks re-prompt later.
      }

      router.replace('/disclaimer');
    } catch (err) {
      if (routeForGateError(err)) return;
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to save consent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await logout();
    router.replace('/login');
  };

  if (loadError) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
        <Text style={styles.errorTitle}>{loadError}</Text>
        <Pressable style={styles.retry} onPress={() => { setLoadError(null); getConsentCurrent().then(setCopy).catch((e) => setLoadError(e.message)); }}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
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

  const orderedKeys = [...copy.required_checkboxes, ...copy.optional_checkboxes];

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

      <Text style={styles.title}>{copy.title}</Text>
      {!!copy.subtitle && <Text style={styles.tagline}>{copy.subtitle}</Text>}

      {!!copy.about && (
        <Section title="About Child Guard Health">
          <Paragraph>{copy.about}</Paragraph>
        </Section>
      )}

      {copy.information_we_collect?.length > 0 && (
        <Section title="Information We Collect">
          {copy.information_we_collect.map((item, i) => <Bullet key={i}>{item}</Bullet>)}
        </Section>
      )}

      {copy.how_information_is_used?.length > 0 && (
        <Section title="How Your Information Is Used">
          {copy.how_information_is_used.map((item, i) => <Bullet key={i}>{item}</Bullet>)}
        </Section>
      )}

      {!!copy.medical_disclaimer && (
        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}>
            <Ionicons name="medkit-outline" size={20} color="#B91C1C" />
            <Text style={styles.disclaimerTitle}>Important Medical Disclaimer</Text>
          </View>
          <Paragraph>{copy.medical_disclaimer}</Paragraph>
        </View>
      )}

      {!!copy.privacy && (
        <Section title="Your Privacy">
          <Paragraph>{copy.privacy}</Paragraph>
        </Section>
      )}

      <Text style={styles.consentHeading}>Consent</Text>
      <Text style={styles.consentIntro}>Before continuing, please confirm the following:</Text>

      <View style={styles.checkboxCard}>
        {orderedKeys.map((key, i) => {
          const optional = copy.optional_checkboxes.includes(key);
          return (
            <CheckboxRow
              key={key}
              checked={!!checked[key]}
              onToggle={() => toggle(key)}
              label={CHECKBOX_LABELS[key] ?? key}
              optional={optional}
              last={i === orderedKeys.length - 1}
            />
          );
        })}
      </View>

      {(!!copy.privacy_policy_url || !!copy.terms_url) && (
        <Text style={styles.legalLine}>
          By selecting Agree &amp; Continue, you acknowledge the{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal?doc=privacy')}>
            Privacy Policy
          </Text>{' '}
          and{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal?doc=terms')}>
            Terms of Use
          </Text>
          .
        </Text>
      )}

      {!allRequiredChecked && (
        <Text style={styles.requiredHint}>
          Please confirm all required items above. Notifications are optional.
        </Text>
      )}
      {submitError && <Text style={styles.requiredHint}>{submitError}</Text>}

      <Pressable
        style={[styles.button, (!allRequiredChecked || busy) && styles.buttonDisabled]}
        onPress={onAccept}
        disabled={!allRequiredChecked || busy}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Agree &amp; Continue</Text>}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onSignOut} disabled={busy}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
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
function CheckboxRow({ checked, onToggle, label, optional, last }: { checked: boolean; onToggle: () => void; label: string; optional?: boolean; last?: boolean }) {
  return (
    <Pressable style={[styles.checkRow, !last && styles.checkRowDivider]} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
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
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  container: { paddingHorizontal: 24 },
  errorTitle: { fontSize: 17, fontWeight: '800', color: '#101828', textAlign: 'center' },
  retry: { backgroundColor: '#2F6BFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 28 },
  retryText: { color: '#FFFFFF', fontWeight: '900' },
  iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: '#101828', letterSpacing: -0.8, marginBottom: 6 },
  tagline: { fontSize: 16, fontWeight: '700', color: '#2F6BFF', marginBottom: 8 },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#101828', marginBottom: 10 },
  paragraph: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2F6BFF', marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 21 },
  disclaimerCard: { marginTop: 22, backgroundColor: '#FEF2F2', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FCA5A5' },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  disclaimerTitle: { fontSize: 16, fontWeight: '900', color: '#B91C1C' },
  consentHeading: { marginTop: 28, fontSize: 22, fontWeight: '900', color: '#101828' },
  consentIntro: { marginTop: 6, marginBottom: 14, fontSize: 14, color: '#667085' },
  checkboxCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E6EBF2' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  checkRowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#2F6BFF', borderColor: '#2F6BFF' },
  checkLabel: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 21, fontWeight: '600' },
  optionalTag: { color: '#94A3B8', fontWeight: '700' },
  legalLine: { marginTop: 18, fontSize: 13, color: '#667085', lineHeight: 20 },
  legalLink: { color: '#2F6BFF', fontWeight: '800' },
  requiredHint: { marginTop: 14, fontSize: 13, color: '#B45309', fontWeight: '700', lineHeight: 18 },
  button: { marginTop: 18, backgroundColor: '#2F6BFF', borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94A3B8' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  secondaryButton: { marginTop: 12, borderRadius: 18, paddingVertical: 15, borderWidth: 1.5, borderColor: '#D0D9E6' },
  secondaryButtonText: { color: '#475569', fontSize: 15, fontWeight: '900', textAlign: 'center' },
});
