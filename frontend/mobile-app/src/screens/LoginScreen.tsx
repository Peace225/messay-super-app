import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar, // 👈 CORRECTION : Ajout de l'import
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore'; 
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setUser, setTokens, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      const timeout = setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs requis', 'Veuillez entrer vos identifiants.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login({ email, password });
      
      if (result.user && result.accessToken) {
        await setTokens(result.accessToken, result.refreshToken);
        await setUser(result.user);
      } else {
        Alert.alert('Erreur', 'Réponse du serveur incomplète.');
      }
    } catch (error: any) {
      Alert.alert('Échec', error.response?.data?.error || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0f172a', '#1e293b', '#0f172a']} style={StyleSheet.absoluteFill} />
      
      {/* Éléments décoratifs Premium */}
      <View style={styles.topLight} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.innerContainer}
      >
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <LinearGradient colors={['#FF8C00', '#FF6B35']} style={styles.logoCircle}>
              <Ionicons name="flash" size={45} color="#fff" />
            </LinearGradient>
            <View style={styles.logoShadow} />
          </View>
          <Text style={styles.title}>MESSAY</Text>
          <Text style={styles.subtitle}>L'excellence au service de la mobilité</Text>
        </View>

        <View style={styles.glassCard}>
          <Text style={styles.label}>Adresse Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#94a3b8" />
            <TextInput
              style={styles.input}
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#64748b"
            />
          </View>

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                size={22} 
                color="#94a3b8" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin} 
            disabled={loading}
          >
            <LinearGradient 
              colors={['#FF8C00', '#FF6B35']} 
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>SE CONNECTER</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" style={{marginLeft: 10}} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.footerBtn} onPress={() => router.push('/register')}>
          <Text style={styles.footerText}>
            Nouveau sur Messay ? <Text style={styles.footerLink}>Créer un compte</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topLight: {
    position: 'absolute',
    top: -height * 0.1,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: '#FF6B35',
    borderRadius: width,
    opacity: 0.1,
    transform: [{ scaleX: 2 }],
  },
  innerContainer: { flex: 1, padding: 30, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 50 },
  logoContainer: { marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { 
    width: 90, 
    height: 90, 
    borderRadius: 30, // Design plus moderne (Squircle)
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 2,
    elevation: 10,
  },
  logoShadow: {
    position: 'absolute',
    bottom: -10,
    width: 70,
    height: 20,
    backgroundColor: '#FF6B35',
    borderRadius: 35,
    opacity: 0.3,
    filter: 'blur(10px)',
  },
  title: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 65,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  input: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 15, fontWeight: '600' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 30 },
  forgotText: { color: '#FF6B35', fontSize: 13, fontWeight: '700' },
  button: { height: 65, borderRadius: 20, overflow: 'hidden', elevation: 15, shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 10 },
  buttonGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  footerBtn: { marginTop: 40, alignItems: 'center' },
  footerText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  footerLink: { color: '#fff', fontWeight: '900', textDecorationLine: 'underline' },
});