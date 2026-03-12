import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  ImageBackground,
  StatusBar,
  SafeAreaView,
  Modal,
  Image,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore'; 
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// --- MIXTE : SOCIAL PROOF & CIVISME ---
const SOCIAL_MESSAGES = [
  { id: 1, user: "Aboubacar", action: "vient de commander", service: "un Tricycle", location: "Adjamé", avatar: "https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=150", type: 'order' },
  { id: 2, user: "MESSAY", action: "Conseil Civique :", service: "Portez toujours votre casque", location: "Sécurité", avatar: null, type: 'civisme', icon: 'shield-alt' },
  { id: 3, user: "Marie-Noëlle", action: "a réservé son ticket", service: "Bus VIP", location: "Plateau", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150", type: 'order' },
  { id: 4, user: "MESSAY", action: "Engagement :", service: "Ne jetez rien par la fenêtre", location: "Propreté", avatar: null, type: 'civisme', icon: 'leaf' },
  { id: 5, user: "Drissa", action: "a commandé du", service: "Sable fin", location: "Angré 8ème", avatar: "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=150", type: 'order' },
  { id: 6, user: "MESSAY", action: "Respect :", service: "Soyez courtois avec le chauffeur", location: "Savoir-vivre", avatar: null, type: 'civisme', icon: 'heart' },
];

const ServiceCard = ({ item, fadeAnim, onPress }) => (
  <Animated.View style={[styles.serviceCardWrapper, { opacity: fadeAnim }]}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.cardTouch}>
      <ImageBackground source={item.image} style={styles.serviceImage} imageStyle={{ borderRadius: 25 }} resizeMode="cover">
        {item.badge && (
          <View style={[styles.badgeContainer, { backgroundColor: item.badgeColor }]}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        <View style={styles.serviceIconFloating}><FontAwesome5 name={item.icon} size={14} color="white" /></View>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.serviceGradient}>
          <Text style={styles.serviceTitlePremium}>{item.title}</Text>
          <Text style={styles.serviceDescSmall}>{item.description}</Text>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  </Animated.View>
);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeBanner, setActiveBanner] = useState(0); 
  const [showPopup, setShowPopup] = useState(false);
  const [currentSocialIndex, setCurrentSocialIndex] = useState(0);
  const socialAnim = useRef(new Animated.Value(-150)).current; 
  const modalScale = useRef(new Animated.Value(0)).current; 
  const driveX = useRef(new Animated.Value(-350)).current; 
  const bumpY = useRef(new Animated.Value(0)).current;      

  const services = [
    { id: 'tricycle', title: 'Tricycle', icon: 'motorcycle', description: 'Transport Urbain', badge: '🔥 Populaire', badgeColor: '#FF3B30', image: require('../../assets/images/tricycle.jpg'), path: '/(tabs)/tricycle' },
    { id: 'transport', title: 'Tickets Bus', icon: 'ticket-alt', description: 'Inter-urbain', badge: '⭐ Top Noté', badgeColor: '#FFD700', image: require('../../assets/images/bus.jpg'), path: '/(tabs)/tickets' },
    { id: 'events', title: 'Événements', icon: 'star', description: 'Tickets & Loisirs', image: require('../../assets/images/event.jpg'), path: '/(tabs)/events' },
    { id: 'btp', title: 'Matériaux', icon: 'truck-pickup', description: 'Livraison BTP', badge: '🆕 Nouveau', badgeColor: '#4CAF50', image: require('../../assets/images/btp.jpg'), path: '/(tabs)/btp' },
  ];

  const heroBanners = [
    { id: '1', greeting: `Salut, ${user?.prenom || 'Kevin'}`, title: 'Votre trajet de luxe\ncommence ici.', cta: 'Réserver', path: '/(tabs)/tricycle', image: require('../../assets/images/hero.png') },
    { id: '2', greeting: 'MESSAY LOGISTIQUE', title: 'Vos matériaux BTP\nlivrés à temps.', cta: 'Commander', path: '/(tabs)/btp', image: require('../../assets/images/btp1.jpg') },
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    setTimeout(() => setShowPopup(true), 3000);

    const interval = setInterval(() => {
      Animated.spring(socialAnim, { toValue: 50, friction: 6, tension: 40, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(socialAnim, { toValue: -150, duration: 600, useNativeDriver: true }).start(() => {
          setCurrentSocialIndex((prev) => (prev + 1) % SOCIAL_MESSAGES.length);
        });
      }, 5000);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showPopup) {
      modalScale.setValue(0);
      Animated.spring(modalScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(bumpY, { toValue: -2, duration: 100, useNativeDriver: true }),
        Animated.timing(bumpY, { toValue: 0, duration: 100, useNativeDriver: true })
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(driveX, { toValue: 0, duration: 800, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(driveX, { toValue: 400, duration: 600, useNativeDriver: true }),
        Animated.timing(driveX, { toValue: -400, duration: 0, useNativeDriver: true }),
      ])).start();
    }
  }, [showPopup]);

  const currentMsg = SOCIAL_MESSAGES[currentSocialIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* --- NOTIFICATION SOCIAL PROOF & CIVISME --- */}
      <Animated.View style={[styles.socialToast, { transform: [{ translateY: socialAnim }], backgroundColor: currentMsg.type === 'civisme' ? '#0f172a' : '#1A1A1A' }]}>
        <View style={styles.avatarWrapper}>
            {currentMsg.type === 'order' ? (
                <Image source={{ uri: currentMsg.avatar }} style={styles.socialAvatar} />
            ) : (
                <View style={styles.civismeIconBox}><FontAwesome5 name={currentMsg.icon} size={18} color="#fbbf24" /></View>
            )}
            {currentMsg.type === 'order' && <View style={styles.activeUserDot} />}
        </View>
        <View style={styles.socialTextWrapper}>
          <Text style={styles.socialName}>{currentMsg.user} <Text style={[styles.socialAction, currentMsg.type === 'civisme' && {color: '#fbbf24', fontWeight: 'bold'}]}>{currentMsg.action}</Text></Text>
          <Text style={[styles.socialDetail, currentMsg.type === 'civisme' && {color: 'white'}]}>{currentMsg.service} • {currentMsg.location}</Text>
        </View>
        <View style={styles.socialLiveBadge}>
            <Text style={styles.liveTextSmall}>{currentMsg.type === 'order' ? "À l'instant" : "INFO"}</Text>
        </View>
      </Animated.View>
      
      <LinearGradient colors={['#FF6B35', '#FF8E64']} style={styles.headerPremium}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View><Text style={styles.brandText}>MESSAY</Text><Text style={styles.tagline}>Smart Mobility & Logistics</Text></View>
            <TouchableOpacity style={styles.avatarCircle} onPress={() => router.push('/profile')}>
              <Text style={styles.avatarInitial}>{user?.prenom?.charAt(0) || 'K'}</Text>
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.searchWrapper}>
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.9} onPress={() => router.push('/(tabs)/tricycle')}>
          <View style={styles.searchLeft}><Ionicons name="search" size={22} color="#FF6B35" /><Text style={styles.searchText}>Destination ?</Text></View>
          <View style={styles.searchRight}><Text style={styles.searchTime}>Maintenant</Text></View>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        <View style={styles.heroContainer}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={(e) => setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / (width - 40)))} scrollEventThrottle={16}>
            {heroBanners.map((banner) => (
              <View key={banner.id} style={{ width: width - 40, height: '100%' }}>
                <ImageBackground source={banner.image} style={styles.heroImage} imageStyle={{ borderRadius: 30 }}>
                  <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']} style={styles.heroOverlay}>
                    <Text style={styles.heroGreeting}>{banner.greeting}</Text>
                    <Text style={styles.heroTitle}>{banner.title}</Text>
                    <TouchableOpacity style={styles.premiumCta} onPress={() => router.push(banner.path)}>
                      <Text style={styles.premiumCtaText}>{banner.cta}</Text>
                      <Ionicons name="chevron-forward-circle" size={18} color="#FF6B35" />
                    </TouchableOpacity>
                  </LinearGradient>
                </ImageBackground>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Nos Services</Text></View>
        <View style={styles.gridContainer}>
          {services.map((item, index) => (
            <ServiceCard key={item.id} item={item} index={index} fadeAnim={fadeAnim} onPress={() => router.push(item.path)} />
          ))}
        </View>
      </ScrollView>

      {/* POPUP TRICYCLE */}
      <Modal animationType="fade" transparent={true} visible={showPopup} onRequestClose={() => setShowPopup(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPopup(false)} />
          <Animated.View style={[styles.floatingModalContent, { transform: [{ scale: modalScale }] }]}>
            <View style={styles.miniHeader}>
              <View style={styles.miniBadge}><FontAwesome5 name="motorcycle" size={10} color="#FF6B35" /><Text style={styles.miniBadgeText}>TRICYCLE PRO</Text></View>
              <TouchableOpacity onPress={() => setShowPopup(false)}><Ionicons name="close-circle" size={24} color="#DDD" /></TouchableOpacity>
            </View>
            <View style={styles.imageContainerElite}>
              <Animated.View style={{ transform: [{ translateX: driveX }] }}>
                <Animated.Image source={require('../../assets/images/tricycle.png')} style={[styles.imageElite, { transform: [{ translateY: bumpY }] }]} resizeMode="contain" />
              </Animated.View>
            </View>
            <Text style={styles.modalTitleElite}>Prêt à partir ?</Text>
            <TouchableOpacity style={styles.btnActionElite} onPress={() => { setShowPopup(false); router.push('/(tabs)/tricycle'); }}>
              <Text style={styles.btnActionText}>Démarrer le trajet</Text>
              <Ionicons name="chevron-forward" size={18} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  socialToast: {
    position: 'absolute', top: 0, alignSelf: 'center', width: width - 40, borderRadius: 25, padding: 12, flexDirection: 'row', alignItems: 'center', zIndex: 999, elevation: 25, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20,
  },
  avatarWrapper: { position: 'relative' },
  socialAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 1, borderColor: '#FF6B35' },
  civismeIconBox: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: 'rgba(251, 191, 36, 0.1)', justifyContent: 'center', alignItems: 'center' },
  activeUserDot: { position: 'absolute', bottom: 2, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', borderWidth: 1, borderColor: '#1A1A1A' },
  socialTextWrapper: { flex: 1 },
  socialName: { fontSize: 13, fontWeight: '900', color: 'white' },
  socialAction: { fontWeight: '400', color: '#AAA' },
  socialDetail: { fontSize: 11, color: '#FF6B35', marginTop: 2, fontWeight: '700' },
  socialLiveBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveTextSmall: { fontSize: 8, fontWeight: '900', color: '#DDD' },

  headerPremium: { paddingTop: 10, paddingBottom: 45, paddingHorizontal: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandText: { color: 'white', fontSize: 24, fontWeight: '900' },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FF6B35', fontWeight: '900', fontSize: 16 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#4CAF50', borderRadius: 5, borderWidth: 2, borderColor: 'white' },
  searchWrapper: { paddingHorizontal: 20, marginTop: -25, zIndex: 10 },
  searchBar: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 18, elevation: 5 },
  searchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { fontSize: 14, color: '#666', fontWeight: '600' },
  searchRight: { backgroundColor: '#F4F5F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  searchTime: { fontSize: 11, color: '#333', fontWeight: '700' },
  scrollBody: { paddingBottom: 40 },
  heroContainer: { marginHorizontal: 20, marginTop: 20, height: 220, borderRadius: 30, overflow: 'hidden', elevation: 5 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { flex: 1, padding: 20, justifyContent: 'flex-end' },
  heroGreeting: { color: '#FFD700', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  premiumCta: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, gap: 8 },
  premiumCtaText: { color: '#1A1A1A', fontWeight: '800', fontSize: 12 },
  sectionHeader: { paddingHorizontal: 25, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A1A' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  serviceCardWrapper: { width: '50%', padding: 6 },
  cardTouch: { borderRadius: 25, overflow: 'hidden', backgroundColor: 'white', elevation: 4 },
  serviceImage: { width: '100%', height: 160, justifyContent: 'flex-end' },
  serviceIconFloating: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,107,53,0.95)', padding: 6, borderRadius: 10 },
  serviceGradient: { height: '60%', justifyContent: 'flex-end', padding: 12 },
  serviceTitlePremium: { color: 'white', fontWeight: '900', fontSize: 14 },
  serviceDescSmall: { color: 'rgba(255,255,255,0.8)', fontSize: 9 },
  badgeContainer: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 10 },
  badgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  floatingModalContent: { backgroundColor: 'white', width: '100%', borderRadius: 35, padding: 20, elevation: 20 },
  miniHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 6, backgroundColor: '#FFF5F2' },
  miniBadgeText: { color: '#FF6B35', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  imageContainerElite: { width: '100%', height: 140, backgroundColor: '#F8F9FA', borderRadius: 25, marginBottom: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageElite: { width: 120, height: 100 },
  modalTitleElite: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 15 },
  btnActionElite: { backgroundColor: '#1A1A1A', height: 55, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnActionText: { color: 'white', fontSize: 16, fontWeight: '800' }
});