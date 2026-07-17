import { useState } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AGE_MAX, AGE_MIN, getAgeGroup, parseAge } from '@/lib/profile';

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [caregiverLocation, setCaregiverLocation] = useState('');

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');

  const [asthma, setAsthma] = useState(false);
  const [fever, setFever] = useState(false);
  const [cough, setCough] = useState(false);
  const [dehydration, setDehydration] = useState(false);
  const [mosquitoExposure, setMosquitoExposure] = useState(false);
  const [floodExposure, setFloodExposure] = useState(false);

  const saveProfile = async () => {
    if (!caregiverName.trim() || !childName.trim() || !childAge.trim()) {
      alert('Please add caregiver name, child name, and child age.');
      return;
    }

    // Number('abc') is NaN, which previously fell through getAgeGroup to
    // 'adolescent' and risk-scored a toddler as a teenager.
    const ageNumber = parseAge(childAge);

    if (ageNumber === null) {
      alert(`Please enter the child's age as a whole number between ${AGE_MIN} and ${AGE_MAX}.`);
      return;
    }

    const childId = Date.now().toString();

    const profile = {
      caregiver: {
        name: caregiverName,
        phone: caregiverPhone,
        location: caregiverLocation,
      },
      children: [
        {
          id: childId,
          name: childName,
          age: ageNumber,
          age_group: getAgeGroup(ageNumber),
          asthma,
          fever,
          cough,
          dehydration,
          mosquito_exposure: mosquitoExposure,
          flood_exposure: floodExposure,
        },
      ],
      selectedChildId: childId,
      profile_completed: true,
    };

    await AsyncStorage.setItem('caregiverProfile', JSON.stringify(profile));

    router.replace('/');
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={styles.badge}>Profile Setup</Text>

      <Text style={styles.title}>Create Caregiver & Child Profile</Text>

      <Text style={styles.subtitle}>
        This helps personalise alerts for the right child while keeping the app ready for multiple children later.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Caregiver Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Caregiver name"
          value={caregiverName}
          onChangeText={setCaregiverName}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone number"
          value={caregiverPhone}
          onChangeText={setCaregiverPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Location / area"
          value={caregiverLocation}
          onChangeText={setCaregiverLocation}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Child name"
          value={childName}
          onChangeText={setChildName}
        />

        <TextInput
          style={styles.input}
          placeholder="Child age"
          value={childAge}
          onChangeText={setChildAge}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Risk Factors</Text>

        <ProfileRow label="Asthma history" value={asthma} onValueChange={setAsthma} />
        <ProfileRow label="Fever symptoms" value={fever} onValueChange={setFever} />
        <ProfileRow label="Cough or wheezing" value={cough} onValueChange={setCough} />
        <ProfileRow label="Dehydration symptoms" value={dehydration} onValueChange={setDehydration} />
        <ProfileRow label="Mosquito exposure" value={mosquitoExposure} onValueChange={setMosquitoExposure} />
        <ProfileRow label="Recent flood exposure" value={floodExposure} onValueChange={setFloodExposure} />
      </View>

      <Pressable style={styles.button} onPress={saveProfile}>
        <Text style={styles.buttonText}>Save Profile & Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProfileRow({ label, value, onValueChange }: any) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#F8FAFC',
    minHeight: '100%',
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 28,
    lineHeight: 23,
  },
  card: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 22,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    color: '#0F172A',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  profileLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  button: {
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 6,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
});