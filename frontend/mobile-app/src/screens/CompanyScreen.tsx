
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Ionicons,
  FontAwesome5,
  MaterialIcons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';

// ============================================================
// OUTILS DE NORMALISATION
// ============================================================

const normalize = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// ============================================================
// LOGOS ET IMAGES DES COMPAGNIES
// ============================================================

const COMPANY_ASSETS: Record<
  string,
  { logo: number; bus: number }
> = {
  'UTB CI': {
    logo: require('../../assets/logos/utb.png'),
    bus: require('../../assets/images/bus_utb.jpg'),
  },
  UTB: {
    logo: require('../../assets/logos/utb.png'),
    bus: require('../../assets/images/bus_utb.jpg'),
  },
  'Transports AVS': {
    logo: require('../../assets/logos/avs.png'),
    bus: require('../../assets/images/bus_avs.jpg'),
  },
  AVS: {
    logo: require('../../assets/logos/avs.png'),
    bus: require('../../assets/images/bus_avs.jpg'),
  },
  'CTE Transport Express': {
    logo: require('../../assets/logos/cte.png'),
    bus: require('../../assets/images/bus_cte.jpg'),
  },
  CTE: {
    logo: require('../../assets/logos/cte.png'),
    bus: require('../../assets/images/bus_cte.jpg'),
  },
  'MTK Transport': {
    logo: require('../../assets/logos/mtk.png'),
    bus: require('../../assets/images/bus_mtk.jpg'),
  },
  'MD Transport': {
    logo: require('../../assets/logos/mdt.png'),
    bus: require('../../assets/images/bus_mdt.jpg'),
  },
  SBTA: {
    logo: require('../../assets/logos/sbta.png'),
    bus: require('../../assets/images/bus_sbta.jpg'),
  },
  'STAF Transport': {
    logo: require('../../assets/logos/staf.png'),
    bus: require('../../assets/images/bus_staf.jpg'),
  },
  STAF: {
    logo: require('../../assets/logos/staf.png'),
    bus: require('../../assets/images/bus_staf.jpg'),
  },
  'STL Transport': {
    logo: require('../../assets/logos/stl.png'),
    bus: require('../../assets/images/bus_stl.jpg'),
  },
  'CA-TRANS': {
    logo: require('../../assets/logos/trans.png'),
    bus: require('../../assets/images/bus_trans.jpg'),
  },
  'CA TRANS': {
    logo: require('../../assets/logos/trans.png'),
    bus: require('../../assets/images/bus_trans.jpg'),
  },
  TRANS: {
    logo: require('../../assets/logos/trans.png'),
    bus: require('../../assets/images/bus_trans.jpg'),
  },
  SITTI: {
    logo: require('../../assets/logos/sitti.png'),
    bus: require('../../assets/images/bus_sitti.jpg'),
  },
  'SITTI Transport Terreste International': {
    logo: require('../../assets/logos/sitti.png'),
    bus: require('../../assets/images/bus_sitti.jpg'),
  },
};

const FALLBACK_LOGO = require('../../assets/images/bus.jpg');
const FALLBACK_BUS = require('../../assets/images/bus.jpg');

function getAsset(
  companyName: string,
  type: 'logo' | 'bus'
): number {
  const fallback =
    type === 'logo' ? FALLBACK_LOGO : FALLBACK_BUS;

  if (!companyName) {
    return fallback;
  }

  if (COMPANY_ASSETS[companyName]) {
    return COMPANY_ASSETS[companyName][type];
  }

  const normalizedName = normalize(companyName);

  const foundKey = Object.keys(COMPANY_ASSETS).find(
    key => {
      const normalizedKey = normalize(key);

      return (
        normalizedKey === normalizedName ||
        normalizedName.includes(normalizedKey) ||
        normalizedKey.includes(normalizedName)
      );
    }
  );

  return foundKey
    ? COMPANY_ASSETS[foundKey][type]
    : fallback;
}

// ============================================================
// TYPES
// ============================================================

interface CompanyData {
  id: string;
  name: string;
  color?: string | null;
  couleur?: string | null;
  gare_name?: string | null;
  telephone?: string | null;
}

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  color: string;
  lib: 'FontAwesome5' | 'Ionicons';
}

function getParam(
  value: string | string[] | undefined,
  fallback: string
): string {
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }

  return value || fallback;
}

function getValidColor(value: unknown): string {
  if (
    typeof value === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value)
  ) {
    return value;
  }

  return '#7C3AED';
}

// ============================================================
// ÉCRAN COMPAGNIE
// ============================================================

export default function CompanyScreen() {
  const router = useRouter();

  const { name, color, id } = useLocalSearchParams();

  const { user, logout } = useAuthStore();

  const [companyData, setCompanyData] =
    useState<CompanyData | null>(null);

  const [garesCount, setGaresCount] =
    useState<number>(0);

  const [loading, setLoading] =
    useState<boolean>(true);

  const companyId = getParam(id, '');
  const paramName = getParam(name, 'Compagnie');
  const paramColor = getValidColor(
    getParam(color, '#7C3AED')
  );

  // ==========================================================
  // RÉCUPÉRATION DE LA COMPAGNIE DEPUIS SUPABASE
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    const fetchCompany = async () => {
      try {
        setLoading(true);
        setCompanyData(null);
        setGaresCount(0);

        let foundCompany: CompanyData | null = null;

        // Recherche par ID lorsque celui-ci existe.
        if (companyId) {
          const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .maybeSingle();

          if (error) {
            console.warn(
              '[MESSAY COMPANY] Recherche par ID :',
              error.message
            );
          }

          if (data) {
            foundCompany = data as CompanyData;
          }
        }

        // Recherche de secours par nom.
        if (
          !foundCompany &&
          paramName !== 'Compagnie'
        ) {
          const { data, error } = await supabase
            .from('companies')
            .select('*')
            .ilike('name', `%${paramName}%`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.warn(
              '[MESSAY COMPANY] Recherche par nom :',
              error.message
            );
          }

          if (data) {
            foundCompany = data as CompanyData;
          }
        }

        if (cancelled) {
          return;
        }

        if (!foundCompany) {
          return;
        }

        setCompanyData(foundCompany);

        // Nombre de gares liées à la compagnie.
        const { count, error: gareError } =
          await supabase
            .from('gares')
            .select('id', {
              count: 'exact',
              head: true,
            })
            .eq('company_id', foundCompany.id);

        if (gareError) {
          console.warn(
            '[MESSAY COMPANY] Gares :',
            gareError.message
          );
        }

        if (!cancelled) {
          setGaresCount(count ?? 0);
        }
      } catch (error: unknown) {
        if (__DEV__) {
          console.error(
            '[MESSAY COMPANY] Chargement :',
            error
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchCompany();

    return () => {
      cancelled = true;
    };
  }, [companyId, paramName]);

  // ==========================================================
  // DONNÉES À AFFICHER
  // ==========================================================

  const companyName =
    companyData?.name || paramName;

  const companyColor = getValidColor(
    companyData?.color ||
      companyData?.couleur ||
      paramColor
  );

  const gareName =
    garesCount > 0
      ? `${garesCount} gares`
      : companyData?.gare_name || 'PREMIUM';

  const userData = {
    name: user
      ? `${user.prenom || ''} ${user.nom || ''}`.trim() ||
        'Utilisateur'
      : 'Invité',
    phone: user?.telephone || 'Non renseigné',
    email: user?.email || '',
  };

  // ==========================================================
  // MENU
  // ==========================================================

  const menuItems: MenuItem[] = [
    {
      icon: 'ticket',
      label: 'Achat tickets',
      desc: 'Réservez votre place en 2 min',
      color: '#FF6B35',
      lib: 'FontAwesome5',
    },
    {
      icon: 'people',
      label: 'Achat pour un tiers',
      desc: 'Offrez un billet à un proche',
      color: '#3B82F6',
      lib: 'Ionicons',
    },
    {
      icon: 'ticket-alt',
      label: 'Mes tickets',
      desc: 'Vos billets achetés et à venir',
      color: '#F59E0B',
      lib: 'FontAwesome5',
    },
    {
      icon: 'person',
      label: 'Mon profil',
      desc: 'Gérez vos informations',
      color: '#8B5CF6',
      lib: 'Ionicons',
    },
    {
      icon: 'wallet',
      label: 'Mon compte',
      desc: 'Solde et moyens de paiement',
      color: '#EF4444',
      lib: 'Ionicons',
    },
    {
      icon: 'chatbubbles',
      label: 'Retours client',
      desc: 'Donnez votre avis',
      color: '#10B981',
      lib: 'Ionicons',
    },
    {
      icon: 'call',
      label: "Centre d'appel",
      desc: 'Assistance 24/7',
      color: '#EC4899',
      lib: 'Ionicons',
    },
    {
      icon: 'document-text',
      label: 'Termes et conditions',
      desc: 'Règles et remboursements',
      color: '#6366F1',
      lib: 'Ionicons',
    },
    {
      icon: 'information-circle',
      label: 'A propos',
      desc: `À propos de ${companyName}`,
      color: '#14B8A6',
      lib: 'Ionicons',
    },
    {
      icon: 'share-social',
      label: "Partager l'application",
      desc: 'Parrainez vos amis',
      color: '#0EA5E9',
      lib: 'Ionicons',
    },
    {
      icon: 'log-out',
      label: 'Déconnexion',
      desc: 'Quitter votre compte',
      color: '#DC2626',
      lib: 'Ionicons',
    },
  ];

  // ==========================================================
  // ACTIONS MENU
  // ==========================================================

  const handlePress = (item: MenuItem): void => {
    const realId = companyData?.id || companyId;

    switch (item.label) {
      case 'Achat tickets':
        router.push({
          pathname: '/buy-ticket',
          params: {
            company: companyName,
            color: companyColor,
            id: realId,
          },
        });
        break;

      case 'Achat pour un tiers':
        router.push({
          pathname: '/buy-ticket',
          params: {
            company: companyName,
            color: companyColor,
            tier: 'true',
            id: realId,
          },
        });
        break;

      case 'Mes tickets':
        router.push('/mes-tickets');
        break;

      case 'Mon profil':
        router.push('/(tabs)/profile');
        break;

      case 'Mon compte':
        router.push('/mon-compte');
        break;

      case 'Déconnexion':
        Alert.alert(
          'Déconnexion',
          `Au revoir ${userData.name.split(' ')[0]} !`,
          [
            {
              text: 'Annuler',
              style: 'cancel',
            },
            {
              text: 'Oui',
              style: 'destructive',
              onPress: async () => {
                try {
                  await logout();
                  router.replace('/(auth)/login');
                } catch (error: unknown) {
                  Alert.alert(
                    'Erreur',
                    'La déconnexion a échoué.'
                  );
                }
              },
            },
          ]
        );
        break;

      default:
        Alert.alert(item.label, item.desc);
        break;
    }
  };

  // ==========================================================
  // CHARGEMENT
  // ==========================================================

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator
          size="large"
          color={companyColor}
        />
      </View>
    );
  }

  // ==========================================================
  // INTERFACE UTILISATEUR
  // ==========================================================

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={companyColor}
      />

      {/* EN-TÊTE COMPAGNIE */}

      <View style={styles.headerContainer}>
        <Image
          source={getAsset(companyName, 'bus')}
          style={styles.headerBackgroundImage}
          resizeMode="cover"
        />

        <LinearGradient
          colors={[
            `${companyColor}E6`,
            `${companyColor}CC`,
            `${companyColor}99`,
          ]}
          style={styles.headerGradient}
        >
          <View style={styles.glassOverlay} />

          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color="#FFF"
                />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text
                  style={styles.headerTitle}
                  numberOfLines={1}
                >
                  {companyName}
                </Text>

                <View style={styles.premiumBadge}>
                  <Ionicons
                    name="diamond"
                    size={10}
                    color="#FFF"
                  />

                  <Text style={styles.premiumText}>
                    {gareName}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.callBtn}
                onPress={() =>
                  Alert.alert(
                    'Contact',
                    companyData?.telephone ||
                      'Contact non disponible'
                  )
                }
              >
                <Ionicons
                  name="call-outline"
                  size={20}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>

            {/* IDENTITÉ COMPAGNIE */}

            <View style={styles.brandBox}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0.3)',
                    'rgba(255,255,255,0.1)',
                  ]}
                  style={styles.logoGlow}
                >
                  <View style={styles.logoWrapper}>
                    <Image
                      source={getAsset(
                        companyName,
                        'logo'
                      )}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.welcome}>
                  Bienvenue
                </Text>

                <Text style={styles.userName}>
                  {userData.name}
                </Text>

                <View style={styles.phoneRow}>
                  <Ionicons
                    name="call"
                    size={12}
                    color="rgba(255,255,255,0.8)"
                  />

                  <Text style={styles.userPhone}>
                    {userData.phone}
                  </Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* MENU PRINCIPAL */}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={`${item.label}-${index}`}
              style={styles.menuItem}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[
                  `${item.color}20`,
                  `${item.color}10`,
                ]}
                style={styles.iconBox}
              >
                {item.lib === 'FontAwesome5' ? (
                  <FontAwesome5
                    name={
                      item.icon as React.ComponentProps<
                        typeof FontAwesome5
                      >['name']
                    }
                    size={20}
                    color={item.color}
                  />
                ) : (
                  <Ionicons
                    name={
                      item.icon as React.ComponentProps<
                        typeof Ionicons
                      >['name']
                    }
                    size={22}
                    color={item.color}
                  />
                )}
              </LinearGradient>

              <View style={styles.textBox}>
                <Text style={styles.label}>
                  {item.label}
                </Text>

                <Text style={styles.desc}>
                  {item.desc}
                </Text>
              </View>

              <View style={styles.chevronBox}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#D1D5DB"
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* CONSEIL */}

        <LinearGradient
          colors={[
            '#FFFBEB',
            '#FEF3C7',
          ]}
          style={styles.tip}
        >
          <View style={styles.tipIcon}>
            <MaterialIcons
              name="lightbulb"
              size={20}
              color="#F59E0B"
            />
          </View>

          <Text style={styles.tipText}>
            Réservez 24h à l'avance pour garantir
            votre place avec {companyName}
          </Text>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES COMPATIBLES REACT NATIVE 0.86
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    paddingBottom: 35,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    height: 240,
  },
  headerBackgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  headerGradient: {
    flex: 1,
    paddingBottom: 35,
  },

  // CORRECTION EXPO SDK 57 :
  // absoluteFillObject est remplacé par absoluteFill.
  glassOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 24,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  premiumText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  logoContainer: {
    position: 'relative',
  },
  logoGlow: {
    width: 88,
    height: 88,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  logoWrapper: {
    width: 82,
    height: 82,
    borderRadius: 21,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    padding: 10,
  },
  companyLogo: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
  },
  welcome: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  menuList: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textBox: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D1D1F',
    marginBottom: 3,
  },
  desc: {
    fontSize: 13,
    color: '#86868B',
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 40,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '700',
    lineHeight: 19,
  },
});
