import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
  ScrollView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({ telephone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    const { telephone, password, confirmPassword } = formData;
    if (!telephone.trim() || !password || !confirmPassword) {
      Alert.alert('Champs requis', 'Veuillez remplir toutes les informations.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Sécurité', 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    let cleanPhone = telephone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('225')) cleanPhone = cleanPhone.substring(3);
    if (cleanPhone.length !== 10) {
      Alert.alert('Erreur numéro', 'Le numéro doit comporter exactement 10 chiffres.');
      return;
    }
    const formattedTelephone = `+225${cleanPhone}`;
    const generatedEmail = `${cleanPhone}@messay.ci`;

    setLoading(true);
    try {
      // ✅ On garde authService, on enlève OTP
      await authService.register({
        nom: `Membre ${cleanPhone}`,
        email: generatedEmail,
        telephone: formattedTelephone,
        password,
        role: 'USER',
      });
      
      Alert.alert('Compte créé ! 🎉', 'Votre compte a été enregistré avec succès.', [
        { text: 'Se connecter', onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || "Impossible de créer le compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#050810', '#0f172a', '#050810']} style={StyleSheet.absoluteFill} />
      
      <View style={[styles.glow, { backgroundColor: '#FF8C00', top: -120, right: -80 }]} />
      <View style={[styles.glow, { backgroundColor: '#6366f1', bottom: -100, left: -70 }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <LinearGradient colors={['#FF8C00', '#ff6a00', '#FF8C00']} style={styles.logo}>
                <Ionicons name="shield-checkmark" size={38} color="#fff" />
              </LinearGradient>
              <View style={styles.logoRing} />
            </View>
            <Text style={styles.brand}>MESSAY</Text>
            <View style={styles.badge}>
              <Ionicons name="diamond" size={12} color="#FF8C00" />
              <Text style={styles.badgeText}>INSCRIPTION PREMIUM</Text>
            </View>
          </View>

          <View style={styles.card}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardBorder} />
            
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Créer votre accès</Text>
              <Text style={styles.cardSub}>30 secondes • 100% sécurisé</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Numéro mobile</Text>
              <View style={[styles.inputBox, formData.telephone && styles.inputActive]}>
                <View style={styles.iconBox}>
                  <Ionicons name="call" size={18} color="#FF8C00" />
                </View>
                <Text style={styles.prefix}>+225</Text>
                <View style={styles.sep} />
                <TextInput
                  style={styles.input}
                  placeholder="07 00 00 00 00"
                  placeholderTextColor="#475569"
                  value={formData.telephone}
                  onChangeText={(t) => setFormData(p => ({...p, telephone: t}))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={[styles.inputBox, formData.password && styles.inputActive]}>
                <View style={styles.iconBox}>
                  <Ionicons name="lock-closed" size={18} color="#FF8C00" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(t) => setFormData(p => ({...p, password: t}))}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirmation</Text>
              <View style={[styles.inputBox, formData.confirmPassword && styles.inputActive]}>
                <View style={styles.iconBox}>
                  <Ionicons name="shield-checkmark" size={18} color="#FF8C00" />
                </View>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={formData.confirmPassword}
                  onChangeText={(t) => setFormData(p => ({...p, confirmPassword: t}))}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.9} style={styles.ctaWrap}>
              <LinearGradient colors={['#FF8C00', '#ff6a00']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.cta}>
                <View style={styles.ctaInner}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="rocket" size={20} color="#fff" />
                      <Text style={styles.ctaText}>ACTIVER MON COMPTE</Text>
                      <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.trust}>
              <Ionicons name="lock-closed" size={12} color="#22c55e" />
              <Text style={styles.trustText}>Chiffrement SSL • Données protégées</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.back()} style={styles.login}>
            <Text style={styles.loginText}>Déjà membre ? <Text style={styles.loginAccent}>Se connecter</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050810' },
  glow: { position: 'absolute', width: width*0.8, height: width*0.8, borderRadius: 999, opacity: 0.15 },
  scroll: { paddingHorizontal: 24, paddingTop: height*0.07, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoWrap: { position: 'relative', marginBottom: 16 },
  logo: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF8C00', shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  logoRing: { position: 'absolute', width: 104, height: 104, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,140,0,0.2)', top: -10, left: -10 },
  brand: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(255,140,0,0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,140,0,0.2)' },
  badgeText: { color: '#FF8C00', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  card: { backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 32, padding: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  cardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  cardHeader: { marginBottom: 24 },
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cardSub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  field: { marginBottom: 18 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9, marginLeft: 4 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', borderRadius: 16, height: 58, paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#1e293b' },
  inputActive: { borderColor: '#FF8C00', backgroundColor: 'rgba(255,140,0,0.03)' },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,140,0,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  prefix: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 12 },
  sep: { width: 1, height: 24, backgroundColor: '#1e293b', marginHorizontal: 12 },
  input: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500' },
  eye: { padding: 10 },
  ctaWrap: { marginTop: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#FF8C00', shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  cta: { height: 58 },
  ctaInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  trustText: { color: '#64748b', fontSize: 11 },
  login: { marginTop: 28, alignItems: 'center' },
  loginText: { color: '#64748b', fontSize: 14 },
  loginAccent: { color: '#FF8C00', fontWeight: '800' },
});