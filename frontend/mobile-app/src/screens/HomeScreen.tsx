import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated,
  Dimensions, ImageBackground, StatusBar, Modal,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

const SOCIAL_MESSAGES = [
  { id: 1, user: "Aboubacar", action: "vient de commander", service: "un Tricycle", location: "Adjamé", avatar: "https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=150", type: 'order' },
  { id: 2, user: "MESSAY", action: "Conseil :", service: "Portez toujours votre casque", location: "Sécurité", avatar: null, type: 'civisme', icon: 'shield-alt' },
  { id: 3, user: "Marie-Noëlle", action: "a réservé", service: "Bus VIP", location: "Plateau", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150", type: 'order' },
];

const SERVICES_DATA = [
  { id: 'tricycle', title: 'Tricycle', icon: 'shuttle-van', description: 'Transport Urbain', badge: '🔥 Populaire', badgeColor: '#FF3B30', image: require('../../assets/images/tricycle2.jpg'), path: '/(tabs)/tricycle' },
  { id: 'transport', title: 'Tickets Bus', icon: 'ticket-alt', description: 'Inter-urbain', badge: '⭐ Top', badgeColor: '#FFD60A', image: require('../../assets/images/bus.jpg'), path: '/(tabs)/tickets' },
];

const ServiceCard = ({ item, fadeAnim, onPress }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.cardWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={onPress} onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start()} activeOpacity={0.9} style={styles.cardContainer}>
        <ImageBackground source={item.image} style={styles.cardImg} imageStyle={styles.cardImgRadius}>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardShade} />
          {item.badge && <View style={[styles.badge, { backgroundColor: item.badgeColor }]}><Text style={styles.badgeTxt}>{item.badge}</Text></View>}
          <View style={styles.cardIcon}><FontAwesome5 name={item.icon} size={14} color="#1D1D1F" /></View>
          <View style={styles.cardBottom}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardDesc}>{item.description}</Text></View>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const socialAnim = useRef(new Animated.Value(-120)).current;
  const heroScrollRef = useRef<ScrollView>(null);
  const [currentSocialIndex, setCurrentSocialIndex] = useState(0);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const modalScale = useRef(new Animated.Value(0)).current;

  const heroBanners = useMemo(() => [
    { id: '1', greeting: isAuthenticated? `Salut, ${user?.prenom || user?.nom || 'Membre'} 👋` : 'Bienvenue sur MESSAY 👋', title: 'Tricycle Rapide\nPartout à Abidjan', subtitle: 'À partir de 500 FCFA', cta: 'Commander', path: '/(tabs)/tricycle', image: require('../../assets/images/tricycle2.jpg'), color: '#FF6B35' },
    { id: '2', greeting: '🚌 Transport Interurbain', title: 'Tickets Bus VIP\nAbidjan - Yamoussoukro', subtitle: 'Dès 5 000 FCFA • Climatisé', cta: 'Réserver', path: '/(tabs)/tickets', image: require('../../assets/images/bus.jpg'), color: '#007AFF' },
    { id: '3', greeting: '⚡ MESSAY Express', title: 'Livraison en 30 min\nCourses & Colis', subtitle: 'Suivi GPS en temps réel', cta: 'Essayer', path: '/(tabs)/tricycle', image: require('../../assets/images/hero.png'), color: '#34C759' },
    { id: '4', greeting: '🎁 Offre Spéciale', title: '-20% sur votre\n1ère course', subtitle: 'Code: BIENVENUE', cta: 'Profiter', path: '/(tabs)/tricycle', image: require('../../assets/images/tricycle1.jpg'), color: '#AF52DE' },
  ], [user, isAuthenticated]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    if (isAuthenticated) setTimeout(() => setShowPopup(true), 2500);
    const interval = setInterval(() => {
      Animated.spring(socialAnim, { toValue: 24, friction: 6, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(socialAnim, { toValue: -120, duration: 400, useNativeDriver: true }).start(() => {
          setCurrentSocialIndex(p => (p + 1) % SOCIAL_MESSAGES.length);
        });
      }, 4000);
    }, 8000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const autoScroll = setInterval(() => {
      const nextIndex = (currentHeroIndex + 1) % heroBanners.length;
      heroScrollRef.current?.scrollTo({ x: nextIndex * CARD_WIDTH, animated: true });
      setCurrentHeroIndex(nextIndex);
    }, 4000);
    return () => clearInterval(autoScroll);
  }, [currentHeroIndex, heroBanners.length]);

  useEffect(() => { if (showPopup) Animated.spring(modalScale, { toValue: 1, friction: 6, useNativeDriver: true }).start(); }, [showPopup]);

  const handleServicePress = (path: string) => {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    router.push(path as any);
  };

  if (isLoading) return <View style={styles.loader}><ActivityIndicator size="large" color="#FF6B35" /><Text style={styles.loaderTxt}>Chargement...</Text></View>;

  const currentMsg = SOCIAL_MESSAGES[currentSocialIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.toast, { transform: [{ translateY: socialAnim }] }]}>
        <View style={styles.toastInner}>
          {currentMsg.type === 'order'? <Image source={{ uri: currentMsg.avatar! }} style={styles.toastAvatar} /> : <View style={styles.toastIcon}><FontAwesome5 name={currentMsg.icon as any} size={16} color="#FF6B35" /></View>}
          <View style={{ flex: 1 }}><Text style={styles.toastTitle}>{currentMsg.user} <Text style={styles.toastAction}>{currentMsg.action}</Text></Text><Text style={styles.toastSub}>{currentMsg.service} • {currentMsg.location}</Text></View>
          <View style={styles.liveDot} />
        </View>
      </Animated.View>

      <LinearGradient colors={['#FF6B35', '#ED8936']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <View><Text style={styles.logo}>MESSAY</Text><Text style={styles.tag}>L'EXCELLENCE EN MOUVEMENT</Text></View>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push(isAuthenticated? '/profile' : '/(auth)/login')}><Text style={styles.avatarTxt}>{isAuthenticated? (user?.nom?.charAt(0) || 'M') : '?'}</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.searchWrap}>
          <TouchableOpacity style={styles.search} onPress={() => handleServicePress('/(tabs)/tricycle')}><Ionicons name="search" size={20} color="#FF6B35" /><Text style={styles.searchTxt}>Où allons-nous?</Text><View style={styles.searchPill}><Text style={styles.searchPillTxt}>Maintenant</Text></View></TouchableOpacity>
        </View>

        <View>
          <ScrollView ref={heroScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_WIDTH} snapToAlignment="center" contentContainerStyle={{ paddingHorizontal: 20 }} style={styles.heroScroll} onMomentumScrollEnd={(e) => { const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH); setCurrentHeroIndex(index); }}>
            {heroBanners.map(b => (
              <View key={b.id} style={styles.heroCard}>
                <ImageBackground source={b.image} style={styles.heroImg} imageStyle={styles.heroImgRadius}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.heroGrad}>
                    <Text style={styles.heroHi}>{b.greeting}</Text>
                    <Text style={styles.heroTitle}>{b.title}</Text>
                    <Text style={styles.heroSub}>{b.subtitle}</Text>
                    <TouchableOpacity onPress={() => handleServicePress(b.path)} style={[styles.heroBtn, { backgroundColor: b.color }]}><Text style={styles.heroBtnTxt}>{b.cta}</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></TouchableOpacity>
                  </LinearGradient>
                </ImageBackground>
              </View>
            ))}
          </ScrollView>
          <View style={styles.pagination}>{heroBanners.map((_, i) => <TouchableOpacity key={i} onPress={() => { heroScrollRef.current?.scrollTo({ x: i * CARD_WIDTH, animated: true }); setCurrentHeroIndex(i); }}><View style={[styles.dot, i === currentHeroIndex && styles.dotActive]} /></TouchableOpacity>)}</View>
        </View>

        <View style={styles.section}><View style={styles.grid}>{SERVICES_DATA.map(s => <ServiceCard key={s.id} item={s} fadeAnim={fadeAnim} onPress={() => handleServicePress(s.path)} />)}</View></View>
      </ScrollView>

      <Modal visible={showPopup} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowPopup(false)} />
          <Animated.View style={[styles.modalCard, { transform: [{ scale: modalScale }] }]}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconWrap}><FontAwesome5 name="motorcycle" size={28} color="#FF6B35" /></View>
              <Text style={styles.modalTitle}>Tricycle Pro disponible</Text>
              <Text style={styles.modalSub}>Un chauffeur à 2 min de vous</Text>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowPopup(false); handleServicePress('/(tabs)/tricycle'); }}><Text style={styles.modalBtnTxt}>Commander</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F7' },
  loaderTxt: { color: '#86868B', marginTop: 14, fontWeight: '600' },
  header: { paddingBottom: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, shadowColor: '#FF6B35', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  logo: { fontSize: 30, fontWeight: '900', color: 'white', letterSpacing: 3 },
  tag: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontWeight: '800', fontSize: 18 },
  toast: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 99 },
  toastInner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.95)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  toastAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#F2F7' },
  toastIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,107,53,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  toastTitle: { color: '#1D1D1F', fontWeight: '700', fontSize: 13 },
  toastAction: { color: '#86868B', fontWeight: '500' },
  toastSub: { color: '#FF6B35', fontSize: 11, fontWeight: '700', marginTop: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759', marginLeft: 8 },
  searchWrap: { marginTop: 25, paddingHorizontal: 20, zIndex: 20, marginBottom: 15 },
  search: { height: 60, backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, gap: 12 },
  searchTxt: { flex: 1, color: '#86868B', fontSize: 15, fontWeight: '600' },
  searchPill: { backgroundColor: 'rgba(255,107,53,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  searchPillTxt: { color: '#FF6B35', fontSize: 12, fontWeight: '800' },
  heroScroll: { marginTop: 20 },
  heroCard: { width: CARD_WIDTH, height: 220, marginRight: 16, borderRadius: 24, overflow: 'hidden' },
  heroImg: { flex: 1 },
  heroImgRadius: { borderRadius: 24 },
  heroGrad: { flex: 1, justifyContent: 'flex-end', padding: 24, borderRadius: 24 },
  heroHi: { color: '#FFD60A', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', lineHeight: 32, marginTop: 6 },
  heroSub: { color: 'rgba(255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 14 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, gap: 8 },
  heroBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D1D6' },
  dotActive: { width: 24, backgroundColor: '#FF6B35' },
  section: { paddingHorizontal: 20, marginTop: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardWrap: { width: '48%', height: 190, marginBottom: 16 },
  cardContainer: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgRadius: { borderRadius: 20 },
  cardShade: {...StyleSheet.absoluteFillObject, borderRadius: 20 },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  badgeTxt: { color: 'white', fontSize: 10, fontWeight: '800' },
  cardIcon: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardBottom: { padding: 16 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cardDesc: { color: 'rgba(255,255,0.8)', fontSize: 12, fontWeight: '500', marginTop: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, overflow: 'hidden' },
  modalContent: { padding: 32, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,107,53,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#1D1D1F', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalSub: { color: '#86868B', marginTop: 8, marginBottom: 28, textAlign: 'center', fontSize: 15 },
  modalBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center' },
  modalBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});