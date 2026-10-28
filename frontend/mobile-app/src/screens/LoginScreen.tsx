
import { useCallback, useEffect, useRef, useState } from 'react';

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
  StatusBar,
  ScrollView,
} from 'react-native';

import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

// ============================================================
// MESSAY MOBILE - ÉCRAN DE CONNEXION
// ============================================================

const { width, height } = Dimensions.get('window');

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

// ============================================================
// NORMALISATION DU TÉLÉPHONE
// ============================================================

function normalizeTelephone(value: string): string | null {
  let digits = value.replace(/\D/g, '');

  // Exemple : 2250700000000 -> 0700000000
  if (digits.startsWith('225') && digits.length === 13) {
    digits = digits.slice(3);
  }

  // Numéro ivoirien : 10 chiffres
  if (!/^\d{10}$/.test(digits)) {
    return null;
  }

  return `+225${digits}`;
}

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

export default function LoginScreen() {
  const router = useRouter();

  // ----------------------------------------------------------
  // ÉTATS LOCAUX
  // ----------------------------------------------------------

  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Empêche les doubles soumissions immédiates
  const submittingRef = useRef(false);

  // ----------------------------------------------------------
  // STORE D'AUTHENTIFICATION
  // ----------------------------------------------------------

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuthStore();

  const isBusy = loading || authLoading;

  // ==========================================================
  // REDIRECTION SELON LE RÔLE
  // ==========================================================

  const handleRedirect = useCallback(
    (role: string): void => {
      switch (role) {
        case 'CHAUFFEUR':
          router.replace('/chauffeur-dashboard');
          break;

        case 'CONDUCTEUR':
          router.replace('/conducteur-dashboard');
          break;

        case 'USER':
        case 'ADMIN':
        case 'PARTENAIRE':
        case 'VENDEUR':
        default:
          router.replace('/home');
          break;
      }
    },
    [router]
  );

  // ==========================================================
  // REDIRECTION AUTOMATIQUE APRÈS CONNEXION
  // ==========================================================

  useEffect(() => {
    if (
      authLoading ||
      !isAuthenticated ||
      !user
    ) {
      return;
    }

    const timer = setTimeout(() => {
      handleRedirect(user.role);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [
    authLoading,
    isAuthenticated,
    user,
    handleRedirect,
  ]);

  // ==========================================================
  // CONNEXION AU BACKEND MESSAY
  // ==========================================================

  const handleLogin = async (): Promise<void> => {
    // Empêcher plusieurs requêtes simultanées
    if (
      submittingRef.current ||
      loading ||
      authLoading
    ) {
      return;
    }

    // --------------------------------------------------------
    // Validation du formulaire
    // --------------------------------------------------------

    if (!telephone.trim() || !password.trim()) {
      Alert.alert(
        'Champs requis',
        'Veuillez entrer votre numéro de téléphone et votre mot de passe.'
      );
      return;
    }

    // --------------------------------------------------------
    // Normalisation du téléphone
    // --------------------------------------------------------

    const formattedTelephone =
      normalizeTelephone(telephone);

    if (!formattedTelephone) {
      Alert.alert(
        'Numéro invalide',
        'Veuillez saisir un numéro ivoirien valide de 10 chiffres.'
      );
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      // ------------------------------------------------------
      // Connexion via authService
      //
      // authService.login() doit déjà :
      // 1. Envoyer les identifiants au backend
      // 2. Vérifier les tokens JWT
      // 3. Enregistrer les tokens dans Zustand
      // 4. Enregistrer le profil utilisateur
      // ------------------------------------------------------

      await authService.login({
        telephone: formattedTelephone,
        password,
      });

      // IMPORTANT :
      // Ne pas rappeler setTokens() ou setUser() ici.
      //
      // Le useEffect effectue automatiquement
      // la redirection après la mise à jour
      // du store Zustand.

      if (__DEV__) {
        console.log(
          '[MESSAY LOGIN] Authentification terminée'
        );
      }

    } catch (error: unknown) {
      // ------------------------------------------------------
      // Erreurs API
      // ------------------------------------------------------

      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        const status = error.response?.status;

        const serverMessage =
          error.response?.data?.message ||
          error.response?.data?.error;

        // Aucun retour du serveur
        if (!error.response) {
          const isTimeout =
            error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT';

          Alert.alert(
            isTimeout
              ? 'Délai dépassé'
              : 'Erreur réseau',
            isTimeout
              ? 'Le serveur MESSAY met trop de temps à répondre. Veuillez réessayer.'
              : 'Impossible de contacter le serveur MESSAY. Vérifiez votre connexion Internet.'
          );

          return;
        }

        // Identifiants refusés
        if (status === 400 || status === 401) {
          Alert.alert(
            'Échec de connexion',
            serverMessage ||
              'Numéro de téléphone ou mot de passe incorrect.'
          );

          return;
        }

        // Compte bloqué ou accès refusé
        if (status === 403) {
          Alert.alert(
            'Accès refusé',
            serverMessage ||
              "Votre compte n'est pas autorisé à accéder à MESSAY."
          );

          return;
        }

        // Trop de tentatives
        if (status === 429) {
          Alert.alert(
            'Trop de tentatives',
            'Veuillez patienter avant de réessayer.'
          );

          return;
        }

        // Problème backend
        if (status && status >= 500) {
          Alert.alert(
            'Serveur indisponible',
            'Le serveur MESSAY rencontre temporairement une difficulté. Veuillez réessayer.'
          );

          return;
        }

        Alert.alert(
          'Erreur de connexion',
          serverMessage ||
            'Impossible de vous connecter.'
        );

        return;
      }

      // ------------------------------------------------------
      // Erreurs de validation ou de session
      // ------------------------------------------------------

      if (__DEV__) {
        console.error('[MESSAY LOGIN]', error);
      }

      Alert.alert(
        'Erreur de connexion',
        error instanceof Error
          ? error.message
          : 'Une erreur inattendue est survenue.'
      );

    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // ==========================================================
  // INTERFACE UTILISATEUR
  // ==========================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* FOND PREMIUM */}
      <LinearGradient
        colors={[
          '#050810',
          '#0f172a',
          '#050810',
        ]}
        style={StyleSheet.absoluteFill}
      />

      {/* EFFETS LUMINEUX */}
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: '#FF8C00',
            top: -120,
            left: -80,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: '#6366f1',
            bottom: -100,
            right: -70,
          },
        ]}
      />

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================================================
              LOGO ET IDENTITÉ
          ================================================ */}

          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={[
                  '#FF8C00',
                  '#ff6a00',
                ]}
                style={styles.logo}
              >
                <Ionicons
                  name="flash"
                  size={42}
                  color="#FFFFFF"
                />
              </LinearGradient>

              <View style={styles.logoHalo} />
            </View>

            <Text style={styles.brand}>
              MESSAY
            </Text>

            <Text style={styles.tagline}>
              L'EXCELLENCE EN MOUVEMENT
            </Text>
          </View>

          {/* ================================================
              CARTE DE CONNEXION
          ================================================ */}

          <View style={styles.card}>
            <View style={styles.cardTop} />

            <Text style={styles.welcome}>
              Bon retour
            </Text>

            <Text style={styles.welcomeSub}>
              Connectez-vous à votre espace
            </Text>

            {/* NUMÉRO DE TÉLÉPHONE */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Numéro de téléphone
              </Text>

              <View
                style={[
                  styles.inputBox,
                  telephone.length > 0 &&
                    styles.inputFocus,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="call"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <Text style={styles.prefix}>
                  +225
                </Text>

                <View style={styles.sep} />

                <TextInput
                  style={styles.input}
                  placeholder="07 00 00 00 00"
                  placeholderTextColor="#475569"
                  value={telephone}
                  onChangeText={setTelephone}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  autoCorrect={false}
                  maxLength={20}
                  editable={!isBusy}
                  accessibilityLabel="Numéro de téléphone"
                />
              </View>
            </View>

            {/* MOT DE PASSE */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Mot de passe
              </Text>

              <View
                style={[
                  styles.inputBox,
                  password.length > 0 &&
                    styles.inputFocus,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="current-password"
                  editable={!isBusy}
                  accessibilityLabel="Mot de passe"
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword((previous) => !previous)
                  }
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  <Ionicons
                    name={
                      showPassword
                        ? 'eye-off'
                        : 'eye'
                    }
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ACTIONS SECONDAIRES */}

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() =>
                  router.push('/register')
                }
                disabled={isBusy}
                accessibilityRole="button"
              >
                <Text style={styles.linkLeft}>
                  Créer un compte
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Mot de passe oublié',
                    'Contactez le support MESSAY pour obtenir de l’aide.'
                  )
                }
                disabled={isBusy}
                accessibilityRole="button"
              >
                <Text style={styles.linkRight}>
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            </View>

            {/* BOUTON CONNEXION */}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={isBusy}
              activeOpacity={0.9}
              style={[
                styles.btnWrap,
                isBusy && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
            >
              <LinearGradient
                colors={[
                  '#FF8C00',
                  '#ff6a00',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                {isBusy ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <View style={styles.btnContent}>
                    <Text style={styles.btnText}>
                      SE CONNECTER
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* INDICATEUR SÉCURITÉ */}

            <View style={styles.secure}>
              <Ionicons
                name="shield-checkmark"
                size={13}
                color="#22c55e"
              />

              <Text style={styles.secureText}>
                Connexion chiffrée HTTPS
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================
// STYLES - MESSAY PREMIUM
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050810',
  },

  keyboardContainer: {
    flex: 1,
  },

  glow: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 999,
    opacity: 0.14,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: height * 0.09,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 40,
  },

  logoWrap: {
    position: 'relative',
  },

  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },

  logoHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.18)',
    top: -11,
    left: -11,
  },

  brand: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    marginTop: 18,
  },

  tagline: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  card: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 30,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  cardTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF8C00',
    opacity: 0.5,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  welcome: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },

  welcomeSub: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 26,
  },

  field: {
    marginBottom: 18,
  },

  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 9,
    letterSpacing: 0.6,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    paddingHorizontal: 8,
  },

  inputFocus: {
    borderColor: '#FF8C00',
    backgroundColor: 'rgba(255,140,0,0.04)',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,140,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  prefix: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 12,
  },

  sep: {
    width: 1,
    height: 24,
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
  },

  input: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 28,
  },

  linkLeft: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  linkRight: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '700',
  },

  btnWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },

  btnDisabled: {
    opacity: 0.65,
  },

  btn: {
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },

  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  secure: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },

  secureText: {
    color: '#64748b',
    fontSize: 11,
  },
});
