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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyAlertPreference } from '@/lib/alerts';
import { confirmAction } from '@/lib/confirm';
import {
  type ConsentRecord,
  hasPersonalisedAccess,
  loadConsent,
  setNotificationsOptIn,
  withdrawConsent,
} from '@/lib/consent';
import { loadSelectedChild } from '@/lib/profile';

const APP_KEYS = [
  'authSession',
  'pilotConsent',
  'caregiverProfile',
  'lastRiskResult',
  'prevRiskLevel',
  'lastKnownCoords',
  'householdRisk',
];

type Account = { name: string; email: string };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const [account, setAccount] = useState<Account>({ name: '', email: '' });
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('undetermined');
  const [notificationStatus, setNotificationStatus] = useState<string>('undetermined');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [authRaw, consentRecord, locationPerm, notifPerm] = await Promise.all([
      AsyncStorage.getItem('authSession'),
      loadConsent(),
      Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
    ]);

    if (authRaw) {
      try {
        const parsed = JSON.parse(authRaw);
        setAccount({
          name: parsed.caregiver_name || 'Caregiver',
          email: parsed.email || '',
        });
      } catch {
        setAccount({ name: 'Caregiver', email: '' });
      }
    }

    setConsent(consentRecord);
    setLocationStatus(locationPerm.status);
    setNotificationStatus(notifPerm.status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const granted = hasPersonalisedAccess(consent);

  const toggleNotifications = async (value: boolean) => {
    if (busy) return;

    setBusy(true);

    try {
      const child = await loadSelectedChild();
      const active = await applyAlertPreference(value, child?.name);

      // If the OS permission was refused, the preference cannot be honoured;
      // reflect the real state rather than a checked toggle that does nothing.
      await setNotificationsOptIn(active);

      if (value && !active) {
        await confirmAction(
          'Notifications are blocked',
          'Alerts are turned off in your device settings. Enable notifications for Child Guard to receive risk alerts.',
          'OK'
        );
        await openOSSettings();
      }
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const doWithdrawConsent = async () => {
    const ok = await confirmAction(
      'Withdraw consent?',
      'Personalised features — child profiles, risk assessments, and alerts — will be turned off until you provide consent again.',
      'Withdraw',
      true
    );

    if (!ok) return;

    setBusy(true);

    try {
      await withdrawConsent();
      await applyAlertPreference(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const doDeleteAccount = async () => {
    const ok = await confirmAction(
      'Delete account?',
      'This permanently removes your account, child profile, and consent from this device. This cannot be undone.',
      'Delete',
      true
    );

    if (!ok) return;

    setBusy(true);

    try {
      await applyAlertPreference(false);
      await AsyncStorage.multiRemove(APP_KEYS);
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{account.name || 'Caregiver'}</Text>
            {!!account.email && <Text style={styles.accountEmail}>{account.email}</Text>}
          </View>
        </View>

        <Row
          icon="people-outline"
          label="Manage children"
          onPress={() => router.push('/children')}
          disabled={!granted}
          hint={!granted ? 'Requires consent' : undefined}
        />

        <Row
          icon="create-outline"
          label="Edit child profile"
          onPress={() => router.push('/edit-profile')}
          disabled={!granted}
          hint={!granted ? 'Requires consent' : undefined}
          last
        />
      </View>

      <Text style={styles.sectionLabel}>CONSENT & PRIVACY</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.rowLabel}>Consent status</Text>
            <Text style={styles.rowSub}>
              {granted
                ? `Granted${consent?.accepted_at ? ` · ${formatDate(consent.accepted_at)}` : ''}`
                : 'Not granted — limited access'}
            </Text>
          </View>
          <View style={[styles.badge, granted ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={[styles.badgeText, granted ? styles.badgeTextOk : styles.badgeTextWarn]}>
              {granted ? 'ACTIVE' : 'LIMITED'}
            </Text>
          </View>
        </View>

        <Row
          icon="reader-outline"
          label={granted ? 'Review consent' : 'Provide consent'}
          onPress={() => router.push('/consent')}
        />
        <Row
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => router.push('/legal?doc=privacy')}
        />
        <Row
          icon="document-text-outline"
          label="Terms of Use"
          onPress={() => router.push('/legal?doc=terms')}
        />
        {granted && (
          <Row
            icon="close-circle-outline"
            label="Withdraw consent"
            onPress={doWithdrawConsent}
            danger
            disabled={busy}
            last
          />
        )}
      </View>

      <Text style={styles.sectionLabel}>PERMISSIONS</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Environmental alerts</Text>
            <Text style={styles.rowSub}>
              Daily reminder and high-risk notifications
              {!granted ? ' · requires consent' : ''}
            </Text>
          </View>
          <Switch
            value={granted && !!consent?.notificationsOptIn && notificationStatus === 'granted'}
            onValueChange={toggleNotifications}
            disabled={!granted || busy}
          />
        </View>

        <PermissionRow
          icon="location-outline"
          label="Location"
          status={locationStatus}
          onManage={openOSSettings}
          last
        />
      </View>

      <Text style={styles.sectionLabel}>DANGER ZONE</Text>
      <View style={styles.card}>
        <Row
          icon="trash-outline"
          label="Delete account"
          onPress={doDeleteAccount}
          danger
          disabled={busy}
          last
        />
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
  } catch (err) {
    console.warn('Could not open OS settings:', err);
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Row({
  icon,
  label,
  onPress,
  danger,
  disabled,
  hint,
  last,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, !last && styles.rowDivider, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={22} color={danger ? '#B91C1C' : '#334155'} />
      <Text style={[styles.rowText, danger && styles.rowTextDanger]}>{label}</Text>
      {hint ? (
        <Text style={styles.rowHint}>{hint}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#C3CDDB" />
      )}
    </Pressable>
  );
}

function PermissionRow({
  icon,
  label,
  status,
  onManage,
  last,
}: {
  icon: any;
  label: string;
  status: string;
  onManage: () => void;
  last?: boolean;
}) {
  const granted = status === 'granted';

  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Ionicons name={icon} size={22} color="#334155" />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{label}</Text>
        <Text style={[styles.permStatus, granted ? styles.permOk : styles.permOff]}>
          {granted ? 'Allowed' : status === 'denied' ? 'Blocked' : 'Not set'}
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
  screen: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  container: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -0.8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 22,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCEEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#101828',
  },
  accountEmail: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101828',
  },
  rowSub: {
    fontSize: 12,
    color: '#667085',
    marginTop: 3,
    maxWidth: 220,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeOk: {
    backgroundColor: '#DCFCE7',
  },
  badgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTextOk: {
    color: '#166534',
  },
  badgeTextWarn: {
    color: '#92400E',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  rowTextDanger: {
    color: '#B91C1C',
  },
  rowHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  permStatus: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  permOk: {
    color: '#18A66A',
  },
  permOff: {
    color: '#B45309',
  },
  manageLink: {
    color: '#2F6BFF',
    fontSize: 14,
    fontWeight: '900',
  },
  footer: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});
