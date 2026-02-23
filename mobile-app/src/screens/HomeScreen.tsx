import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const tricycleAnim = useRef(new Animated.Value(-100)).current;

  // Animation du tricycle qui roule
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(tricycleAnim, {
          toValue: 400,
          duration: 3000,
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

  const services = [
    {
      id: 'tricycle',
      title: 'Tricycle',
      icon: '🛺',
      description: 'Déplacement rapide en ville',
      screen: 'Tricycle',
    },
    {
      id: 'transport',
      title: 'Transport',
      icon: '🚌',
      description: 'Voyages interurbains',
      screen: 'Transport',
    },
    {
      id: 'events',
      title: 'Événements',
      icon: '🎟️',
      description: 'Concerts, sports, spectacles',
      screen: 'Events',
    },
    {
      id: 'btp',
      title: 'Lacarrière',
      icon: '🚜',
      description: 'Matériaux de construction',
      screen: 'BTP',
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Bonjour';
    if (hour < 18) return '🌤️ Bon après-midi';
    return '🌙 Bonsoir';
  };

  return (
    <View style={styles.container}>
      {/* Header avec logo et profil */}
      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🚀</Text>
          <Text style={styles.appTitle}>MESSAY</Text>
        </View>
        {user ? (
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileButton}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.nom.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.onlineIndicator} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginIcon}>👤</Text>
            <Text style={styles.loginButtonText}>Connexion</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section de bienvenue avec animation */}
        <View style={styles.welcomeSection}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>
              {user ? `${user.prenom || user.nom}` : 'Invité'}
            </Text>
            {!user && (
              <Text style={styles.welcomeSubtext}>
                Découvrez nos services et connectez-vous pour profiter de toutes les fonctionnalités
              </Text>
            )}
            {user && (
              <Text style={styles.welcomeSubtext}>
                Ravi de vous revoir ! Que souhaitez-vous faire aujourd'hui ?
              </Text>
            )}
          </View>

          {/* Tricycle animé */}
          <View style={styles.animationContainer}>
            <Animated.Text
              style={[
                styles.animatedTricycle,
                {
                  transform: [{ translateX: tricycleAnim }],
                },
              ]}
            >
              🛺
            </Animated.Text>
            <View style={styles.road} />
          </View>
        </View>

        {/* Services */}
        <View style={styles.servicesContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nos Services</Text>
            <Text style={styles.sectionSubtitle}>Choisissez votre service</Text>
          </View>
          <View style={styles.servicesGrid}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => {
                  if (service.id === 'tricycle') router.push('/(tabs)/tricycle');
                  if (service.id === 'transport') router.push('/(tabs)/tickets');
                  if (service.id === 'events') router.push('/(tabs)/tickets');
                  if (service.id === 'btp') router.push('/(tabs)/btp');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.serviceIconContainer}>
                  <Text style={styles.serviceIcon}>{service.icon}</Text>
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Promotions */}
        <View style={styles.promoSection}>
          <Text style={styles.sectionTitle}>Promotions</Text>
          <View style={styles.promoCard}>
            <View style={styles.promoIconContainer}>
              <Text style={styles.promoIcon}>🎉</Text>
            </View>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Bienvenue sur MESSAY !</Text>
              <Text style={styles.promoText}>
                Profitez de -20% sur votre première course
              </Text>
            </View>
          </View>
        </View>
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
  },
  logoIcon: {
    fontSize: 28,
    marginRight: 8,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
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
  loginIcon: {
    fontSize: 18,
    marginRight: 6,
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
    paddingTop: 25,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  greetingContainer: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: '#888',
    lineHeight: 22,
    marginTop: 5,
  },
  animationContainer: {
    height: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  animatedTricycle: {
    fontSize: 40,
    position: 'absolute',
    top: 10,
  },
  road: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  servicesContainer: {
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  sectionHeader: {
    marginBottom: 20,
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
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  serviceIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIcon: {
    fontSize: 36,
  },
  serviceTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
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
  promoIcon: {
    fontSize: 28,
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
});
