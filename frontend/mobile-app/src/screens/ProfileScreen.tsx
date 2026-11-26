
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Dimensions,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import axios from 'axios';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import api from '../services/api';

// ============================================================
// MESSAY MOBILE - PROFIL UTILISATEUR
// ============================================================

const { width } = Dimensions.get('window');

const TRICYCLE_ICON = require(
  '../../assets/images/map/tricycle-icon.png'
);

type AuthUser = NonNullable<
  ReturnType<typeof useAuthStore.getState>['user']
>;

type MenuIconName = ComponentProps<
  typeof FontAwesome5
>['name'];

interface MenuOptionProps {
  icon: MenuIconName;
  title: string;
  sub: string;
  onPress: () => void;
}

interface PhotoUploadResponse {
  success: boolean;
  photo: string;
  user: unknown;
}

interface DeletionResponse {
  success: boolean;
  message: string;
  reference?: string;
}

// ============================================================
// UTILITAIRES
// ============================================================

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isAuthUser(
  value: unknown
): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }

  const roles = [
    'USER',
    'CONDUCTEUR',
    'CHAUFFEUR',
    'ADMIN',
    'PARTENAIRE',
    'VENDEUR',
  ];

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.nom === 'string' &&
    typeof value.email === 'string' &&
    typeof value.telephone === 'string' &&
    typeof value.role === 'string' &&
    roles.includes(value.role)
  );
}

function extractProfile(
  response: unknown
): unknown {
  if (!isRecord(response)) {
    return response;
  }

  if ('user' in response) {
    return response.user;
  }

  if (isRecord(response.data)) {
    if ('user' in response.data) {
      return response.data.user;
    }

    return response.data;
  }

  return response;
}

function getApiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;

    if (isRecord(data)) {
      if (typeof data.message === 'string') {
        return data.message;
      }

      if (typeof data.error === 'string') {
        return data.error;
      }
    }

    if (error.response?.status === 404) {
      return 'Cette fonctionnalité n’est pas encore disponible sur le serveur MESSAY.';
    }

    if (error.response?.status === 401) {
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    }

    if (error.response?.status === 413) {
      return 'La photo est trop volumineuse.';
    }

    if (!error.response) {
      return 'Impossible de contacter le serveur MESSAY. Vérifiez votre connexion Internet.';
    }
  }

  return fallback;
}

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    setUser,
  } = useAuthStore();

  const [loadingImage, setLoadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<
    string | null
  >(null);

  const [
    deleteModalVisible,
    setDeleteModalVisible,
  ] = useState(false);

  const [deletePassword, setDeletePassword] =
    useState('');

  const [
    showDeletePassword,
    setShowDeletePassword,
  ] = useState(false);

  const uploadingRef = useRef(false);
  const deletingRef = useRef(false);

  // ==========================================================
  // ANIMATIONS PREMIUM
  // ==========================================================

  const shineAnim = useRef(
    new Animated.Value(-width)
  ).current;

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    const animation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [fadeAnim]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const startShine = () => {
      if (cancelled) return;

      shineAnim.setValue(-width);

      Animated.timing(shineAnim, {
        toValue: width,
        duration: 2500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          timer = setTimeout(startShine, 4000);
        }
      });
    };

    startShine();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      shineAnim.stopAnimation();
    };
  }, [isAuthenticated, shineAnim]);

  // ==========================================================
  // PROTECTION DU PROFIL
  // ==========================================================

  useEffect(() => {
    if (
      !authLoading &&
      (!isAuthenticated || !user)
    ) {
      router.replace('/(auth)/login');
    }
  }, [
    authLoading,
    isAuthenticated,
    user,
    router,
  ]);

  useEffect(() => {
    setPhotoPreview(null);
  }, [user?.id]);

  // ==========================================================
  // ACTUALISATION DU PROFIL DEPUIS LE BACKEND
  // ==========================================================

  const onRefresh = useCallback(async () => {
    if (
      refreshing ||
      loadingImage ||
      deleting ||
      !isAuthenticated ||
      !user
    ) {
      return;
    }

    setRefreshing(true);

    try {
      const response: unknown =
        await authService.getProfile();

      const profile = extractProfile(response);

      if (
        !isAuthUser(profile) ||
        profile.id !== user.id
      ) {
        throw new Error(
          'Réponse de profil invalide'
        );
      }

      await setUser(profile);
      setPhotoPreview(null);
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn(
          '[MESSAY PROFILE] Actualisation :',
          error
        );
      }

      Alert.alert(
        'Actualisation impossible',
        getApiErrorMessage(
          error,
          'Impossible de récupérer votre profil.'
        )
      );
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    loadingImage,
    deleting,
    isAuthenticated,
    user,
    setUser,
  ]);

  // ==========================================================
  // PHOTO DE PROFIL - UPLOAD RÉEL SUR RENDER
  // ==========================================================

  const pickImage = useCallback(async () => {
    if (
      !user ||
      uploadingRef.current ||
      deleting
    ) {
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission requise',
          'Veuillez autoriser l’accès aux photos.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (
        result.canceled ||
        !result.assets?.[0]?.uri
      ) {
        return;
      }

      uploadingRef.current = true;
      setLoadingImage(true);

      const selectedUri = result.assets[0].uri;

      // Aperçu pendant le téléversement.
      setPhotoPreview(selectedUri);

      // ------------------------------------------
      // Conversion JPEG : compatible iPhone/Android
      // ------------------------------------------

      const context =
        ImageManipulator.manipulate(selectedUri);

      context.resize({
        width: 512,
        height: 512,
      });

      const renderedImage =
        await context.renderAsync();

      const jpeg =
        await renderedImage.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.8,
        });

      // ------------------------------------------
      // Préparation du fichier multipart
      // ------------------------------------------

      const formData = new FormData();

      formData.append(
        'photo',
        {
          uri: jpeg.uri,
          name: 'profil-messay.jpg',
          type: 'image/jpeg',
        } as unknown as Blob
      );

      // ------------------------------------------
      // Envoi au backend Render
      //
      // Base URL :
      // https://messay-api.onrender.com/api
      // ------------------------------------------

      const response =
        await api.post<PhotoUploadResponse>(
          '/users/me/photo',
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 90000,
          }
        );

      const data = response.data;

      // ------------------------------------------
      // Vérification de la réponse serveur
      // ------------------------------------------

      if (
        !data?.success ||
        !isAuthUser(data.user) ||
        data.user.id !== user.id ||
        typeof data.photo !== 'string' ||
        !data.photo.trim()
      ) {
        throw new Error(
          'Réponse du serveur invalide après téléversement'
        );
      }

      // ------------------------------------------
      // Mise à jour Zustand
      // ------------------------------------------

      await setUser(data.user);

      setPhotoPreview(null);

      Alert.alert(
        'Photo enregistrée',
        'Votre photo de profil a été sauvegardée avec succès sur MESSAY.'
      );
    } catch (error: unknown) {
      setPhotoPreview(null);

      if (__DEV__) {
        console.warn(
          '[MESSAY PROFILE] Upload :',
          error
        );
      }

      Alert.alert(
        'Enregistrement impossible',
        getApiErrorMessage(
          error,
          'Impossible de sauvegarder votre photo sur le serveur.'
        )
      );
    } finally {
      uploadingRef.current = false;
      setLoadingImage(false);
    }
  }, [
    user,
    deleting,
    setUser,
  ]);

  // ==========================================================
  // DÉCONNEXION
  // ==========================================================

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Souhaitez-vous fermer votre session MESSAY ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();

              router.replace('/(auth)/login');
            } catch (error: unknown) {
              Alert.alert(
                'Erreur',
                'Impossible de terminer la déconnexion.'
              );
            }
          },
        },
      ]
    );
  }, [router]);

  // ==========================================================
  // DEMANDE DE SUPPRESSION DU COMPTE
  // ==========================================================

  const handleDeleteAccount = useCallback(() => {
    if (
      !user ||
      deleting ||
      loadingImage
    ) {
      return;
    }

    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteModalVisible(true);
  }, [
    user,
    deleting,
    loadingImage,
  ]);

  const closeDeleteModal = useCallback(() => {
    if (deletingRef.current) {
      return;
    }

    setDeleteModalVisible(false);
    setDeletePassword('');
    setShowDeletePassword(false);
  }, []);

  const confirmDeletionRequest =
    useCallback(async (): Promise<void> => {
      if (
        !user ||
        deletingRef.current
      ) {
        return;
      }

      if (!deletePassword) {
        Alert.alert(
          'Mot de passe requis',
          'Saisissez votre mot de passe actuel.'
        );

        return;
      }

      deletingRef.current = true;
      setDeleting(true);

      try {
        // ------------------------------------------
        // Le backend détermine le compte à partir
        // du JWT, pas d'un ID envoyé par le mobile.
        // ------------------------------------------

        const response =
          await api.post<DeletionResponse>(
            '/users/me/deletion-request',
            {
              password: deletePassword,
            }
          );

        const data = response.data;

        if (!data?.success) {
          throw new Error(
            'Demande non confirmée par le serveur'
          );
        }

        const confirmation =
          data.message ||
          'Votre demande a été enregistrée.';

        setDeletePassword('');
        setDeleteModalVisible(false);

        // ------------------------------------------
        // Nettoyage de la session locale
        // ------------------------------------------

        try {
          await authService.logout();
        } catch (logoutError: unknown) {
          if (__DEV__) {
            console.warn(
              '[MESSAY PROFILE] Déconnexion :',
              logoutError
            );
          }
        }

        router.replace('/(auth)/login');

        Alert.alert(
          'Demande enregistrée',
          confirmation
        );
      } catch (error: unknown) {
        Alert.alert(
          'Demande impossible',
          getApiErrorMessage(
            error,
            'Votre demande de suppression n’a pas été enregistrée.'
          )
        );
      } finally {
        deletingRef.current = false;
        setDeleting(false);
      }
    }, [
      user,
      deletePassword,
      router,
    ]);

  // ==========================================================
  // CHARGEMENT
  // ==========================================================

  if (
    authLoading ||
    !isAuthenticated ||
    !user
  ) {
    return (
      <View style={styles.loaderScreen}>
        <ActivityIndicator
          size="large"
          color="#FF6B35"
        />
      </View>
    );
  }

  const userRole = user.role || 'USER';

  const photoUri =
    photoPreview || user.photo;

  // ==========================================================
  // INTERFACE UTILISATEUR
  // ==========================================================

  return (
    <Animated.View
      style={[
        styles.mainWrapper,
        { opacity: fadeAnim },
      ]}
    >
      <StatusBar
        barStyle="light-content"
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={['#FF6B35']}
          />
        }
      >
        {/* ============================================
            EN-TÊTE PREMIUM
        ============================================ */}

        <LinearGradient
          colors={[
            '#0f172a',
            '#1e293b',
            '#334155',
          ]}
          style={[
            styles.headerPremium,
            {
              paddingTop: insets.top + 20,
            },
          ]}
        >
          <View style={styles.headerOverlay}>
            {/* PHOTO DE PROFIL */}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={pickImage}
              disabled={loadingImage || deleting}
              style={styles.avatarContainer}
              accessibilityRole="button"
              accessibilityLabel="Modifier la photo de profil"
            >
              <LinearGradient
                colors={[
                  '#FF6B35',
                  '#FF8E64',
                ]}
                style={styles.avatarHalo}
              >
                <View style={styles.avatarBorder}>
                  {loadingImage ? (
                    <View style={styles.loaderFull}>
                      <ActivityIndicator
                        color="#FFFFFF"
                        size="large"
                      />
                    </View>
                  ) : photoUri ? (
                    <Image
                      source={{
                        uri: photoUri,
                      }}
                      style={styles.profilePhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.fallbackAvatar}>
                      <Ionicons
                        name="person"
                        size={54}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                </View>
              </LinearGradient>

              <View style={styles.cameraBadgePro}>
                <Ionicons
                  name="camera"
                  size={12}
                  color="#FFFFFF"
                />
              </View>

              <View style={styles.activePulse} />
            </TouchableOpacity>

            {loadingImage && (
              <Text style={styles.previewText}>
                Enregistrement de la photo…
              </Text>
            )}

            {/* NOM UTILISATEUR */}

            <Text style={styles.userNamePro}>
              {user.prenom || 'Utilisateur'}{' '}
              {user.nom}
            </Text>

            {/* RÔLE */}

            <View style={styles.pillBadgePro}>
              <LinearGradient
                colors={[
                  'rgba(255,107,53,0.2)',
                  'rgba(255,142,100,0.1)',
                ]}
                style={styles.pillGradient}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color="#FF8E64"
                  style={{
                    marginRight: 6,
                  }}
                />

                <Text style={styles.pillBadgeTextPro}>
                  {userRole}
                </Text>
              </LinearGradient>
            </View>

            {/* COORDONNÉES */}

            <View style={styles.contactRowPro}>
              <Ionicons
                name="mail-outline"
                size={12}
                color="rgba(255,255,255,0.5)"
              />

              <Text style={styles.contactTextPro}>
                {user.email || 'Non renseigné'}
              </Text>

              <View style={styles.dotSeparatorPro} />

              <Ionicons
                name="call-outline"
                size={12}
                color="rgba(255,255,255,0.5)"
              />

              <Text style={styles.contactTextPro}>
                {user.telephone || 'Non renseigné'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ============================================
            CONTENU PRINCIPAL
        ============================================ */}

        <View style={styles.content}>
          {/* DEVENIR PARTENAIRE */}

          {userRole === 'USER' && (
            <Pressable
              style={({ pressed }) => [
                styles.promoCard,
                pressed && {
                  transform: [{ scale: 0.98 }],
                },
              ]}
              onPress={() => router.push('/support')}
            >
              <LinearGradient
                colors={[
                  '#FF6B35',
                  '#FF8E64',
                ]}
                start={{
                  x: 0,
                  y: 0,
                }}
                end={{
                  x: 1,
                  y: 0,
                }}
                style={styles.promoGradient}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shineContainer,
                    {
                      transform: [
                        {
                          translateX: shineAnim,
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      'transparent',
                      'rgba(255,255,255,0.4)',
                      'transparent',
                    ]}
                    start={{
                      x: 0,
                      y: 0,
                    }}
                    end={{
                      x: 1,
                      y: 0,
                    }}
                    style={styles.shineGradient}
                  />
                </Animated.View>

                <View style={styles.promoInfo}>
                  <Text style={styles.promoTitlePro}>
                    Devenez Partenaire
                  </Text>

                  <Text style={styles.promoSubPro}>
                    Activez votre tricycle et encaissez
                    des revenus.
                  </Text>
                </View>

                <View style={styles.promoIconBoxPro}>
                  <Image
                    source={TRICYCLE_ICON}
                    style={styles.promoTricycleIcon}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* OPTIONS DU COMPTE */}

          <View style={styles.glassSection}>
            <Text style={styles.sectionTitlePro}>
              Privilèges Compte
            </Text>

            <MenuOptionPro
              icon="user-edit"
              title="Modifier le profil"
              sub="Nom, prénom, téléphone"
              onPress={() =>
                router.push('/edit-profile')
              }
            />

            <MenuOptionPro
              icon="wallet"
              title="MESSAY Wallet"
              sub="Gérer vos crédits et paiements"
              onPress={() =>
                router.push('/paiement')
              }
            />

            <MenuOptionPro
              icon="headset"
              title="Conciergerie 24/7"
              sub="Assistance et support technique"
              onPress={() =>
                router.push('/support')
              }
            />
          </View>

          {/* DÉCONNEXION */}

          <TouchableOpacity
            style={styles.logoutBtnPro}
            onPress={handleLogout}
            disabled={loadingImage || deleting}
            accessibilityRole="button"
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#475569"
            />

            <Text style={styles.logoutBtnTextPro}>
              Me déconnecter
            </Text>
          </TouchableOpacity>

          {/* SUPPRESSION DU COMPTE */}

          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <Ionicons
                name="warning"
                size={20}
                color="#EF4444"
              />

              <Text style={styles.dangerTitle}>
                Zone de suppression
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
              disabled={deleting || loadingImage}
              accessibilityRole="button"
            >
              {deleting ? (
                <ActivityIndicator
                  color="#EF4444"
                />
              ) : (
                <Text style={styles.deleteButtonText}>
                  Supprimer le compte
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* PIED DE PAGE */}

          <View style={styles.footerPro}>
            <Text style={styles.versionTextPro}>
              MESSAY PLATINUM v1.0.1
            </Text>

            <Text style={styles.copyrightTextPro}>
              © 2026 MESSAY GROUP CI
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ============================================
          MODAL DE SUPPRESSION SÉCURISÉE
      ============================================ */}

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Ionicons
                name="warning-outline"
                size={24}
                color="#DC2626"
              />

              <Text style={styles.modalTitle}>
                Suppression du compte
              </Text>
            </View>

            <Text style={styles.modalDescription}>
              Confirmez votre identité pour demander
              la suppression de votre compte MESSAY.
              Votre compte pourra être désactivé
              pendant le traitement de la demande.
            </Text>

            <Text style={styles.modalLabel}>
              Mot de passe actuel
            </Text>

            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry={!showDeletePassword}
                placeholder="Votre mot de passe"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!deleting}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowDeletePassword(
                    previous => !previous
                  )
                }
                disabled={deleting}
                style={styles.modalEye}
                accessibilityRole="button"
              >
                <Ionicons
                  name={
                    showDeletePassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={closeDeleteModal}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  deleting && styles.modalDisabled,
                ]}
                onPress={confirmDeletionRequest}
                disabled={
                  deleting || !deletePassword
                }
              >
                {deleting ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    Envoyer la demande
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

// ============================================================
// COMPOSANT MENU
// ============================================================

function MenuOptionPro({
  icon,
  title,
  sub,
  onPress,
}: MenuOptionProps) {
  return (
    <TouchableOpacity
      style={styles.menuRowPro}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
    >
      <View style={styles.iconCirclePro}>
        <FontAwesome5
          name={icon}
          size={14}
          color="#FF6B35"
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitlePro}>
          {title}
        </Text>

        <Text style={styles.menuSubTitlePro}>
          {sub}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={18}
        color="#CBD5E1"
      />
    </TouchableOpacity>
  );
}

// ============================================================
// STYLES COMPLETS
// ============================================================

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  container: {
    flex: 1,
  },
  loaderScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
  },
  headerPremium: {
    paddingBottom: 60,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  headerOverlay: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarHalo: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarBorder: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  fallbackAvatar: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadgePro: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#FF6B35',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  activePulse: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  previewText: {
    color: '#FFB089',
    fontSize: 11,
    marginTop: 9,
  },
  userNamePro: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 15,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  pillBadgePro: {
    marginTop: 12,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  pillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pillBadgeTextPro: {
    color: '#FF8E64',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  contactRowPro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    opacity: 0.8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  contactTextPro: {
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 5,
  },
  dotSeparatorPro: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 12,
  },
  content: {
    padding: 20,
    marginTop: -40,
  },
  promoCard: {
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#FF6B35',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    marginBottom: 25,
  },
  promoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    position: 'relative',
  },
  promoInfo: {
    flex: 1,
  },
  promoTitlePro: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  promoSubPro: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  promoIconBoxPro: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  promoTricycleIcon: {
    width: 45,
    height: 45,
  },
  shineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 150,
  },
  shineGradient: {
    flex: 1,
    width: '100%',
  },
  glassSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitlePro: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingLeft: 20,
    paddingTop: 20,
    marginBottom: 10,
  },
  menuRowPro: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
  },
  iconCirclePro: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuTitlePro: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  menuSubTitlePro: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  logoutBtnPro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutBtnTextPro: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
  },
  dangerZone: {
    backgroundColor: '#FEF2F2',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  footerPro: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  versionTextPro: {
    fontSize: 11,
    fontWeight: '900',
    color: '#CBD5E1',
    letterSpacing: 3,
  },
  copyrightTextPro: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 6,
  },

  // ==========================================================
  // MODAL DE SUPPRESSION
  // ==========================================================

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  modalTitle: {
    color: '#991B1B',
    fontSize: 19,
    fontWeight: '900',
    flex: 1,
  },
  modalDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  modalLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 9,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    height: 52,
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
  },
  modalInput: {
    flex: 1,
    color: '#0F172A',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalEye: {
    padding: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 13,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 13,
  },
  modalConfirm: {
    flex: 1.5,
    backgroundColor: '#DC2626',
    borderRadius: 13,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
  modalDisabled: {
    opacity: 0.6,
  },
});
