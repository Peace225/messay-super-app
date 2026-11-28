import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';

const ORANGE = '#F97316';
const WHITE = '#FFFFFF';
const FALLBACK_BUS = require('../../assets/images/bus.jpg');
const keyOf = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

// Les images locales servent UNIQUEMENT aux compagnies déjà enregistrées en base.
// Elles ne créent jamais de fausses compagnies ni de statistiques artificielles.
const LOCAL_ASSETS: Record<string, { image: ImageSourcePropType; logo: ImageSourcePropType }> = {
  'UTB CI': { image: require('../../assets/images/bus_utb.jpg'), logo: require('../../assets/logos/utb.png') },
  'TRANSPORTS AVS': { image: require('../../assets/images/bus_avs.jpg'), logo: require('../../assets/logos/avs.png') },
  'CTE TRANSPORT EXPRESS': { image: require('../../assets/images/bus_cte.jpg'), logo: require('../../assets/logos/cte.png') },
  'MTK TRANSPORT': { image: require('../../assets/images/bus_mtk.jpg'), logo: require('../../assets/logos/mtk.png') },
  'MD TRANSPORT': { image: require('../../assets/images/bus_mdt.jpg'), logo: require('../../assets/logos/mdt.png') },
  SBTA: { image: require('../../assets/images/bus_sbta.jpg'), logo: require('../../assets/logos/sbta.png') },
  'STAF TRANSPORT': { image: require('../../assets/images/bus_staf.jpg'), logo: require('../../assets/logos/staf.png') },
  'STL TRANSPORT': { image: require('../../assets/images/bus_stl.jpg'), logo: require('../../assets/logos/stl.png') },
  TRANS: { image: require('../../assets/images/bus_trans.jpg'), logo: require('../../assets/logos/trans.png') },
  'CA-TRANS': { image: require('../../assets/images/bus_trans.jpg'), logo: require('../../assets/logos/trans.png') },
  'SITTI TRANSPORT TERRESTE INTERNATIONAL': { image: require('../../assets/images/bus_sitti.jpg'), logo: require('../../assets/logos/sitti.png') },
};
// Remarque : conservez le nom .jpg si votre fichier STAF est bus_staf.jpg.

interface CompanyRow {
  id: string | number;
  name: string;
  color?: string | null;
  couleur?: string | null;
  gare_name?: string | null;
  telephone?: string | null;
  logo_url?: string | null;
  bus_image_url?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

type Company = {
  id: string;
  name: string;
  color: string;
  gareName: string | null;
  verified: boolean;
  image: ImageSourcePropType;
  logo: ImageSourcePropType;
};

function colorOf(value: unknown): string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value) ? value : ORANGE;
}
function remoteOrLocal(url: string | null | undefined, local: ImageSourcePropType): ImageSourcePropType {
  return typeof url === 'string' && /^https:\/\//i.test(url) ? { uri: url } : local;
}
function toCompany(row: CompanyRow): Company | null {
  if (row.is_active !== true || row.is_verified !== true || !row.name?.trim() || row.id === null || row.id === undefined) return null;
  const asset = LOCAL_ASSETS[keyOf(row.name)];
  return {
    id: String(row.id),
    name: row.name.trim(),
    color: colorOf(row.color || row.couleur),
    gareName: row.gare_name?.trim() || null,
    verified: row.is_verified === true,
    image: remoteOrLocal(row.bus_image_url, asset?.image ?? FALLBACK_BUS),
    logo: remoteOrLocal(row.logo_url, asset?.logo ?? FALLBACK_BUS),
  };
}

function AnimatedCompanyCard({ company, index, onPress, reducedMotion }: {
  company: Company;
  index: number;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return; }
    Animated.timing(entrance, {
      toValue: 1, duration: 420, delay: Math.min(index, 10) * 45,
      useNativeDriver: true,
    }).start();
  }, [entrance, index, reducedMotion]);

  const animateScale = (value: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: value, tension: 180, friction: 13, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[styles.cardShell, {
      opacity: entrance,
      transform: [
        { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        { scale },
      ],
    }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir la compagnie ${company.name}`}
        onPress={onPress}
        onPressIn={() => animateScale(0.965)}
        onPressOut={() => animateScale(1)}
        style={styles.card}
      >
        <ImageBackground source={company.image} style={styles.cardImage} imageStyle={styles.cardImageRadius}>
          <LinearGradient colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.72)']} style={styles.photoOverlay}>
            <View style={styles.photoTop}>
              <View style={[styles.initialsBadge, { backgroundColor: company.color }]}>
                <Text numberOfLines={1} style={styles.initialsText}>{company.name.slice(0, 3).toUpperCase()}</Text>
              </View>
              <View style={styles.verifiedMini}>
                <Ionicons
                  name={company.verified ? 'checkmark-circle' : 'time-outline'}
                  size={12}
                  color={company.verified ? '#10B981' : '#B45309'}
                />
                <Text style={[styles.verifiedMiniText, !company.verified && { color: '#92400E' }]}>
                  {company.verified ? 'Vérifiée' : 'Inscrite'}
                </Text>
              </View>
            </View>
            <Text style={styles.photoCaption} numberOfLines={1}>Voyagez en toute simplicité</Text>
          </LinearGradient>
        </ImageBackground>
        <View style={styles.cardContent}>
          <Text numberOfLines={2} style={styles.companyName}>{company.name}</Text>
          <View style={styles.gareRow}>
            <Ionicons name="location-outline" size={14} color="#7B8494" />
            <Text numberOfLines={1} style={styles.gareName}>{company.gareName || 'Consulter les trajets'}</Text>
          </View>
          <View style={styles.cardBottom}>
            <Text style={styles.exploreText}>{company.verified ? 'Voir la compagnie' : 'En validation'}</Text>
            <View style={[styles.arrowCircle, { backgroundColor: `${company.color}18` }]}>
              <Ionicons name="arrow-forward" size={16} color={company.color} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function TicketsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const everLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeLogo, setActiveLogo] = useState(0);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const activeLogoRef = useRef(0);
  const draggingLogosRef = useRef(false);
  const mounted = useRef(true);
  const requestNumber = useRef(0);
  const headerEntrance = useRef(new Animated.Value(0)).current;

  const loadCompanies = useCallback(async (asRefresh = false) => {
    const request = ++requestNumber.current;
    if (asRefresh) setRefreshing(true);
    else if (!everLoaded.current) setLoading(true);
    try {
      // La table Supabase est la source unique pour mobile et dashboards.
      // Aucune compagnie locale ne s'affiche si Supabase est indisponible.
      const { data, error: dbError } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });
      if (dbError) throw dbError;
      const rows = (data ?? []) as CompanyRow[];
      const updated = rows.map(toCompany).filter((item): item is Company => item !== null);
      if (mounted.current && request === requestNumber.current) {
        setCompanies(updated);
        everLoaded.current = true;
        setError(null);
      }
    } catch (caught) {
      console.warn('[MESSAY/COMPANIES]', caught);
      if (mounted.current && request === requestNumber.current) {
        setError('Impossible de joindre le répertoire des compagnies. Réessayez.');
      }
    } finally {
      if (mounted.current && request === requestNumber.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!mounted.current) return;
      setReducedMotion(value);
      if (value) headerEntrance.setValue(1);
      else Animated.timing(headerEntrance, { toValue: 1, duration: 550, useNativeDriver: true }).start();
    }).catch(() => headerEntrance.setValue(1));
    void loadCompanies();
    return () => { mounted.current = false; };
    // Premier chargement uniquement ; autres actualisations dans l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase.channel('messay-public-companies').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'companies' },
      () => { void loadCompanies(true); },
    ).subscribe();
    const stateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void loadCompanies(true);
    });
    // Repli si Realtime n'est pas activé côté Supabase.
    const timer = setInterval(() => void loadCompanies(true), 60_000);
    return () => {
      clearInterval(timer);
      stateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [loadCompanies]);

  const filtered = useMemo(() => {
    const term = keyOf(search);
    return companies.filter(item => keyOf(`${item.name} ${item.gareName || ''}`).includes(term));
  }, [companies, search]);
  // Le carrousel affiche TOUTES les compagnies enregistrées, même avant leur vérification.
  // Leur statut reste visible ; seuls les achats exigent la validation ADMIN.
  const partners = companies;

  // Réinitialiser la pagination si la liste évolue (inscriptions / désactivations).
  useEffect(() => {
    if (activeLogoRef.current >= partners.length) {
      activeLogoRef.current = 0;
      setActiveLogo(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [partners.length]);

  // Carrousel automatique. Un glissement manuel reste prioritaire.
  // Aucun rafraîchissement du catalogue n'est déclenché par l'animation.
  useEffect(() => {
    if (partners.length < 2 || reducedMotion) return;
    const timer = setInterval(() => {
      if (draggingLogosRef.current || AppState.currentState !== 'active') return;
      const next = (activeLogoRef.current + 1) % partners.length;
      activeLogoRef.current = next;
      setActiveLogo(next);
      scrollRef.current?.scrollTo({ x: next * 94, animated: true });
    }, 3_600);
    return () => clearInterval(timer);
  }, [partners.length, reducedMotion]);

  const onLogoSwipeEnd = (x: number) => {
    const index = Math.max(0, Math.min(partners.length - 1, Math.round(x / 94)));
    activeLogoRef.current = index;
    setActiveLogo(index);
    draggingLogosRef.current = false;
  };

  // La consultation de la fiche est toujours possible pour une compagnie inscrite.
  // La validation ADMIN doit être contrôlée uniquement à l'étape de réservation.
  const openCompany = (company: Company) => {
    router.push({
      pathname: '/company/[id]',
      params: { id: company.id, name: company.name, color: company.color },
    });
  };

  if (loading && companies.length === 0) return (
    <SafeAreaView style={styles.fullLoader}>
      <ActivityIndicator size="large" color={ORANGE} />
      <Text style={styles.loaderText}>Chargement des compagnies…</Text>
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={{ opacity: headerEntrance, transform: [{ translateY: headerEntrance.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
        <LinearGradient colors={['#F97316', '#EA580C', '#C2410C']} style={styles.headerGradient}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} accessibilityLabel="Retour" style={styles.roundButton}>
                <Ionicons name="chevron-back" size={22} color={WHITE} />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerEyebrow}>MESSAY · VOYAGES</Text>
                <Text style={styles.headerTitle}>Compagnies de transport</Text>
                <Text style={styles.headerSub}>{companies.length} compagnie{companies.length > 1 ? 's' : ''} inscrite{companies.length > 1 ? 's' : ''}</Text>
              </View>
              <Pressable onPress={() => void loadCompanies(true)} accessibilityLabel="Actualiser" style={styles.roundButton}>
                {refreshing ? <ActivityIndicator size="small" color={WHITE} /> : <Ionicons name="refresh" size={20} color={WHITE} />}
              </Pressable>
            </View>
            <View style={styles.heroLine}>
              <MaterialCommunityIcons name="bus-multiple" size={22} color="#FFFFFF" />
              <Text style={styles.heroLineText}>Comparez les compagnies et réservez votre trajet</Text>
            </View>

            {/* CARROUSEL DES LOGOS RESTAURÉ DANS LE HEADER */}
            <View style={styles.headerCarousel}>
              <View style={styles.headerCarouselTop}>
                <Text style={styles.headerCarouselTitle}>Nos compagnies</Text>
                <Text style={styles.headerCarouselCounter}>
                  {partners.length > 0
                    ? `${activeLogo + 1} / ${partners.length}`
                    : 'Aucune compagnie'}
                </Text>
              </View>
              {partners.length > 0 ? (
                <>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    decelerationRate="fast"
                    snapToInterval={94}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.headerLogosRow}
                    onScrollBeginDrag={() => { draggingLogosRef.current = true; }}
                    onScrollEndDrag={event => {
                      // Si le geste n'a pas de momentum, l'indicateur reste juste.
                      onLogoSwipeEnd(event.nativeEvent.contentOffset.x);
                    }}
                    onMomentumScrollEnd={event => onLogoSwipeEnd(event.nativeEvent.contentOffset.x)}
                    accessibilityLabel="Carrousel des logos des compagnies de transport"
                  >
                    {partners.map((company, index) => (
                      <Pressable
                        key={company.id}
                        onPress={() => openCompany(company)}
                        accessibilityRole="button"
                        accessibilityLabel={`${company.name} — ${company.verified ? 'vérifiée' : 'en cours de vérification'}`}
                        style={[styles.logoTile, index === activeLogo && styles.logoTileActive]}
                      >
                        <Image source={company.logo} style={styles.partnerLogo} resizeMode="contain" />
                        <Text style={styles.partnerLabel} numberOfLines={1}>{company.name}</Text>
                        <View style={[styles.logoStatus, company.verified ? styles.logoStatusVerified : styles.logoStatusPending]} />
                      </Pressable>
                    ))}
                  </ScrollView>
                  {partners.length > 1 && (
                    <View style={styles.headerDots}>
                      {partners.length <= 12
                        ? partners.map((company, index) => (
                            <View key={company.id} style={[styles.headerDot, activeLogo === index && styles.headerDotActive]} />
                          ))
                        : <Text style={styles.headerDotCaption}>Glissez pour découvrir les compagnies</Text>}
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.headerEmpty}>
                  Les logos s'afficheront ici dès l'inscription des compagnies.
                </Text>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Animated.View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        renderItem={({ item, index }) => (
          <AnimatedCompanyCard company={item} index={index} reducedMotion={reducedMotion} onPress={() => openCompany(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCompanies(true)} tintColor={ORANGE} colors={[ORANGE]} />}
        ListHeaderComponent={
          <View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                accessibilityLabel="Rechercher une compagnie"
                value={search}
                onChangeText={setSearch}
                placeholder="Compagnie, gare…"
                placeholderTextColor="#98A2B3"
                autoCapitalize="none"
                style={styles.searchInput}
                clearButtonMode="while-editing"
              />
              {!!search && (
                <Pressable accessibilityLabel="Effacer la recherche" onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="cloud-offline-outline" size={18} color="#B42318" />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void loadCompanies(true)}><Text style={styles.retryText}>Réessayer</Text></Pressable>
              </View>
            )}
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Toutes les compagnies</Text>
              <Text style={styles.resultCount}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyState}>
              <Ionicons name="bus-outline" size={36} color="#A9ADB7" />
              <Text style={styles.emptyTitle}>{search ? 'Aucun résultat' : 'Aucune compagnie inscrite'}</Text>
              <Text style={styles.emptyText}>Les nouvelles compagnies enregistrées dans MESSAY apparaîtront ici automatiquement.</Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  fullLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  loaderText: { marginTop: 12, color: '#667085', fontSize: 14 },
  headerGradient: { paddingBottom: 27, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  roundButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: WHITE, textAlign: 'center', marginTop: 2 },
  headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 3 },
  heroLine: { marginHorizontal: 20, marginTop: 23, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroLineText: { flex: 1, fontSize: 13, fontWeight: '600', color: WHITE, lineHeight: 19 },
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 85, flexGrow: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, height: 52, borderRadius: 16, paddingHorizontal: 15, gap: 10, marginBottom: 20, borderWidth: 1, borderColor: '#ECEEF3' },
  searchInput: { flex: 1, color: '#101828', fontSize: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 8 },
  sectionTitle: { color: '#1F2937', fontSize: 17, fontWeight: '900' },
  resultCount: { fontSize: 12, fontWeight: '600', color: '#8792A2' },
  // Carrousel horizontal dans le header (logos réels Supabase).
  headerCarousel: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  headerCarouselTop: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerCarouselTitle: { color: WHITE, fontSize: 15, fontWeight: '900', letterSpacing: 0.1 },
  headerCarouselCounter: { color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '700' },
  headerLogosRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 3 },
  logoTile: { width: 82, alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 7, borderWidth: 2, borderColor: 'transparent' },
  logoTileActive: { borderColor: '#FED7AA', backgroundColor: '#FFFBF5' },
  partnerLogo: { width: 54, height: 49 },
  partnerLabel: { color: '#344054', fontSize: 10, fontWeight: '700', marginTop: 4, width: '100%', textAlign: 'center' },
  logoStatus: { width: 5, height: 5, borderRadius: 3, marginTop: 5 },
  logoStatusVerified: { backgroundColor: '#16A34A' },
  logoStatusPending: { backgroundColor: '#F59E0B' },
  headerDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  headerDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.4)' },
  headerDotActive: { width: 20, backgroundColor: WHITE },
  headerDotCaption: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '600' },
  headerEmpty: { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginHorizontal: 20, paddingVertical: 12 },
  column: { justifyContent: 'space-between', gap: 12 },
  cardShell: { width: '47.7%', marginBottom: 14 },
  card: { flex: 1, backgroundColor: WHITE, borderRadius: 19, borderWidth: 1, borderColor: '#EAECF0', overflow: 'hidden', elevation: 2, shadowColor: '#101828', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  cardImage: { height: 118 },
  cardImageRadius: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  photoOverlay: { flex: 1, padding: 10, justifyContent: 'space-between' },
  photoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3 },
  initialsBadge: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 7, maxWidth: 67 },
  initialsText: { color: WHITE, fontSize: 9, fontWeight: '900' },
  verifiedMini: { backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 5, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedMiniText: { color: '#0F766E', fontSize: 8, fontWeight: '800' },
  photoCaption: { color: WHITE, fontSize: 10, fontWeight: '700' },
  cardContent: { padding: 11, flex: 1 },
  companyName: { color: '#101828', fontWeight: '900', fontSize: 14, minHeight: 38, lineHeight: 19 },
  gareRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  gareName: { color: '#7B8494', fontSize: 11, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, borderTopWidth: 1, borderTopColor: '#F2F4F7', paddingTop: 10 },
  exploreText: { fontSize: 10, fontWeight: '800', color: '#EA580C', flex: 1 },
  arrowCircle: { width: 25, height: 25, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  errorBox: { backgroundColor: '#FEF3F2', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 17 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11 },
  retryText: { color: '#B42318', fontSize: 11, fontWeight: '900' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { color: '#344054', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#98A2B3', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 240 },
});
