import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    const { nom, prenom, email, telephone, password, confirmPassword } = formData;

    if (!nom.trim() || !prenom.trim() || !email.trim() || !telephone.trim() || !password) {
      Alert.alert('Champs requis', 'Veuillez remplir toutes vos informations pour continuer.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur de sécurité', 'Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mot de passe faible', 'Votre mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    // 🛡️ LE NETTOYEUR DE NUMÉRO INFAILLIBLE
    // 1. On garde uniquement les chiffres
    let cleanPhone = telephone.replace(/[^0-9]/g, '');
    
    // 2. Si le numéro commence par 225, on l'enlève pour ne garder que les 10 chiffres (ex: 07...)
    if (cleanPhone.startsWith('225')) {
      cleanPhone = cleanPhone.substring(3);
    }

    // 3. On vérifie qu'il reste bien 10 chiffres (Format Côte d'Ivoire)
    if (cleanPhone.length !== 10) {
      Alert.alert(
        'Numéro invalide', 
        `Le numéro doit contenir exactement 10 chiffres.\nVous avez tapé ${cleanPhone.length} chiffres.`
      );
      return;
    }

    // 4. On crée le format PARFAIT exigé par ton backend
    const formattedTelephone = `+225${cleanPhone}`;

    setLoading(true);
    try {
      await authService.register({
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
        telephone: formattedTelephone, // 👈 On envoie le numéro parfait (+2250700000000)
        password,
        role: 'USER',
      });

      Alert.alert('Bienvenue ! ✨', 'Votre compte MESSAY a été créé avec succès.', [
        { 
          text: 'Continuer', 
          onPress: () => router.replace('/login')
        }
      ]);
    } catch (error: any) {
      // Nettoyage de l'erreur JSON pour afficher un beau message
      let errorMessage = "Erreur lors de l'inscription";
      const backendError = error.response?.data?.error;
      
      if (Array.isArray(backendError) && backendError.length > 0) {
        errorMessage = backendError[0].message;
      } else if (typeof backendError === 'string') {
        errorMessage = backendError;
      }
      
      Alert.alert('Attention', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0f172a', '#1e293b', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={styles.topLight} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.innerContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <LinearGradient colors={['#FF8C00', '#FF6B35']} style={styles.logoCircle}>
                <Ionicons name="person-add" size={32} color="#fff" />
              </LinearGradient>
              <View style={styles.logoShadow} />
            </View>
            <Text style={styles.title}>MESSAY</Text>
            <Text style={styles.subtitle}>Rejoignez l{"'"}élite de la logistique</Text>
          </View>

          <View style={styles.glassCard}>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Nom</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#94a3b8" />
                  <TextInput
                    style={styles.input}
                    placeholder="Doe"
                    value={formData.nom}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, nom: text }))}
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <View style={styles.halfInput}>
                <Text style={styles.label}>Prénom</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="John"
                    value={formData.prenom}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, prenom: text }))}
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Adresse Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#94a3b8" />
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#64748b"
              />
            </View>

            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#94a3b8" />
              <Text style={styles.indicatif}>+225</Text>
              <View style={styles.verticalDivider} />
              <TextInput
                style={[styles.input, { marginLeft: 0 }]}
                placeholder="0700000000"
                value={formData.telephone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, telephone: text }))}
                keyboardType="phone-pad"
                placeholderTextColor="#64748b"
                maxLength={10}
              />
            </View>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Créer un mot de passe"
                value={formData.password}
                onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                secureTextEntry={!showPassword}
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#94a3b8" />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Confirmer le mot de passe"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
              <LinearGradient colors={['#FF8C00', '#FF6B35']} style={styles.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.buttonText}>CRÉER MON COMPTE</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginLeft: 10}} />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.footerBtn} onPress={() => router.back()}>
            <Text style={styles.footerText}>
              Déjà membre Élite ? <Text style={styles.footerLink}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topLight: { position: 'absolute', top: -height * 0.05, right: -width * 0.2, width: width * 0.8, height: width * 0.8, backgroundColor: '#FF6B35', borderRadius: width, opacity: 0.15, filter: 'blur(40px)' },
  innerContainer: { flex: 1 },
  scrollContent: { padding: 25, paddingTop: 50, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: 30 },
  logoContainer: { marginBottom: 15, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoCircle: { width: 70, height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 2, elevation: 10 },
  logoShadow: { position: 'absolute', bottom: -5, width: 50, height: 15, backgroundColor: '#FF6B35', borderRadius: 25, opacity: 0.4 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  glassCard: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 30, padding: 22, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 8, marginLeft: 5, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 18, paddingHorizontal: 15, height: 60, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  input: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 12, fontWeight: '600' },
  indicatif: { color: '#fff', fontSize: 15, fontWeight: '800', marginLeft: 10 },
  verticalDivider: { width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12 },
  button: { height: 60, borderRadius: 18, overflow: 'hidden', elevation: 15, shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 10, marginTop: 10 },
  buttonGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  footerBtn: { marginTop: 30, alignItems: 'center' },
  footerText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  footerLink: { color: '#fff', fontWeight: '900', textDecorationLine: 'underline' },
});