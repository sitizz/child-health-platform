import { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import {
  createChild,
  getChild,
  listChildren,
  selectServerChild,
  updateChild,
} from '@/lib/children-api';
import { routeForGateError } from '@/lib/gate';

const AGE_MIN = 0;
const AGE_MAX = 18;
const MAX_CHILDREN = 10;

type Flags = {
  asthma: boolean;
  fever: boolean;
  cough: boolean;
  dehydration: boolean;
  mosquito_exposure: boolean;
  flood_exposure: boolean;
};

const EMPTY: Flags = {
  asthma: false,
  fever: false,
  cough: false,
  dehydration: false,
  mosquito_exposure: false,
  flood_exposure: false,
};

function parseAge(raw: string): number | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isInteger(n) || n < AGE_MIN || n > AGE_MAX) return null;
  return n;
}

export default function ChildFormScreen() {
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const isEdit = !!childId;

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [flags, setFlags] = useState<Flags>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const child = await getChild(childId!);
        setName(child.name ?? '');
        setAge(String(child.age));
        setFlags({
          asthma: !!child.conditions?.asthma,
          fever: !!child.symptoms?.fever,
          cough: !!child.symptoms?.cough,
          dehydration: !!child.symptoms?.dehydration,
          mosquito_exposure: !!child.exposures?.mosquito_exposure,
          flood_exposure: !!child.exposures?.flood_exposure,
        });
      } catch (err) {
        if (!routeForGateError(err)) {
          setError(err instanceof ApiError ? err.message : 'Unable to load this child.');
        }
      } finally {
        setReady(true);
      }
    })();
  }, [childId, isEdit]);

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

    const payload = {
      name: name.trim(),
      age: ageNumber,
      conditions: { asthma: flags.asthma },
      symptoms: { fever: flags.fever, cough: flags.cough, dehydration: flags.dehydration },
      exposures: { mosquito_exposure: flags.mosquito_exposure, flood_exposure: flags.flood_exposure },
    };

    setBusy(true);
    try {
      if (isEdit) {
        await updateChild(childId!, payload);
        router.back();
        return;
      }

      const existing = await listChildren();
      if (existing.length >= MAX_CHILDREN) {
        setError(`You can add up to ${MAX_CHILDREN} children.`);
        return;
      }

      const created = await createChild(payload);
      await selectServerChild(created.id);
      router.replace('/');
    } catch (err) {
      if (routeForGateError(err)) return;
      if (err instanceof ApiError && err.status === 400) {
        setError(`You can add up to ${MAX_CHILDREN} children.`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Unable to save. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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

      <Text style={styles.title}>{isEdit ? 'Edit Child' : 'Add Child'}</Text>
      <Text style={styles.subtitle}>
        {isEdit
          ? 'Update this child’s details for accurate risk monitoring.'
          : 'Add a child to monitor. You can switch between children anytime.'}
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
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{isEdit ? 'Save Changes' : 'Add Child'}</Text>}
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
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: '#E6EBF2' },
  title: { fontSize: 32, fontWeight: '900', color: '#101828', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: '#667085', lineHeight: 22, marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 22, marginBottom: 16, borderWidth: 1, borderColor: '#E6EBF2' },
  cardTitle: { fontSize: 17, fontWeight: '900', marginBottom: 14, color: '#101828' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 15, color: '#101828' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  flagRowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  flagIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  flagLabel: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  button: { backgroundColor: '#2F6BFF', paddingVertical: 16, borderRadius: 18, marginTop: 6, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94A3B8' },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '900', fontSize: 16 },
});
