import { useCallback, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { type Caregiver, fetchMe, logout } from '@/lib/auth-api';
import { confirmAction } from '@/lib/confirm';
import { registerPushDevice } from '@/lib/push';
import { routeForGateError } from '@/lib/gate';
import {
  type ConsentStatus,
  type DisclaimerStatus,
  getConsentStatus,
  getDisclaimerStatus,
  withdrawConsent,
} from '@/lib/server-consent';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [disclaimer, setDisclaimer] = useState<DisclaimerStatus | null>(null);
  const [locationStatus, setLocationStatus] = useState('undetermined');
  const [notificationStatus, setNotificationStatus] = useState('undetermined');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [me, cs, ds, locPerm, notifPerm] = await Promise.all([
        fetchMe(),
        getConsentStatus(),
        getDisclaimerStatus(),
        Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' })),
        Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      ]);
      setCaregiver(me);
      setConsent(cs);
      setDisclaimer(ds);
      setLocationStatus(locPerm.status);
      setNotificationStatus(notifPerm.status);
    } catch (err) {
      routeForGateError(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const granted = !!consent?.accepted && !!disclaimer?.acknowledged;

  const toggleNotifications = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (value) {
        const ok = await registerPushDevice();
        if (!ok) {
          await confirmAction(
            'Notifications unavailable',
            'Enable notifications for Child Guard in your device settings to receive alerts.',
            'OK'
          );
          await openOSSettings();
        }
      }
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    const ok = await confirmAction(
      'Withdraw consent?',
      'Personalised features will be turned off until you provide consent again.',
      'Withdraw',
      true
    );
    if (!ok) return;

    setBusy(true);
    try {
      await withdrawConsent();
      router.replace('/consent');
    } catch (err) {
      if (!routeForGateError(err)) {
        await confirmAction('Could not withdraw', err instanceof ApiError ? err.message : 'Please try again.', 'OK');
      }
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    const ok = await confirmAction('Sign out?', 'You will need to sign in again to access your children and alerts.', 'Sign Out', true);
    if (!ok) return;

    setBusy(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#101828" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color="#2F6B9A" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.accountName} numberOfLines={1}>{caregiver?.name ?? '—'}</Text>
            {!!caregiver?.email && <Text style={styles.accountEmail} numberOfLines={1}>{caregiver.email}</Text>}
          </View>
        </View>
        <Row icon="people-outline" label="Manage children" onPress={() => router.push('/children')} last />
      </View>

      <Text style={styles.sectionLabel}>CONSENT & PRIVACY</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Consent & safety notice</Text>
            <Text style={styles.rowSub}>
              {granted ? 'Accepted' : 'Action needed'}
              {consent?.accepted_at ? ` · ${formatDate(consent.accepted_at)}` : ''}
            </Text>
          </View>
          <View style={[styles.badge, granted ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={[styles.badgeText, granted ? styles.badgeTextOk : styles.badgeTextWarn]}>
              {granted ? 'ACTIVE' : 'REVIEW'}
            </Text>
          </View>
        </View>
        <Row icon="reader-outline" label={granted ? 'Review consent' : 'Provide consent'} onPress={() => router.push('/consent')} />
        <Row icon="shield-outline" label="Privacy Policy" onPress={() => router.push('/legal?doc=privacy')} />
        <Row icon="document-text-outline" label="Terms of Use" onPress={() => router.push('/legal?doc=terms')} />
        {granted && <Row icon="close-circle-outline" label="Withdraw consent" onPress={doWithdraw} danger disabled={busy} last />}
      </View>

      <Text style={styles.sectionLabel}>PERMISSIONS</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowSub}>Risk alerts from Child Guard</Text>
          </View>
          <Switch
            value={notificationStatus === 'granted' && !!consent?.notifications_opt_in}
            onValueChange={toggleNotifications}
            disabled={busy}
          />
        </View>
        <PermissionRow icon="location-outline" label="Location" status={locationStatus} onManage={openOSSettings} last />
      </View>

      <Text style={styles.sectionLabel}>SESSION</Text>
      <View style={styles.card}>
        <Row icon="log-out-outline" label="Sign out" onPress={doLogout} danger disabled={busy} last />
      </View>

      <Text style={styles.footer}>
        Child Guard Health provides environmental guidance only and does not replace medical advice.
      </Text>
    </ScrollView>
  );
}

async function openOSSettings() {
  if (Platform.OS === 'web') return;
  try {
    await Linking.openSettings();
  } catch {
    // ignore
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function Row({ icon, label, onPress, danger, disabled, last }: { icon: any; label: string; onPress: () => void; danger?: boolean; disabled?: boolean; last?: boolean }) {
  return (
    <Pressable style={[styles.row, !last && styles.rowDivider, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={22} color={danger ? '#B91C1C' : '#334155'} />
      <Text style={[styles.rowText, danger && styles.rowTextDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#C3CDDB" />
    </Pressable>
  );
}

function PermissionRow({ icon, label, status, onManage, last }: { icon: any; label: string; status: string; onManage: () => void; last?: boolean }) {
  const ok = status === 'granted';
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Ionicons name={icon} size={22} color="#334155" />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{label}</Text>
        <Text style={[styles.permStatus, ok ? styles.permOk : styles.permOff]}>
          {ok ? 'Allowed' : status === 'denied' ? 'Blocked' : 'Not set'}
        </Text>
      </View>
      {Platform.OS !== 'web' && (
        <Pressable onPress={onManage} hitSlop={8}>
          <Text style={styles.manageLink}>Manage</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  container: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6EBF2' },
  title: { fontSize: 30, fontWeight: '900', color: '#101828', letterSpacing: -0.8 },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E6EBF2', marginBottom: 22 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#DCEEFF', alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 18, fontWeight: '900', color: '#101828' },
  accountEmail: { fontSize: 13, color: '#667085', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  rowLabel: { fontSize: 15, fontWeight: '800', color: '#101828' },
  rowSub: { fontSize: 12, color: '#667085', marginTop: 3 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeTextOk: { color: '#166534' },
  badgeTextWarn: { color: '#92400E' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#334155' },
  rowTextDanger: { color: '#B91C1C' },
  permStatus: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  permOk: { color: '#18A66A' },
  permOff: { color: '#B45309' },
  manageLink: { color: '#2F6BFF', fontSize: 14, fontWeight: '900' },
  footer: { fontSize: 12, color: '#94A3B8', lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
