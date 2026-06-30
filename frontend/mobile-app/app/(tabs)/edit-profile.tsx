import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [nom, setNom] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [telephone, setTelephone] = useState(user?.telephone || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!nom.trim() || !prenom.trim() || !telephone.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir toutes les informations.');
      return;
    }

    setLoading(true);
    
    try {
      await updateUser({
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
      });

      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Profil mis à jour', 
          'Vos informations ont été enregistrées !',
          [{ text: 'Parfait', onPress: () => router.back() }]
        );
      }, 800);

    } catch (error) {
      setLoading(false);
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  };

  return (
    <SafeAreaView style={styles.mainWrapper} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Édition du Profil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Identité & Contact</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom de famille</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="user" size={14} color="#FF6B35" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Votre nom"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prénom(s)</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="id-card" size={14} color="#FF6B35" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={prenom}
                  onChangeText={setPrenom}
                  placeholder="Votre prénom"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="phone-alt" size={14} color="#FF6B35" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={telephone}
                  onChangeText={setTelephone}
                  keyboardType="phone-pad"
                  placeholder="+225 00 00 00"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, styles.disabledGroup]}>
              <Text style={styles.inputLabel}>Adresse Email (Sécurisée)</Text>
              <View style={[styles.inputWrapper, styles.readOnlyWrapper]}>
                <Ionicons name="mail" size={16} color="#94a3b8" style={styles.inputIcon} />
                <Text style={styles.readOnlyText} numberOfLines={1}>
                  {user?.email || ''}
                </Text>
                <View style={styles.lockIcon}>
                  <Ionicons name="lock-closed" size={12} color="#cbd5e1" />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={handleUpdate}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient 
              colors={['#FF6B35', '#FF8E64']} 
              start={{x:0, y:0}} 
              end={{x:1, y:0}} 
              style={styles.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Enregistrer</Text>
                  <Ionicons name="checkmark-done" size={20} color="white" style={styles.btnIcon} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Vos données sont protégées par MESSAY
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  mainWrapper: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 44 },
  scrollContent: { 
    padding: 24,
    paddingBottom: 40,
  },
  formSection: { 
    marginBottom: 24 
  },
  sectionLabel: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 20 
  },
  inputGroup: { 
    marginBottom: 20 
  },
  disabledGroup: {
    opacity: 0.7,
  },
  inputLabel: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#475569', 
    marginBottom: 8, 
    marginLeft: 4 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 58,
  },
  readOnlyWrapper: {
    backgroundColor: '#F1F5F9',
    borderColor: 'transparent',
  },
  inputIcon: { 
    marginRight: 12,
    width: 20,
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#1e293b',
    paddingVertical: 0,
  },
  readOnlyText: { 
    flex: 1,
    fontSize: 15, 
    fontWeight: '500', 
    color: '#64748b' 
  },
  lockIcon: {
    marginLeft: 8,
  },
  saveBtn: { 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginTop: 8,
    elevation: 4,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  btnGradient: { 
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnIcon: {
    marginLeft: 8,
  },
  disclaimer: { 
    textAlign: 'center', 
    marginTop: 24, 
    color: '#CBD5E1', 
    fontSize: 11, 
    fontWeight: '500',
    lineHeight: 16,
  },
});