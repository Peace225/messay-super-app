import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // Animations
  const tricycleAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation du tricycle qui roule avec rebond
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(tricycleAnim, {
          toValue: width + 50,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(tricycleAnim, {
          toValue: -100,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animation de scintillement
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Animation de pulsation pour le logo
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const services = [
    {
      id: 'tricycle',
      title: 'Tricycle',
      icon: 'motorcycle',
      description: 'Déplacement rapide en ville',
      screen: 'Tricycle',
    },
    {
      id: 'transport',
      title: 'Transport',
      icon: 'bus',
      description: 'Voyages interurbains',
      screen: 'Transport',
    },
    {
      id: 'events',
      title: 'Événements',
      icon: 'ticket-alt',
      description: 'Concerts, sports, spectacles',
      screen: 'Events',
    },
    {
      id: 'btp',
      title: 'Lacarrière',
      icon: 'truck',
      description: 'Matériaux de construction',
      screen: 'BTP',
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bonjour', icon: 'sun' };
    if (hour < 18) return { text: 'Bon après-midi', icon: 'cloud-sun' };
    return { text: 'Bonsoir', icon: 'moon' };
  };

  const getWelcomeMessage = () => {
    const greeting = getGreeting();
    if (user) {
      return {
        greeting: greeting.text,
        greetingIcon: greeting.icon,
        name: `${user.prenom || user.nom}`,
        headline: 'Votre transport, en un clic',
        subheadline: 'Déplacez-vous rapidement et en toute sécurité',
      };
    }
    return {
      greeting: greeting.text,
      greetingIcon: greeting.icon,
      name: '',
      headline: 'Votre transport, en un clic',
      subheadline: 'Déplacez-vous rapidement et en toute sécurité',
    };
  };

  const welcome = getWelcomeMessage();

  const sellingPoints = [
    { id: '1', icon: 'bolt', text: 'Rapide', color: '#FFB800' },
    { id: '2', icon: 'shield-alt', text: 'Sécurisé', color: '#4CAF50' },
    { id: '3', icon: 'clock', text: 'Disponible 24/7', color: '#2196F3' },
  ];

  return (
    <View style={styles.container}>
      {/* Header avec logo et profil */}
      <Animated.View 
        style={[
          styles.topBar,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.View 
          style={[
            styles.logoContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <FontAwesome5 name="rocket" size={28} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.appTitle}>MESSAY</Text>
          <Animated.View
            style={[
              styles.sparkle,
              {
                opacity: sparkleAnim,
              },
            ]}
          >
            <FontAwesome5 name="star" size={16} color="#FFD700" />
          </Animated.View>
        </Animated.View>
        {user ? (
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileButton}
          >
            <Animated.View 
              style={[
                styles.avatar,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Text style={styles.avatarText}>
                {user.nom.charAt(0).toUpperCase()}
              </Text>
            </Animated.View>
            <View style={styles.onlineIndicator} />
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => router.push('/login')}
            >
              <Ionicons name="person" size={18} color="#FF6B35" style={{ marginRight: 6 }} />
              <Text style={styles.loginButtonText}>Connexion</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section de bienvenue avec animation */}
        <Animated.View 
          style={[
            styles.welcomeSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.greetingContainer}>
            {user && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <FontAwesome5 name={welcome.greetingIcon} size={16} color="#FF6B35" style={{ marginRight: 6 }} />
                <Text style={styles.greeting}>{welcome.greeting}, {welcome.name}</Text>
              </View>
            )}
            <Animated.Text 
              style={[
                styles.heroHeadline,
                {
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              {welcome.headline}
            </Animated.Text>
            <Text style={styles.heroSubheadline}>
              {welcome.subheadline}
            </Text>

            {/* CTA Button */}
            <Animated.View
              style={[
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <TouchableOpacity 
                style={styles.ctaButton}
                onPress={() => router.push('/(tabs)/tricycle')}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="motorcycle" size={20} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.ctaButtonText}>Réserver maintenant</Text>
                <FontAwesome5 name="arrow-right" size={16} color="#fff" style={{ marginLeft: 10 }} />
              </TouchableOpacity>
            </Animated.View>

            {/* Selling Points */}
            <View style={styles.sellingPointsContainer}>
              {sellingPoints.map((point, index) => (
                <Animated.View
                  key={point.id}
                  style={[
                    styles.sellingPoint,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateY: slideAnim.interpolate({
                            inputRange: [0, 50],
                            outputRange: [0, 20 + index * 5],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.sellingPointIcon, { backgroundColor: point.color + '20' }]}>
                    <FontAwesome5 name={point.icon} size={16} color={point.color} />
                  </View>
                  <Text style={styles.sellingPointText}>{point.text}</Text>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Tricycle animé avec effets */}
          <View style={styles.animationContainer}>
            <Animated.View
              style={[
                styles.tricycleContainer,
                {
                  transform: [{ translateX: tricycleAnim }],
                },
              ]}
            >
              <FontAwesome5 name="motorcycle" size={40} color="#FF6B35" />
            </Animated.View>
            
            {/* Route animée avec pointillés */}
            <View style={styles.roadContainer}>
              <View style={styles.road} />
              <View style={styles.roadDashes}>
                {[...Array(10)].map((_, i) => (
                  <View key={i} style={styles.dash} />
                ))}
              </View>
            </View>
            
            {/* Nuages décoratifs */}
            <Animated.View
              style={[
                styles.cloud,
                styles.cloud1,
                {
                  opacity: sparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.7],
                  }),
                },
              ]}
            >
              <Ionicons name="cloud" size={24} color="#E0E0E0" />
            </Animated.View>
            <Animated.View
              style={[
                styles.cloud,
                styles.cloud2,
                {
                  opacity: sparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 0.9],
                  }),
                },
              ]}
            >
              <Ionicons name="cloud" size={24} color="#E0E0E0" />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Services avec animation d'entrée */}
        <View style={styles.servicesContainer}>
          <Animated.View 
            style={[
              styles.sectionHeader,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Nos Services</Text>
            <Text style={styles.sectionSubtitle}>Choisissez votre service</Text>
          </Animated.View>
          <FlatList
            data={services}
            numColumns={2}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            columnWrapperStyle={styles.servicesRow}
            renderItem={({ item, index }) => (
              <Animated.View
                style={[
                  styles.serviceCardWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 50],
                          outputRange: [0, 50 + index * 10],
                        }),
                      },
                      { scale: scaleAnim },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.serviceCard}
                  onPress={() => {
                    if (item.id === 'tricycle') router.push('/(tabs)/tricycle');
                    if (item.id === 'transport') router.push('/(tabs)/tickets');
                    if (item.id === 'events') router.push('/(tabs)/tickets');
                    if (item.id === 'btp') router.push('/(tabs)/btp');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.serviceIconContainer}>
                    <FontAwesome5 name={item.icon} size={32} color="#FF6B35" />
                  </View>
                  <Text style={styles.serviceTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.serviceDescription} numberOfLines={2}>{item.description}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        </View>

        {/* Promotions avec animation */}
        <Animated.View 
          style={[
            styles.promoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Promotions</Text>
          <TouchableOpacity style={styles.promoCard} activeOpacity={0.8}>
            <View style={styles.promoIconContainer}>
              <Animated.View
                style={[
                  {
                    transform: [
                      {
                        rotate: sparkleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                      { scale: pulseAnim },
                    ],
                  },
                ]}
              >
                <FontAwesome5 name="gift" size={28} color="#FFB800" />
              </Animated.View>
            </View>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Bienvenue sur MESSAY !</Text>
              <Text style={styles.promoText}>
                Profitez de -20% sur votre première course
              </Text>
            </View>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>-20%</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    backgroundColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  sparkle: {
    position: 'absolute',
    top: -10,
    right: -15,
  },
  profileButton: {
    position: 'relative',
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFE5DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  avatarText: {
    color: '#FF6B35',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  loginButtonText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  welcomeSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  greetingContainer: {
    marginBottom: 15,
  },
  greeting: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 34,
  },
  heroSubheadline: {
    fontSize: 15,
    color: '#888',
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 20,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  sellingPointsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sellingPoint: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  sellingPointIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  sellingPointText: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  animationContainer: {
    height: 70,
    position: 'relative',
    overflow: 'hidden',
    marginTop: 5,
  },
  tricycleContainer: {
    position: 'absolute',
    top: 10,
    zIndex: 2,
  },
  roadContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 4,
  },
  road: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  roadDashes: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dash: {
    width: 20,
    height: 2,
    backgroundColor: '#bbb',
    borderRadius: 1,
  },
  cloud: {
    position: 'absolute',
    fontSize: 24,
  },
  cloud1: {
    top: 5,
    left: 30,
  },
  cloud2: {
    top: 15,
    right: 50,
  },
  servicesContainer: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 10,
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  servicesRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  serviceCardWrapper: {
    width: (width - 52) / 2,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    height: 160,
    justifyContent: 'center',
  },
  serviceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 16,
  },
  promoSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  promoCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#FFB800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  promoIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  promoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  promoBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    transform: [{ rotate: '15deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  promoBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
