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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AGE_MAX,
  AGE_MIN,
  findSelectedChild,
  getAgeGroup,
  loadProfile as loadCaregiverProfile,
  parseAge,
} from '@/lib/profile';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
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
    const parsed = await loadCaregiverProfile();

    if (!parsed) return;

    setProfile(parsed);

    // find() returns undefined when selectedChildId does not match any child,
    // which previously crashed on selected.name below.
    const selected = findSelectedChild(parsed);

    setCaregiverName(parsed.caregiver?.name || '');
    setCaregiverPhone(parsed.caregiver?.phone || '');
    setCaregiverLocation(parsed.caregiver?.location || '');

    if (!selected) return;

    setChildName(selected.name || '');
    setChildAge(String(selected.age ?? ''));

    setAsthma(selected.asthma || false);
    setFever(selected.fever || false);
    setCough(selected.cough || false);
    setDehydration(selected.dehydration || false);
    setMosquitoExposure(selected.mosquito_exposure || false);
    setFloodExposure(selected.flood_exposure || false);
  };

  const saveChanges = async () => {
    if (!profile) return;

    if (!caregiverName.trim() || !childName.trim()) {
      alert('Please add both a caregiver name and a child name.');
      return;
    }

    const ageNumber = parseAge(childAge);

    if (ageNumber === null) {
      alert(`Please enter the child's age as a whole number between ${AGE_MIN} and ${AGE_MAX}.`);
      return;
    }

    const selected = findSelectedChild(profile);

    const updatedChildren = profile.children.map((child: any) => {
      if (child.id !== selected?.id) return child;

      return {
        ...child,
        name: childName,
        age: ageNumber,
        age_group: getAgeGroup(ageNumber),
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
  <ScrollView
    style={styles.screen}
    contentContainerStyle={[
      styles.container,
      { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 100 },
    ]}
  >
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color="#101828" />
      </Pressable>

      <Text style={styles.title}>Edit Profile</Text>
      <Text style={styles.subtitle}>
        Update caregiver and child details for accurate risk monitoring.
      </Text>
    </View>

    <View style={styles.darkCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="person-outline" size={20} color="#4EA1FF" />
        <Text style={styles.blueSectionTitle}>CAREGIVER INFORMATION</Text>
      </View>

      <ProfileInput
        icon="person-outline"
        label="Name"
        value={caregiverName}
        onChangeText={setCaregiverName}
        placeholder="Caregiver name"
      />

      <ProfileInput
        icon="call-outline"
        label="Phone Number"
        value={caregiverPhone}
        onChangeText={setCaregiverPhone}
        placeholder="Phone number"
        keyboardType="phone-pad"
      />

      <ProfileInput
        icon="location-outline"
        label="Location"
        value={caregiverLocation}
        onChangeText={setCaregiverLocation}
        placeholder="Location"
      />
    </View>

    <View style={styles.childCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="person-outline" size={20} color="#5EE7A8" />
        <Text style={styles.greenSectionTitle}>CHILD INFORMATION</Text>
      </View>

      <ProfileInput
        icon="person-outline"
        label="Child Name / Initial"
        value={childName}
        onChangeText={setChildName}
        placeholder="Child name"
      />

      <ProfileInput
        icon="calendar-outline"
        label="Age"
        value={childAge}
        onChangeText={setChildAge}
        placeholder="Child age"
        keyboardType="numeric"
      />
    </View>

    <View style={styles.riskCard}>
      <View style={styles.riskHeaderRow}>
        <View>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pulse" size={20} color="#7C5CFF" />
            <Text style={styles.purpleSectionTitle}>RISK FACTORS</Text>
          </View>
          <Text style={styles.helperText}>
            Select all that apply to improve risk analysis.
          </Text>
        </View>

      </View>

      <ProfileRow icon="stethoscope" label="Asthma history" value={asthma} onValueChange={setAsthma} />
      <ProfileRow icon="thermometer" label="Fever symptoms" value={fever} onValueChange={setFever} />
      <ProfileRow icon="weather-windy" label="Cough or wheezing" value={cough} onValueChange={setCough} />
      <ProfileRow icon="water-outline" label="Dehydration symptoms" value={dehydration} onValueChange={setDehydration} />
      <ProfileRow icon="ladybug" label="Mosquito exposure" value={mosquitoExposure} onValueChange={setMosquitoExposure} />
      <ProfileRow icon="waves-arrow-up" label="Flood exposure" value={floodExposure} onValueChange={setFloodExposure} />
    </View>

    <Pressable style={styles.saveButton} onPress={saveChanges}>
      <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />
      <Text style={styles.saveButtonText}>Save Changes</Text>
      <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
    </Pressable>
  </ScrollView>
);
}

function ProfileInput({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: any) {
  return (
    <View style={styles.inputShell}>
      <Ionicons name={icon} size={24} color="#4EA1FF" />
      <View style={{ flex: 1 }}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#7A8496"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

function ProfileRow({ icon, label, value, onValueChange }: any) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.rowLeft}>
        <View style={styles.riskIconBox}>
          <MaterialCommunityIcons name={icon} size={22} color="#4EA1FF" />
        </View>
        <Text style={styles.profileLabel}>{label}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#556070', true: '#1FAE9B' }}
        thumbColor="#FFFFFF"
      />
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
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#667085',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    maxWidth: 330,
  },
  darkCard: {
    backgroundColor: '#101C2E',
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  childCard: {
    backgroundColor: '#101C2E',
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E6B55',
    position: 'relative',
    overflow: 'hidden',
  },
  riskCard: {
    backgroundColor: '#101C2E',
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#302B63',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  blueSectionTitle: {
    color: '#4EA1FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  greenSectionTitle: {
    color: '#5EE7A8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  purpleSectionTitle: {
    color: '#7C5CFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#26384F',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#9AA8BA',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 2,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  helperText: {
    color: '#9AA8BA',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#22334A',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  riskIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#182A43',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#2F6BFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
});