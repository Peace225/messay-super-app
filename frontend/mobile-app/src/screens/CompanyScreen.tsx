import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  AccessibilityInfo,

  ActivityIndicator,

  Alert,

  Animated,

  Image,

  Linking,

  Pressable,

  Share,

  StatusBar,

  StyleSheet,

  Text,

  View,

  type ImageSourcePropType,

} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../store/authStore';

import { supabase } from '../services/supabase';



/** Écran compagnie : données réelles et autorisation vérifiée avant réservation. */

const normalize = (value: string): string =>

  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();



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





interface CompanyData {

  id: string;

  name: string;

  color?: string | null;

  couleur?: string | null;

  gare_name?: string | null;

  telephone?: string | null;

  is_verified?: boolean | null;

  is_active?: boolean | null;

  bus_image_url?: string | null;

  logo_url?: string | null;

}



type MenuAction =

  | 'buy' | 'gift' | 'tickets' | 'profile' | 'account'

  | 'feedback' | 'support' | 'terms' | 'about' | 'share' | 'logout';



type MenuItem = {

  id: MenuAction;

  icon: string;

  label: string;

  description: string;

  accent: string;

  library: 'ionicons' | 'fa5';

};



const MENU_ITEMS: MenuItem[] = [

  { id: 'buy', icon: 'ticket-alt', label: 'Acheter un billet', description: 'Choisir un trajet et réserver une place', accent: '#F97316', library: 'fa5' },

  { id: 'gift', icon: 'people-outline', label: 'Billet pour un proche', description: 'Réserver pour un tiers', accent: '#3B82F6', library: 'ionicons' },

  { id: 'tickets', icon: 'receipt-outline', label: 'Mes billets', description: 'Réservations et billets achetés', accent: '#F59E0B', library: 'ionicons' },

  { id: 'profile', icon: 'person-outline', label: 'Mon profil', description: 'Informations personnelles', accent: '#8B5CF6', library: 'ionicons' },

  { id: 'account', icon: 'wallet-outline', label: 'Mon compte', description: 'Paiements et moyens de paiement', accent: '#10B981', library: 'ionicons' },

  { id: 'feedback', icon: 'chatbubbles-outline', label: 'Avis et retours', description: 'Partager votre expérience', accent: '#06B6D4', library: 'ionicons' },

  { id: 'support', icon: 'headset', label: 'Service client', description: 'Contacter la compagnie', accent: '#EC4899', library: 'fa5' },

  { id: 'terms', icon: 'document-text-outline', label: 'Conditions générales', description: 'Informations utiles et remboursements', accent: '#6366F1', library: 'ionicons' },

  { id: 'about', icon: 'information-circle-outline', label: 'À propos', description: 'Découvrir cette compagnie', accent: '#14B8A6', library: 'ionicons' },

  { id: 'share', icon: 'share-social-outline', label: 'Partager MESSAY', description: 'Recommander l’application', accent: '#0EA5E9', library: 'ionicons' },

  { id: 'logout', icon: 'log-out-outline', label: 'Déconnexion', description: 'Quitter votre session', accent: '#EF4444', library: 'ionicons' },

];



function readParam(value: string | string[] | undefined, fallback = ''): string {

  return (Array.isArray(value) ? value[0] : value)?.trim() || fallback;

}



function validHex(value: unknown): string {

  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

    ? value.toUpperCase()

    : '#7C3AED';

}



// L’identité visuelle peut varier selon la compagnie.

function companyVisual(name: string, type: 'logo' | 'bus'): number {

  const exact = COMPANY_ASSETS[name];

  if (exact) return exact[type];

  const key = Object.keys(COMPANY_ASSETS).find((candidate) => {

    const a = normalize(candidate);

    const b = normalize(name);

    // Évite les correspondances accidentelles sur des noms trop courts.

    return a === b || (a.length >= 5 && b.includes(a));

  });

  return key ? COMPANY_ASSETS[key][type] : type === 'logo' ? FALLBACK_LOGO : FALLBACK_BUS;

}



function imageOf(company: CompanyData | null, name: string, type: 'logo' | 'bus'): ImageSourcePropType {

  const remote = type === 'logo' ? company?.logo_url : company?.bus_image_url;

  if (typeof remote === 'string' && /^https:\/\/[^\s]+$/i.test(remote.trim())) return { uri: remote.trim() };

  return companyVisual(name, type);

}



function MenuCard({ item, reveal, onPress }: {

  item: MenuItem;

  reveal: Animated.Value;

  onPress: () => void;

}) {

  const pressScale = useRef(new Animated.Value(1)).current;

  const lift = reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const pressIn = () => Animated.spring(pressScale, {

    toValue: 0.975, speed: 28, bounciness: 0, useNativeDriver: true,

  }).start();

  const pressOut = () => Animated.spring(pressScale, {

    toValue: 1, speed: 22, bounciness: 5, useNativeDriver: true,

  }).start();



  return (

    <Animated.View style={{ opacity: reveal, transform: [{ translateY: lift }] }}>

      <Animated.View style={[styles.menuCard, { transform: [{ scale: pressScale }] }]}>

        <Pressable

          accessibilityRole="button"

          accessibilityLabel={item.label}

          accessibilityHint={item.description}

          testID={`company-menu-${item.id}`}

          onPressIn={pressIn}

          onPressOut={pressOut}

          onPress={onPress}

          style={styles.menuPressable}

        >

          <View style={[styles.menuIcon, { backgroundColor: `${item.accent}14` }]}>

            {item.library === 'fa5' ? (

              <FontAwesome5

                name={item.icon as React.ComponentProps<typeof FontAwesome5>['name']}

                size={19} color={item.accent}

              />

            ) : (

              <Ionicons

                name={item.icon as React.ComponentProps<typeof Ionicons>['name']}

                size={22} color={item.accent}

              />

            )}

          </View>

          <View style={styles.menuCopy}>

            <Text style={styles.menuLabel}>{item.label}</Text>

            <Text style={styles.menuDescription}>{item.description}</Text>

          </View>

          <View style={styles.chevronCircle}>

            <Ionicons name="chevron-forward" size={15} color="#64748B" />

          </View>

        </Pressable>

      </Animated.View>

    </Animated.View>

  );

}



export default function CompanyScreen() {

  const router = useRouter();

  const { name, color, id } = useLocalSearchParams();

  const { user, logout } = useAuthStore();

  const insets = useSafeAreaInsets();



  const companyId = readParam(id);

  const routeName = readParam(name, 'Compagnie');

  const routeColor = validHex(readParam(color, '#7C3AED'));



  const [company, setCompany] = useState<CompanyData | null>(null);

  const [stationCount, setStationCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [retryKey, setRetryKey] = useState(0);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [checkingBooking, setCheckingBooking] = useState(false);



  const scrollY = useRef(new Animated.Value(0)).current;

  const heroReveal = useRef(new Animated.Value(0)).current;

  const logoFloat = useRef(new Animated.Value(0)).current;

  const haloPulse = useRef(new Animated.Value(0)).current;

  const menuReveals = useRef(MENU_ITEMS.map(() => new Animated.Value(0))).current;

  const heroImageTranslate = scrollY.interpolate({

    inputRange: [-90, 0, 210], outputRange: [-32, 0, 75], extrapolate: 'clamp',

  });

  const heroImageScale = scrollY.interpolate({

    inputRange: [-90, 0, 210], outputRange: [1.26, 1.08, 1.08], extrapolate: 'clamp',

  });



  useEffect(() => {

    void AccessibilityInfo.isReduceMotionEnabled()

      .then(setReduceMotion)

      .catch(() => undefined);

  }, []);



  useEffect(() => {

    let active = true;

    const loadCompany = async () => {

      setLoading(true);

      setErrorMessage(null);

      setStationCount(null);

      setCompany(null);



      try {

        let found: CompanyData | null = null;

        let loadError: string | null = null;



        if (companyId) {

          const result = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();

          if (result.error) loadError = result.error.message;

          if (result.data) found = result.data as CompanyData;

        }

        if (!companyId && !found && routeName !== 'Compagnie') {

          // Recherche exacte, insensible à la casse, pour éviter d'ouvrir une mauvaise compagnie.

          const result = await supabase.from('companies').select('*').ilike('name', routeName).limit(1).maybeSingle();

          if (result.error) loadError = result.error.message;

          if (result.data) found = result.data as CompanyData;

        }

        if (!active) return;



        if (found && (found.is_active !== true || found.is_verified !== true)) {

          setErrorMessage('Cette compagnie n’est pas encore approuvée ou n’est pas active.');

          return;

        }

        if (!found) {

          setErrorMessage(loadError

            ? 'Impossible de charger la compagnie. Vérifiez votre connexion.'

            : 'Compagnie introuvable. Revenez à la liste des compagnies.');

          return;

        }

        setCompany(found);



        const stations = await supabase.from('gares')

          .select('id', { count: 'exact', head: true })

          .eq('company_id', found.id);

        if (!active) return;

        if (stations.error) {

          if (__DEV__) console.warn('[MESSAY] Chargement des gares :', stations.error.message);

        } else {

          setStationCount(stations.count ?? 0);

        }

      } catch (err: unknown) {

        if (__DEV__) console.warn('[MESSAY] Compagnie :', err);

        if (active) setErrorMessage('Réseau indisponible. Réessayez dans quelques instants.');

      } finally {

        if (active) setLoading(false);

      }

    };



    void loadCompany();

    return () => { active = false; };

  }, [companyId, routeName, retryKey]);



  useEffect(() => {

    if (loading) return;

    heroReveal.stopAnimation();

    heroReveal.setValue(reduceMotion ? 1 : 0);

    menuReveals.forEach((value) => {

      value.stopAnimation();

      value.setValue(reduceMotion ? 1 : 0);

    });

    if (reduceMotion) return;



    const intro = Animated.timing(heroReveal, {

      toValue: 1, duration: 600, useNativeDriver: true,

    });

    const items = Animated.stagger(70, menuReveals.map((value) => Animated.timing(value, {

      toValue: 1, duration: 420, useNativeDriver: true,

    })));

    const animation = Animated.parallel([intro, Animated.sequence([Animated.delay(180), items])]);

    animation.start();

    return () => animation.stop();

  }, [heroReveal, loading, menuReveals, reduceMotion]);



  // Mouvement discret, entièrement suspendu si l'utilisateur préfère moins d'animations.

  useEffect(() => {

    logoFloat.setValue(0);

    haloPulse.setValue(0);

    if (loading || reduceMotion) return;



    const floating = Animated.loop(Animated.sequence([

      Animated.timing(logoFloat, { toValue: -5, duration: 2300, useNativeDriver: true }),

      Animated.timing(logoFloat, { toValue: 0, duration: 2300, useNativeDriver: true }),

    ]));

    const breathing = Animated.loop(Animated.sequence([

      Animated.timing(haloPulse, { toValue: 1, duration: 2800, useNativeDriver: true }),

      Animated.timing(haloPulse, { toValue: 0, duration: 2800, useNativeDriver: true }),

    ]));

    floating.start();

    breathing.start();

    return () => { floating.stop(); breathing.stop(); };

  }, [haloPulse, loading, logoFloat, reduceMotion]);



  const companyName = company?.name || routeName;

  const companyColor = validHex(company?.color || company?.couleur || routeColor);

  const userName = user

    ? [user.prenom, user.nom].filter(Boolean).join(' ').trim() || 'Utilisateur'

    : 'Invité';


  const badgeText = stationCount !== null

    ? `${stationCount} ${stationCount === 1 ? 'gare' : 'gares'}`

    : company?.gare_name || 'Transport interurbain';



  const back = useCallback(() => {

    if (router.canGoBack()) router.back();

    else router.replace('/');

  }, [router]);



  const callCompany = useCallback(() => {

    const phone = company?.telephone?.trim();

    const sanitized = phone?.replace(/[^+\d]/g, '') ?? '';

    if (!/^\+?\d{6,15}$/.test(sanitized)) {

      Alert.alert('Contact indisponible', 'Aucun numéro de téléphone valide pour cette compagnie.');

      return;

    }

    void Linking.openURL(`tel:${sanitized}`).catch(() => {

      Alert.alert('Appel impossible', 'Votre appareil ne peut pas ouvrir le composeur téléphonique.');

    });

  }, [company?.telephone]);



  const openBooking = useCallback(async (forAnotherPassenger = false) => {
    if (!company?.id || checkingBooking) {
      if (!company?.id) Alert.alert('Compagnie indisponible', 'Impossible d’identifier cette compagnie.');
      return;
    }

    setCheckingBooking(true);
    try {
      // Lecture fraîche : le statut ne doit jamais dépendre des paramètres de navigation.
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, is_verified, is_active, color, couleur')
        .eq('id', company.id)
        .maybeSingle();

      if (error) throw error;
      if (!data || data.is_active !== true) {
        Alert.alert('Réservations indisponibles', 'Cette compagnie n’est pas active actuellement.');
        return;
      }
      if (data.is_verified !== true) {
        Alert.alert('Réservations indisponibles', 'Cette compagnie est en attente de vérification par MESSAY. La vente de billets est désactivée.');
        return;
      }

      router.push({
        pathname: '/buy-ticket',
        params: {
          id: data.id,
          company: data.name,
          color: validHex(data.color || data.couleur || companyColor),
          ...(forAnotherPassenger ? { tier: 'true' } : {}),
        },
      });
    } catch (error) {
      if (__DEV__) console.warn('[MESSAY] Vérification réservation :', error);
      Alert.alert('Connexion indisponible', 'Impossible de vérifier la compagnie. Réessayez lorsque votre connexion sera rétablie.');
    } finally {
      setCheckingBooking(false);
    }
  }, [company?.id, companyColor, checkingBooking, router]);

  const handleMenu = useCallback((action: MenuAction) => {
    switch (action) {
      case 'buy': void openBooking(); return;
      case 'gift': void openBooking(true); return;
      case 'tickets': router.push('/mes-tickets'); return;
      case 'profile': router.push('/(tabs)/profile'); return;
      case 'account': router.push('/mon-compte'); return;
      case 'support': callCompany(); return;
      case 'about':
        Alert.alert(companyName, [badgeText, company?.telephone ? `Téléphone : ${company.telephone}` : ''].filter(Boolean).join('\n'));
        return;
      case 'share':
        void Share.share({ message: `Découvrez ${companyName} sur MESSAY, votre application de transport interurbain.` })
          .catch(() => Alert.alert('Partage impossible', 'Veuillez réessayer.'));
        return;
      case 'logout':
        Alert.alert('Déconnexion', `Déconnecter ${userName} ?`, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Déconnexion', style: 'destructive', onPress: () => {
            void Promise.resolve(logout()).then(() => router.replace('/(auth)/login'))
              .catch(() => Alert.alert('Erreur', 'La déconnexion a échoué.'));
          } },
        ]);
        return;
      case 'feedback':
      case 'terms':
        Alert.alert('Indisponible', 'Ce service n’est pas disponible actuellement.');
        return;
    }
  }, [badgeText, callCompany, company, companyName, logout, openBooking, router, userName]);

  const heroOpacity = heroReveal;

  const heroEntrance = heroReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const menu = useMemo(() => MENU_ITEMS, []);

  const quickMenu = menu.slice(0, 3);

  const accountMenu = menu.filter(item => item.id === 'profile' || item.id === 'account');

  const extraMenu = menu.filter(item => !['buy', 'gift', 'tickets', 'profile', 'account', 'logout'].includes(item.id));

  const logoutMenu = menu.find(item => item.id === 'logout');

  const logoLift = reduceMotion ? 0 : logoFloat;

  const haloScale = reduceMotion ? 1 : haloPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });





  if (loading) {

    return (

      <View style={styles.centered}>

        <StatusBar barStyle="dark-content" />

        <ActivityIndicator size="large" color={companyColor} />

        <Text style={styles.loadingText}>Chargement de la compagnie…</Text>

      </View>

    );

  }



  if (errorMessage && !company) {

    return (

      <SafeAreaView style={styles.centered}>

        <StatusBar barStyle="dark-content" />

        <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={32} color="#EA580C" /></View>

        <Text style={styles.errorTitle}>Compagnie indisponible</Text>

        <Text style={styles.errorText}>{errorMessage}</Text>

        <Pressable onPress={() => setRetryKey((key) => key + 1)} style={styles.retryButton}>

          <Ionicons name="refresh" size={18} color="#FFFFFF" />

          <Text style={styles.retryText}>Réessayer</Text>

        </Pressable>

        <Pressable onPress={back} style={styles.backLink}><Text style={styles.backLinkText}>Revenir en arrière</Text></Pressable>

      </SafeAreaView>

    );

  }



  return (

    <View style={styles.container}>

      <StatusBar barStyle="light-content" />

      <Animated.ScrollView

        showsVerticalScrollIndicator={false}

        bounces

        scrollEventThrottle={16}

        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}

        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 26 }}

      >

        <View style={styles.hero}>

          <Animated.Image

            source={imageOf(company, companyName, 'bus')}

            resizeMode="cover"

            style={[styles.heroImage, {

              transform: [{ translateY: reduceMotion ? 0 : heroImageTranslate }, { scale: reduceMotion ? 1.08 : heroImageScale }],

            }]}

          />

          <Animated.View pointerEvents="none" style={[styles.decorOrb, { transform: [{ scale: haloScale }] }]} />

          <LinearGradient

            colors={['rgba(11,18,34,0.72)', `${companyColor}D6`, 'rgba(10,19,35,0.98)']}

            locations={[0, 0.45, 1]}

            style={styles.heroGradient}

          >

            <SafeAreaView edges={['top']}>

              <View style={styles.toolbar}>

                <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Retour" style={styles.glassButton}>

                  <Ionicons name="arrow-back" color="#FFFFFF" size={22} />

                </Pressable>

                <View style={styles.toolbarTitleWrap}>

                  <Text style={styles.toolbarOverline}>TRANSPORT INTERURBAIN</Text>

                  <Text style={styles.toolbarTitle} numberOfLines={1}>{companyName}</Text>

                </View>

                <Pressable onPress={callCompany} accessibilityRole="button" accessibilityLabel="Appeler la compagnie" style={styles.glassButton}>

                  <Ionicons name="call-outline" color="#FFFFFF" size={21} />

                </Pressable>

              </View>

              <Animated.View style={[styles.heroIdentity, { opacity: heroOpacity, transform: [{ translateY: heroEntrance }] }]}>

                <Animated.View style={[styles.logoHalo, { transform: [{ translateY: logoLift }, { scale: haloScale }] }]}>

                  <View style={styles.logoFrame}>

                    <Image source={imageOf(company, companyName, 'logo')} style={styles.logoImage} resizeMode="contain" />

                  </View>

                </Animated.View>

                <View style={styles.identityCopy}>

                  <Text style={styles.welcomeLabel}>VOTRE COMPAGNIE DE VOYAGE</Text>

                  <Text style={styles.passengerName} numberOfLines={2}>{companyName}</Text>

                  <Text style={styles.heroWelcome} numberOfLines={1}>Bienvenue, {userName}</Text>

                  <View style={styles.companyBadge}>

                    <Ionicons name="location-outline" size={13} color="#FFFFFF" />

                    <Text style={styles.badgeText} numberOfLines={1}>{badgeText}</Text>

                  </View>

                </View>

              </Animated.View>

              <Animated.View style={[styles.heroBottomRow, { opacity: heroOpacity }]}>

                <View style={styles.heroStatusPill}>

                  <Ionicons name={company?.is_verified === true ? 'shield-checkmark' : 'time-outline'} color="#FFFFFF" size={13} />

                  <Text style={styles.heroStatusText}>{company?.is_verified === true ? 'Compagnie vérifiée' : 'Compagnie inscrite'}</Text>

                </View>

                <View style={styles.heroBottomDivider} />

                <Text style={styles.heroEndText}>VOYAGEZ AUTREMENT</Text>

              </Animated.View>

            </SafeAreaView>

          </LinearGradient>

        </View>



        <View style={styles.content}>

          {company && company.is_verified !== true && (

            <View style={styles.reviewBanner}>

              <Ionicons name="shield-outline" size={19} color="#9A3412" />

              <Text style={styles.reviewBannerText}>

                Compagnie en attente de vérification par MESSAY. La consultation est disponible, mais les réservations sont désactivées.
              </Text>

            </View>

          )}

          {/* Réservation mise en avant — fonctionnalité réelle, aucune tarification fictive. */}

          <Animated.View style={[styles.actionBanner, { opacity: heroOpacity, transform: [{ translateY: heroEntrance }] }]}>

            <View style={styles.bannerEyebrow}>

              <View style={[styles.bannerSparkle, { backgroundColor: `${companyColor}16` }]}>

                <Ionicons name="sparkles-outline" size={16} color={companyColor} />

              </View>

              <Text style={styles.bannerEyebrowText}>L'EXPÉRIENCE MESSAY</Text>

            </View>

            <Text style={styles.bannerTitle}>Votre prochain voyage commence ici.</Text>

            <Text style={styles.bannerSubtitle}>Explorez les trajets de {companyName} et réservez votre place. Votre siège sera attribué par la compagnie après confirmation du paiement.</Text>

            <Pressable

              accessibilityRole="button"

              accessibilityLabel="Voir les trajets et réserver un billet"

              onPress={() => handleMenu('buy')}

              style={styles.bookPressable}

            >

              <LinearGradient

                colors={[companyColor, '#EA580C']}

                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}

                style={styles.bookGradient}

              >

                <Ionicons name="ticket-outline" size={19} color="#FFFFFF" />

                <Text style={styles.bookText}>{checkingBooking ? 'Vérification…' : 'Voir les trajets & réserver'}</Text>

                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />

              </LinearGradient>

            </Pressable>

          </Animated.View>



          <View style={styles.headingRow}>

            <View>

              <Text style={styles.headingOverline}>LES ESSENTIELS</Text>

              <Text style={styles.sectionHeading}>Voyagez à votre façon</Text>

            </View>

            <View style={[styles.headingAccent, { backgroundColor: companyColor }]} />

          </View>



          <View style={styles.quickActions}>

            {quickMenu.map((item, index) => (

              <Animated.View key={item.id} style={[styles.quickActionFrame, {

                opacity: menuReveals[index],

                transform: [{ translateY: menuReveals[index].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],

              }]}>

                <Pressable

                  accessibilityRole="button"

                  accessibilityLabel={item.label}

                  onPress={() => handleMenu(item.id)}

                  style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}

                >

                  <View style={[styles.quickIcon, { backgroundColor: `${item.accent}12` }]}>

                    {item.library === 'fa5' ? (

                      <FontAwesome5 name={item.icon as React.ComponentProps<typeof FontAwesome5>['name']} size={19} color={item.accent} />

                    ) : (

                      <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={23} color={item.accent} />

                    )}

                  </View>

                  <Text style={styles.quickLabel} numberOfLines={2}>{item.label}</Text>

                  <Ionicons name="arrow-forward" color="#94A3B8" size={14} />

                </Pressable>

              </Animated.View>

            ))}

          </View>



          <View style={styles.headingRow}>

            <View>

              <Text style={styles.headingOverline}>VOTRE ESPACE PERSONNEL</Text>

              <Text style={styles.sectionHeading}>Mon espace</Text>

            </View>

            <Ionicons name="person-circle-outline" size={22} color="#94A3B8" />

          </View>

          <View style={styles.menuList}>

            {accountMenu.map(item => (

              <MenuCard

                key={item.id} item={item}

                reveal={menuReveals[menu.findIndex(other => other.id === item.id)]}

                onPress={() => handleMenu(item.id)}

              />

            ))}

          </View>



          <View style={styles.headingRow}>

            <View>

              <Text style={styles.headingOverline}>TOUJOURS À VOS CÔTÉS</Text>

              <Text style={styles.sectionHeading}>Services & assistance</Text>

            </View>

            <Ionicons name="heart-outline" size={22} color="#94A3B8" />

          </View>

          <View style={styles.menuList}>

            {extraMenu.map(item => (

              <MenuCard

                key={item.id} item={item}

                reveal={menuReveals[menu.findIndex(other => other.id === item.id)]}

                onPress={() => handleMenu(item.id)}

              />

            ))}

          </View>



          {company?.telephone && (

            <Pressable accessibilityRole="button" accessibilityLabel="Appeler la compagnie" onPress={callCompany} style={styles.hotlineCard}>

              <View style={[styles.hotlineIcon, { backgroundColor: `${companyColor}16` }]}>

                <Ionicons name="call-outline" size={20} color={companyColor} />

              </View>

              <View style={styles.hotlineTextWrap}>

                <Text style={styles.hotlineTitle}>Besoin d'une information ?</Text>

                <Text style={styles.hotlineSubtitle}>Contacter directement la compagnie</Text>

              </View>

              <Ionicons name="arrow-forward" color={companyColor} size={19} />

            </Pressable>

          )}



          {logoutMenu && (

            <View style={styles.logoutWrap}>

              <MenuCard item={logoutMenu} reveal={menuReveals[menu.length - 1]} onPress={() => handleMenu('logout')} />

            </View>

          )}



          <View style={styles.tipBox}>

            <View style={styles.tipIcon}><MaterialIcons name="lightbulb-outline" size={20} color="#D97706" /></View>

            <Text style={styles.tipText}>Pour voyager sereinement, vérifiez les horaires et la disponibilité des places avant le départ.</Text>

          </View>

          <Text style={styles.footerText}>MESSAY · Transport interurbain</Text>

        </View>

      </Animated.ScrollView>

    </View>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F6F7FB' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 26 },

  loadingText: { marginTop: 16, color: '#64748B', fontSize: 14, fontWeight: '600' },

  errorIcon: { width: 74, height: 74, borderRadius: 26, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },

  errorTitle: { fontSize: 23, fontWeight: '800', color: '#0F172A', textAlign: 'center' },

  errorText: { marginTop: 9, textAlign: 'center', color: '#64748B', lineHeight: 21 },

  retryButton: { backgroundColor: '#EA580C', paddingHorizontal: 23, paddingVertical: 14, marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15 },

  retryText: { color: '#FFFFFF', fontWeight: '800' },

  backLink: { paddingVertical: 14, marginTop: 7 },

  backLinkText: { color: '#475569', fontWeight: '600' },

  hero: { minHeight: 330, overflow: 'hidden', borderBottomLeftRadius: 34, borderBottomRightRadius: 34, backgroundColor: '#0F172A' },

  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  heroGradient: { flex: 1, minHeight: 330, paddingBottom: 48 },

  toolbar: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },

  glassButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },

  toolbarTitleWrap: { flex: 1, alignItems: 'center' },

  toolbarOverline: { fontSize: 9, color: 'rgba(255,255,255,0.70)', letterSpacing: 2.0, fontWeight: '800' },

  toolbarTitle: { marginTop: 3, fontSize: 17, color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },

  heroIdentity: { paddingHorizontal: 23, paddingTop: 30, flexDirection: 'row', alignItems: 'center', gap: 17 },

  logoHalo: { width: 98, height: 98, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  logoFrame: { width: 82, height: 82, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 11, elevation: 8, shadowColor: '#000', shadowOpacity: 0.17, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },

  logoImage: { width: '100%', height: '100%' },

  identityCopy: { flex: 1 },

  welcomeLabel: { fontSize: 9, letterSpacing: 1.4, fontWeight: '800', color: 'rgba(255,255,255,0.80)' },

  passengerName: { fontSize: 23, fontWeight: '900', color: '#FFFFFF', lineHeight: 27, marginTop: 3 },

  companyBadge: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 11, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, flexDirection: 'row', gap: 5, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.15)' },

  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },

  content: { marginTop: -22, paddingHorizontal: 18 },

  reviewBanner: { marginBottom: 12, padding: 13, borderRadius: 15, borderColor: '#FED7AA', borderWidth: 1, backgroundColor: '#FFF7ED', flexDirection: 'row', alignItems: 'center', gap: 10 },

  reviewBannerText: { flex: 1, fontSize: 12, color: '#9A3412', lineHeight: 19, fontWeight: '700' },

  actionBanner: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 22, paddingHorizontal: 20, borderWidth: 1, borderColor: '#F1F5F9', elevation: 5, shadowColor: '#0F172A', shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },

  bannerCopy: { flex: 1, paddingRight: 8 },

  bannerEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  bannerEyebrowText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, color: '#EA580C' },

  bannerTitle: { color: '#0F172A', fontSize: 21, fontWeight: '900', marginTop: 12, lineHeight: 27 },

  bannerSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 20, marginTop: 7 },

  bannerButton: { width: 48, height: 48, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

  headingRow: { marginTop: 28, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  sectionHeading: { fontSize: 19, fontWeight: '900', color: '#0F172A' },

  headingAccent: { width: 28, height: 4, backgroundColor: '#F97316', borderRadius: 20 },

  menuList: { gap: 10 },

  menuCard: { borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF1F5', shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },

  menuPressable: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },

  menuIcon: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 13 },

  menuCopy: { flex: 1 },

  menuLabel: { fontSize: 14.5, fontWeight: '800', color: '#172033' },

  menuDescription: { color: '#7C879A', fontSize: 11.5, marginTop: 3, lineHeight: 17 },

  chevronCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center', marginLeft: 7 },

  tipBox: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', padding: 16, borderRadius: 17, marginTop: 22 },

  tipIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },

  tipText: { flex: 1, color: '#92400E', fontSize: 12, fontWeight: '600', lineHeight: 19 },

  footerText: { color: '#94A3B8', fontSize: 11, textAlign: 'center', marginTop: 24, fontWeight: '600', letterSpacing: 0.5 },

  decorOrb: { position: 'absolute', top: 78, right: -72, width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.045)' },

  heroWelcome: { marginTop: 5, color: 'rgba(255,255,255,0.83)', fontSize: 12, fontWeight: '600' },

  heroBottomRow: { marginTop: 27, paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', gap: 11 },

  heroStatusPill: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.13)' },

  heroStatusText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  heroBottomDivider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  heroEndText: { fontSize: 9, letterSpacing: 1.1, color: 'rgba(255,255,255,0.76)', fontWeight: '800' },

  bannerSparkle: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  bookPressable: { borderRadius: 16, overflow: 'hidden', marginTop: 18 },

  bookGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 51, paddingHorizontal: 15, borderRadius: 16 },

  bookText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', flex: 1, textAlign: 'center' },

  headingOverline: { color: '#E46C1D', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },

  quickActions: { flexDirection: 'row', gap: 9 },

  quickActionFrame: { flex: 1, minWidth: 0 },

  quickAction: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF1F5', borderRadius: 19, paddingHorizontal: 7, paddingTop: 14, paddingBottom: 10, minHeight: 117, gap: 6, elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },

  quickActionPressed: { opacity: 0.82, transform: [{ scale: 0.975 }] },

  quickIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  quickLabel: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#172033', textAlign: 'center', minHeight: 27 },

  hotlineCard: { marginTop: 20, borderRadius: 18, borderWidth: 1, borderColor: '#E5EAF2', padding: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12 },

  hotlineIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  hotlineTextWrap: { flex: 1 },

  hotlineTitle: { color: '#172033', fontSize: 13, fontWeight: '800' },

  hotlineSubtitle: { color: '#7C879A', fontSize: 11, marginTop: 3 },

  logoutWrap: { marginTop: 20 },

});
