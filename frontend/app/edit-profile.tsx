import { useEffect, useState } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<any>(null);

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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const saved = await AsyncStorage.getItem('caregiverProfile');

    if (!saved) return;

    const parsed = JSON.parse(saved);

    setProfile(parsed);

    const selected = parsed.children.find(
      (child: any) => child.id === parsed.selectedChildId
    );

    setCaregiverName(parsed.caregiver.name || '');
    setCaregiverPhone(parsed.caregiver.phone || '');
    setCaregiverLocation(parsed.caregiver.location || '');

    setChildName(selected.name || '');
    setChildAge(String(selected.age || ''));

    setAsthma(selected.asthma || false);
    setFever(selected.fever || false);
    setCough(selected.cough || false);
    setDehydration(selected.dehydration || false);
    setMosquitoExposure(selected.mosquito_exposure || false);
    setFloodExposure(selected.flood_exposure || false);
  };

  const getAgeGroup = (age: number) => {
    if (age < 5) return 'under5';
    if (age < 12) return 'child';
    return 'adolescent';
  };

  const saveChanges = async () => {
    if (!profile) return;

    const updatedChildren = profile.children.map((child: any) => {
      if (child.id !== profile.selectedChildId) return child;

      return {
        ...child,
        name: childName,
        age: Number(childAge),
        age_group: getAgeGroup(Number(childAge)),
        asthma,
        fever,
        cough,
        dehydration,
        mosquito_exposure: mosquitoExposure,
        flood_exposure: floodExposure,
      };
    });

    const updatedProfile = {
      ...profile,
      caregiver: {
        name: caregiverName,
        phone: caregiverPhone,
        location: caregiverLocation,
      },
      children: updatedChildren,
    };

    await AsyncStorage.setItem(
      'caregiverProfile',
      JSON.stringify(updatedProfile)
    );

    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

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
        />

        <TextInput
          style={styles.input}
          placeholder="Location"
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
          keyboardType="numeric"
          value={childAge}
          onChangeText={setChildAge}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Risk Factors</Text>

        <ProfileRow label="Asthma history" value={asthma} onValueChange={setAsthma} />
        <ProfileRow label="Fever symptoms" value={fever} onValueChange={setFever} />
        <ProfileRow label="Cough or wheezing" value={cough} onValueChange={setCough} />
        <ProfileRow label="Dehydration symptoms" value={dehydration} onValueChange={setDehydration} />
        <ProfileRow label="Mosquito exposure" value={mosquitoExposure} onValueChange={setMosquitoExposure} />
        <ProfileRow label="Flood exposure" value={floodExposure} onValueChange={setFloodExposure} />
      </View>

      <Pressable style={styles.button} onPress={saveChanges}>
        <Text style={styles.buttonText}>Save Changes</Text>
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
    paddingTop: 80,
    backgroundColor: '#F8FAFC',
    minHeight: '100%',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 24,
    textAlign: 'center',
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
    marginBottom: 40,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
});