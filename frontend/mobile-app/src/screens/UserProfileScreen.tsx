import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function UserProfileScreen() {
  const router = useRouter();
  const [nom, setNom] = useState('Kouhame');
  const [prenom, setPrenom] = useState('Ievin');
  const [phone, setPhone] = useState('0789663926');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#7C3AED', '#8B5CF6']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Mon profil</Text>
            <TouchableOpacity onPress={() => Alert.alert('Sauvegardé')}>
              <Text style={styles.save}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.avatarBox}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>KI</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput value={nom} onChangeText={setNom} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Prénom</Text>
            <TextInput value={prenom} onChangeText={setPrenom} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 40 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  save: { color: '#FFF', fontWeight: '700' },
  avatarBox: { alignItems: 'center', marginTop: 20 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarTxt: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  content: { flex: 1, marginTop: -20, paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  field: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  input: { fontSize: 16, fontWeight: '600', color: '#111827', padding: 0 },
});