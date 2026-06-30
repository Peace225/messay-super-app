import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
  StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore'; 
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, setUser, setTokens, isAuthenticated, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const timer = setTimeout(() => handleRedirect(user.role), 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, authLoading]);

  const handleRedirect = (role) => {
    if (role === 'CHAUFFEUR') router.replace('/chauffeur-dashboard');
    else if (role === 'CONDUCTEUR') router.replace('/conducteur-dashboard');
    else router.replace('/home'); 
  };

  const handleLogin = async () => {
    if (!telephone.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez entrer votre numéro et votre mot de passe.');
      return;
    }
    let cleanPhone = telephone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('225')) cleanPhone = cleanPhone.substring(3);
    const formattedTelephone = `+225${cleanPhone}`;

    setLoading(true);
    try {
      const result = await authService.login({ telephone: formattedTelephone, password });
      if (result.user && result.accessToken) {
        await setTokens(result.accessToken, result.refreshToken);
        await setUser(result.user);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error;
      if (!error.response) {
        Alert.alert('Erreur Réseau', 'Le serveur est injoignable. Vérifie que ton PC et ton iPhone sont sur le même Wi-Fi.');
      } else {
        Alert.alert('Échec', errorMsg || 'Identifiants incorrects.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#050810', '#0f172a', '#050810']} style={StyleSheet.absoluteFill} />
      
      {/* Premium glows */}
      <View style={[styles.glow, { backgroundColor: '#FF8C00', top: -120, left: -80 }]} />
      <View style={[styles.glow, { backgroundColor: '#6366f1', bottom: -100, right: -70 }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <LinearGradient colors={['#FF8C00', '#ff6a00']} style={styles.logo}>
                <Ionicons name="flash" size={42} color="#fff" />
              </LinearGradient>
              <View style={styles.logoHalo} />
            </View>
            <Text style={styles.brand}>MESSAY</Text>
            <Text style={styles.tagline}>L'EXCELLENCE EN MOUVEMENT</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop} />
            
            <Text style={styles.welcome}>Bon retour</Text>
            <Text style={styles.welcomeSub}>Connectez-vous à votre espace</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View style={[styles.inputBox, telephone && styles.inputFocus]}>
                <View style={styles.iconBox}>
                  <Ionicons name="call" size={18} color="#FF8C00" />
                </View>
                <Text style={styles.prefix}>+225</Text>
                <View style={styles.sep} />
                <TextInput 
                  style={styles.input} 
                  placeholder="07 00 00" 
                  placeholderTextColor="#475569"
                  value={telephone} 
                  onChangeText={setTelephone} 
                  keyboardType="phone-pad" 
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={[styles.inputBox, password && styles.inputFocus]}>
                <View style={styles.iconBox}>
                  <Ionicons name="lock-closed" size={18} color="#FF8C00" />
                </View>
                <TextInput 
                  style={[styles.input, {flex:1}]} 
                  placeholder="••••••••" 
                  placeholderTextColor="#475569"
                  value={password} 
                  onChangeText={setPassword} 
                  secureTextEntry={!showPassword} 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.linkLeft}>Créer un compte</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Infos", "Contactez le support.")}>
                <Text style={styles.linkRight}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.9} style={styles.btnWrap}>
              <LinearGradient colors={['#FF8C00', '#ff6a00']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.btn}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.btnContent}>
                    <Text style={styles.btnText}>SE CONNECTER</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secure}>
              <Ionicons name="shield-checkmark" size={13} color="#22c55e" />
              <Text style={styles.secureText}>Connexion sécurisée SSL</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050810' },
  glow: { position: 'absolute', width: width*0.85, height: width*0.85, borderRadius: 999, opacity: 0.14 },
  scroll: { paddingHorizontal: 24, paddingTop: height*0.09, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  
  header: { alignItems: 'center', marginBottom: 40 },
  logoWrap: { position: 'relative' },
  logo: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF8C00', shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  logoHalo: { position: 'absolute', width: 110, height: 110, borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,140,0,0.18)', top: -11, left: -11 },
  brand: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: 6, marginTop: 18 },
  tagline: { fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: '700', letterSpacing: 1.5 },
  
  card: { backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 30, padding: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF8C00', opacity: 0.5, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  welcome: { color: '#fff', fontSize: 24, fontWeight: '800' },
  welcomeSub: { color: '#64748b', fontSize: 14, marginTop: 4, marginBottom: 26 },
  
  field: { marginBottom: 18 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 9, letterSpacing: 0.6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: '#1e293b', paddingHorizontal: 4 },
  inputFocus: { borderColor: '#FF8C00', backgroundColor: 'rgba(255,140,0,0.04)' },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,140,0,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  prefix: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 12 },
  sep: { width: 1, height: 24, backgroundColor: '#1e293b', marginHorizontal: 12 },
  input: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500' },
  
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 28 },
  linkLeft: { color: '#fff', fontSize: 13, fontWeight: '700' },
  linkRight: { color: '#FF8C00', fontSize: 13, fontWeight: '700' },
  
  btnWrap: { borderRadius: 16, overflow: 'hidden', shadowColor: '#FF8C00', shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  btn: { height: 58, justifyContent: 'center', alignItems: 'center' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  
  secure: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  secureText: { color: '#64748b', fontSize: 11 },
});