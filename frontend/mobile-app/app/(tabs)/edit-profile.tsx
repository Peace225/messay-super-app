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
import { useAuthStore } from '../../src/store/authStore'; // Vérifie bien ce chemin selon ton dossier
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function EditProfileScreen() {
  const router = useRouter();
  
  // On récupère l'utilisateur et la fonction de mise à jour depuis le store
  const { user, updateUser } = useAuthStore();

  // États locaux initialisés avec les données actuelles de l'utilisateur
  const [nom, setNom] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [telephone, setTelephone] = useState(user?.telephone || '');
  const [loading, setLoading] = useState(false);

  // Fonction de sauvegarde
  const handleUpdate = async () => {
    // Validation simple
    if (!nom.trim() || !prenom.trim() || !telephone.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir toutes les informations essentielles.');
      return;
    }

    setLoading(true);
    
    try {
      // On met à jour le store (qui met à jour AsyncStorage automatiquement)
      await updateUser({
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
      });

      // Simulation d'un petit délai pour l'effet "Premium"
      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Profil mis à jour', 
          'Vos informations ont été enregistrées avec succès ! ✨',
          [{ text: 'Parfait', onPress: () => router.back() }]
        );
      }, 800);

    } catch (error) {
      setLoading(false);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications. Réessayez plus tard.');
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* HEADER ELITE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Édition du Profil</Text>
        <View style={{ width: 40 }} /> {/* Équilibreur pour le centrage */}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Identité & Contact</Text>
            
            {/* CHAMP NOM */}
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
                />
              </View>
            </View>

            {/* CHAMP PRÉNOM */}
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
                />
              </View>
            </View>

            {/* CHAMP TÉLÉPHONE */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="phone-alt" size={14} color="#FF6B35" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={telephone}
                  onChangeText={setTelephone}
                  keyboardType="phone-pad"
                  placeholder="+225 00 00 00 00 00"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* CHAMP EMAIL (VERROUILLÉ) */}
            <View style={[styles.inputGroup, { opacity: 0.7 }]}>
              <Text style={styles.inputLabel}>Adresse Email (Sécurisée)</Text>
              <View style={[styles.inputWrapper, { backgroundColor: '#f1f5f9', borderColor: 'transparent' }]}>
                <Ionicons name="mail" size={16} color="#94a3b8" style={styles.inputIcon} />
                <Text style={styles.readOnlyText}>{user?.email}</Text>
                <Ionicons name="lock-closed" size={12} color="#cbd5e1" style={{marginLeft: 'auto'}} />
              </View>
            </View>
          </View>

          {/* BOUTON DE SAUVEGARDE ANIMÉ */}
          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={handleUpdate}
            disabled={loading}
          >
            <LinearGradient 
              colors={['#FF6B35', '#FF8E64']} 
              start={{x:0, y:0}} 
              end={{x:1, y:0}} 
              style={styles.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.btnText}>Enregistrer l'excellence</Text>
                  <Ionicons name="checkmark-done" size={20} color="white" style={{marginLeft: 10}} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Vos données sont protégées par le système de sécurité MESSAY.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', letterSpacing: -0.5 },
  scrollContent: { padding: 25 },
  formSection: { marginBottom: 30 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 25 },
  inputGroup: { marginBottom: 22 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    height: 65,
  },
  inputIcon: { width: 30 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  readOnlyText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  saveBtn: { 
    borderRadius: 22, 
    overflow: 'hidden', 
    elevation: 8, 
    shadowColor: '#FF6B35', 
    shadowOpacity: 0.3, 
    shadowRadius: 15, 
    marginTop: 10 
  },
  btnGradient: { padding: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  disclaimer: { 
    textAlign: 'center', 
    marginTop: 30, 
    color: '#cbd5e1', 
    fontSize: 12, 
    fontWeight: '500' 
  },
});