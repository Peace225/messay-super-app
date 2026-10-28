
import { useRef, useState } from 'react';

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
  ScrollView,
  StatusBar,
} from 'react-native';

import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { authService } from '../services/authService';

// ============================================================
// MESSAY MOBILE - INSCRIPTION UTILISATEUR
// ============================================================

const { width, height } = Dimensions.get('window');

interface RegisterForm {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
  confirmPassword: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

// ============================================================
// NORMALISATION DU NUMÉRO IVOIRIEN
// ============================================================

function normalizeTelephone(
  value: string
): string | null {
  let digits = value.replace(/\D/g, '');

  // Accepter le format 2250700000000
  // et le format national 0700000000.

  if (
    digits.startsWith('225') &&
    digits.length === 13
  ) {
    digits = digits.slice(3);
  }

  if (!/^\d{10}$/.test(digits)) {
    return null;
  }

  return `+225${digits}`;
}

// ============================================================
// VALIDATION EMAIL
// ============================================================

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

export default function RegisterScreen() {
  const router = useRouter();

  const [formData, setFormData] =
    useState<RegisterForm>({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      password: '',
      confirmPassword: '',
    });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] =
    useState(false);

  const submittingRef = useRef(false);

  // ==========================================================
  // MISE À JOUR DES CHAMPS
  // ==========================================================

  const updateField = (
    field: keyof RegisterForm,
    value: string
  ): void => {
    setFormData(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  // ==========================================================
  // INSCRIPTION
  // ==========================================================

  const handleRegister = async (): Promise<void> => {
    if (submittingRef.current || loading) {
      return;
    }

    const {
      nom,
      prenom,
      email,
      telephone,
      password,
      confirmPassword,
    } = formData;

    const cleanNom = nom.trim();
    const cleanPrenom = prenom.trim();
    const cleanEmail = email.trim().toLowerCase();

    // --------------------------------------------------------
    // Vérification des champs
    // --------------------------------------------------------

    if (
      !cleanNom ||
      !cleanEmail ||
      !telephone.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        'Champs requis',
        'Veuillez remplir tous les champs obligatoires.'
      );
      return;
    }

    // --------------------------------------------------------
    // Vérification du nom
    // --------------------------------------------------------

    if (cleanNom.length < 2) {
      Alert.alert(
        'Nom invalide',
        'Veuillez saisir votre nom.'
      );
      return;
    }

    // --------------------------------------------------------
    // Vérification de l'email
    // --------------------------------------------------------

    if (!isValidEmail(cleanEmail)) {
      Alert.alert(
        'Email invalide',
        'Veuillez saisir une adresse email valide.'
      );
      return;
    }

    // --------------------------------------------------------
    // Vérification du téléphone
    // --------------------------------------------------------

    const formattedTelephone =
      normalizeTelephone(telephone);

    if (!formattedTelephone) {
      Alert.alert(
        'Numéro invalide',
        'Veuillez saisir un numéro ivoirien de 10 chiffres.'
      );
      return;
    }

    // --------------------------------------------------------
    // Validation du mot de passe
    // --------------------------------------------------------

    if (password.length < 8) {
      Alert.alert(
        'Mot de passe trop court',
        'Votre mot de passe doit contenir au moins 8 caractères.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Confirmation incorrecte',
        'Les mots de passe ne correspondent pas.'
      );
      return;
    }

    // --------------------------------------------------------
    // Protection contre les doubles soumissions
    // --------------------------------------------------------

    submittingRef.current = true;
    setLoading(true);

    try {
      // ------------------------------------------------------
      // INSCRIPTION SUR LE BACKEND MESSAY
      //
      // authService utilise api.ts :
      // https://messay-api.onrender.com/api
      // ------------------------------------------------------

      await authService.register({
        nom: cleanNom,
        prenom: cleanPrenom || undefined,
        email: cleanEmail,
        telephone: formattedTelephone,
        password,
      });

      // IMPORTANT :
      // Le backend doit attribuer le rôle USER.
      // On ne fait pas confiance à un rôle choisi
      // depuis le téléphone.

      if (__DEV__) {
        console.log(
          '[MESSAY REGISTER] Requête acceptée'
        );
      }

      // ------------------------------------------------------
      // CONFIRMATION
      // ------------------------------------------------------

      Alert.alert(
        'Inscription enregistrée',
        'Votre demande a été acceptée. Si une vérification de compte est nécessaire, suivez les instructions de MESSAY.',
        [
          {
            text: 'Se connecter',
            onPress: () => {
              router.replace('/(auth)/login');
            },
          },
        ]
      );

    } catch (error: unknown) {
      // ------------------------------------------------------
      // GESTION SÉCURISÉE DES ERREURS
      // ------------------------------------------------------

      if (
        axios.isAxiosError<ApiErrorResponse>(error)
      ) {
        const status = error.response?.status;

        const serverMessage =
          error.response?.data?.message ||
          error.response?.data?.error;

        // Erreur réseau
        if (!error.response) {
          const timeout =
            error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT';

          Alert.alert(
            timeout
              ? 'Délai dépassé'
              : 'Erreur réseau',
            timeout
              ? 'Le serveur MESSAY met trop de temps à répondre. Réessayez.'
              : 'Impossible de contacter MESSAY. Vérifiez votre connexion Internet.'
          );

          return;
        }

        // Validation incorrecte
        if (status === 400 || status === 422) {
          Alert.alert(
            'Informations invalides',
            serverMessage ||
              'Veuillez vérifier les informations saisies.'
          );

          return;
        }

        // Numéro ou email déjà utilisé
        if (status === 409) {
          Alert.alert(
            'Compte existant',
            serverMessage ||
              'Ce numéro ou cette adresse email est déjà utilisé.'
          );

          return;
        }

        // Trop de demandes
        if (status === 429) {
          Alert.alert(
            'Trop de tentatives',
            'Veuillez patienter avant de réessayer.'
          );

          return;
        }

        // Accès refusé
        if (status === 403) {
          Alert.alert(
            'Inscription refusée',
            serverMessage ||
              'Cette inscription n’est pas autorisée.'
          );

          return;
        }

        // Erreur backend
        if (status && status >= 500) {
          Alert.alert(
            'Service indisponible',
            'Le serveur MESSAY rencontre une difficulté temporaire.'
          );

          return;
        }

        Alert.alert(
          'Inscription impossible',
          serverMessage ||
            'Une erreur est survenue.'
        );

        return;
      }

      if (__DEV__) {
        console.error(
          '[MESSAY REGISTER]',
          error
        );
      }

      Alert.alert(
        'Erreur',
        'Impossible de créer votre compte pour le moment.'
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
            right: -80,
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
            left: -70,
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ================================================
              LOGO MESSAY
          ================================================ */}

          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={[
                  '#FF8C00',
                  '#ff6a00',
                  '#FF8C00',
                ]}
                style={styles.logo}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={38}
                  color="#FFFFFF"
                />
              </LinearGradient>

              <View style={styles.logoRing} />
            </View>

            <Text style={styles.brand}>
              MESSAY
            </Text>

            <View style={styles.badge}>
              <Ionicons
                name="diamond"
                size={12}
                color="#FF8C00"
              />

              <Text style={styles.badgeText}>
                INSCRIPTION PREMIUM
              </Text>
            </View>
          </View>

          {/* ================================================
              FORMULAIRE
          ================================================ */}

          <View style={styles.card}>
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.08)',
                'rgba(255,255,255,0.02)',
              ]}
              style={styles.cardBorder}
            />

            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                Créer votre accès
              </Text>

              <Text style={styles.cardSub}>
                Rejoignez MESSAY en toute simplicité
              </Text>
            </View>

            {/* ==============================================
                NOM
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Nom *
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.nom && styles.inputActive,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Votre nom"
                  placeholderTextColor="#475569"
                  value={formData.nom}
                  onChangeText={value =>
                    updateField('nom', value)
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={80}
                  editable={!loading}
                  accessibilityLabel="Nom"
                />
              </View>
            </View>

            {/* ==============================================
                PRÉNOM
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Prénom (facultatif)
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.prenom && styles.inputActive,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Votre prénom"
                  placeholderTextColor="#475569"
                  value={formData.prenom}
                  onChangeText={value =>
                    updateField('prenom', value)
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={80}
                  editable={!loading}
                  accessibilityLabel="Prénom"
                />
              </View>
            </View>

            {/* ==============================================
                EMAIL
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Adresse email *
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.email && styles.inputActive,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="exemple@email.com"
                  placeholderTextColor="#475569"
                  value={formData.email}
                  onChangeText={value =>
                    updateField('email', value)
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={160}
                  editable={!loading}
                  accessibilityLabel="Adresse email"
                />
              </View>
            </View>

            {/* ==============================================
                TÉLÉPHONE
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Numéro mobile *
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.telephone &&
                    styles.inputActive,
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
                  value={formData.telephone}
                  onChangeText={value =>
                    updateField('telephone', value)
                  }
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={20}
                  editable={!loading}
                  accessibilityLabel="Numéro mobile"
                />
              </View>
            </View>

            {/* ==============================================
                MOT DE PASSE
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Mot de passe *
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.password &&
                    styles.inputActive,
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
                  placeholder="Minimum 8 caractères"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={value =>
                    updateField('password', value)
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={128}
                  editable={!loading}
                  accessibilityLabel="Mot de passe"
                />
              </View>
            </View>

            {/* ==============================================
                CONFIRMATION
            ============================================== */}

            <View style={styles.field}>
              <Text style={styles.label}>
                Confirmer le mot de passe *
              </Text>

              <View
                style={[
                  styles.inputBox,
                  !!formData.confirmPassword &&
                    styles.inputActive,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="shield-checkmark"
                    size={18}
                    color="#FF8C00"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Répétez votre mot de passe"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={formData.confirmPassword}
                  onChangeText={value =>
                    updateField(
                      'confirmPassword',
                      value
                    )
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  maxLength={128}
                  editable={!loading}
                  accessibilityLabel="Confirmation du mot de passe"
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(previous => !previous)
                  }
                  style={styles.eye}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? 'Masquer les mots de passe'
                      : 'Afficher les mots de passe'
                  }
                  disabled={loading}
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

            {/* ==============================================
                BOUTON INSCRIPTION
            ============================================== */}

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.9}
              style={[
                styles.ctaWrap,
                loading && styles.ctaDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Créer mon compte MESSAY"
            >
              <LinearGradient
                colors={[
                  '#FF8C00',
                  '#ff6a00',
                ]}
                start={{
                  x: 0,
                  y: 0,
                }}
                end={{
                  x: 1,
                  y: 0,
                }}
                style={styles.cta}
              >
                <View style={styles.ctaInner}>
                  {loading ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="rocket"
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text style={styles.ctaText}>
                        CRÉER MON COMPTE
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#FFFFFF"
                      />
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* INDICATEUR SÉCURITÉ */}

            <View style={styles.trust}>
              <Ionicons
                name="lock-closed"
                size={12}
                color="#22c55e"
              />

              <Text style={styles.trustText}>
                Transmission chiffrée HTTPS
              </Text>
            </View>
          </View>

          {/* ================================================
              REDIRECTION VERS CONNEXION
          ================================================ */}

          <TouchableOpacity
            onPress={() =>
              router.replace('/(auth)/login')
            }
            style={styles.login}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.loginText}>
              Déjà membre ?{' '}
              <Text style={styles.loginAccent}>
                Se connecter
              </Text>
            </Text>
          </TouchableOpacity>
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
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 999,
    opacity: 0.15,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: height * 0.07,
    paddingBottom: 40,
    flexGrow: 1,
  },

  header: {
    alignItems: 'center',
    marginBottom: 36,
  },

  logoWrap: {
    position: 'relative',
    marginBottom: 16,
  },

  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },

  logoRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.2)',
    top: -10,
    left: -10,
  },

  brand: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 5,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,140,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.2)',
  },

  badgeText: {
    color: '#FF8C00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  card: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 32,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },

  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  cardHeader: {
    marginBottom: 24,
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  cardSub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },

  field: {
    marginBottom: 18,
  },

  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 9,
    marginLeft: 4,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 16,
    height: 58,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },

  inputActive: {
    borderColor: '#FF8C00',
    backgroundColor: 'rgba(255,140,0,0.03)',
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
    paddingHorizontal: 12,
  },

  eye: {
    padding: 10,
  },

  ctaWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF8C00',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },

  ctaDisabled: {
    opacity: 0.6,
  },

  cta: {
    height: 58,
  },

  ctaInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },

  trustText: {
    color: '#64748b',
    fontSize: 11,
  },

  login: {
    marginTop: 28,
    alignItems: 'center',
  },

  loginText: {
    color: '#64748b',
    fontSize: 14,
  },

  loginAccent: {
    color: '#FF8C00',
    fontWeight: '800',
  },
});
