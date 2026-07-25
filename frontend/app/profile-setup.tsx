import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { createChild } from '@/lib/children-api';
import { routeForGateError } from '@/lib/gate';
import { registerPushDevice } from '@/lib/push';

const AGE_MIN = 0;
const AGE_MAX = 18;

type Flags = {
  asthma: boolean;
  fever: boolean;
  cough: boolean;
  dehydration: boolean;
  mosquito_exposure: boolean;
  flood_exposure: boolean;
};

function parseAge(raw: string): number | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isInteger(n) || n < AGE_MIN || n > AGE_MAX) return null;
  return n;
}

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [flags, setFlags] = useState<Flags>({
    asthma: false,
    fever: false,
    cough: false,
    dehydration: false,
    mosquito_exposure: false,
    flood_exposure: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFlag = (key: keyof Flags, value: boolean) => setFlags((p) => ({ ...p, [key]: value }));

  const save = async () => {
    if (busy) return;
    setError(null);

    if (!name.trim()) {
      setError("Please enter the child's name.");
      return;
    }
    const ageNumber = parseAge(age);
    if (ageNumber === null) {
      setError(`Please enter an age between ${AGE_MIN} and ${AGE_MAX}.`);
      return;
    }

    setBusy(true);
    try {
      await createChild({
        name: name.trim(),
        age: ageNumber,
        conditions: { asthma: flags.asthma },
        symptoms: { fever: flags.fever, cough: flags.cough, dehydration: flags.dehydration },
        exposures: { mosquito_exposure: flags.mosquito_exposure, flood_exposure: flags.flood_exposure },
        is_selected: true,
      });

      // Register for push now that consent + a child exist (best effort).
      registerPushDevice().catch(() => {});

      router.replace('/');
    } catch (err) {
      if (routeForGateError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Unable to save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={styles.badge}>Profile Setup</Text>
      <Text style={styles.title}>Add Your Child</Text>
      <Text style={styles.subtitle}>
        This personalises environmental risk guidance. You can add more children later.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Information</Text>
        <TextInput style={styles.input} placeholder="Child name" placeholderTextColor="#94A3B8" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Child age" placeholderTextColor="#94A3B8" value={age} onChangeText={setAge} keyboardType="numeric" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Risk Factors</Text>
        <FlagRow icon="lungs" label="Asthma history" value={flags.asthma} onChange={(v) => setFlag('asthma', v)} />
        <FlagRow icon="thermometer" label="Fever symptoms" value={flags.fever} onChange={(v) => setFlag('fever', v)} />
        <FlagRow icon="weather-windy" label="Cough or wheezing" value={flags.cough} onChange={(v) => setFlag('cough', v)} />
        <FlagRow icon="cup-water" label="Dehydration symptoms" value={flags.dehydration} onChange={(v) => setFlag('dehydration', v)} />
        <FlagRow icon="bug" label="Mosquito exposure" value={flags.mosquito_exposure} onChange={(v) => setFlag('mosquito_exposure', v)} />
        <FlagRow icon="waves-arrow-up" label="Recent flood exposure" value={flags.flood_exposure} onChange={(v) => setFlag('flood_exposure', v)} last />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save & Continue</Text>}
      </Pressable>
    </ScrollView>
  );
}

function FlagRow({ icon, label, value, onChange, last }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[styles.flagRow, !last && styles.flagRowDivider]}>
      <View style={styles.flagIcon}>
        <MaterialCommunityIcons name={icon} size={20} color="#2F6BFF" />
      </View>
      <Text style={styles.flagLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, backgroundColor: '#F8FAFC', minHeight: '100%' },
  badge: { alignSelf: 'center', backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, fontWeight: '700', marginBottom: 16, overflow: 'hidden' },
  title: { fontSize: 30, fontWeight: '900', textAlign: 'center', color: '#0F172A', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#64748B', marginBottom: 28, lineHeight: 23 },
  card: { backgroundColor: 'white', padding: 18, borderRadius: 22, marginBottom: 18, borderWidth: 1, borderColor: '#E6EBF2' },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#0F172A' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 15, color: '#101828' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  flagRowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  flagIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  flagLabel: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  button: { backgroundColor: '#0F172A', paddingVertical: 16, borderRadius: 18, marginTop: 6, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94A3B8' },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '800', fontSize: 16 },
});
