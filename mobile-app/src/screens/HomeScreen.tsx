import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

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

  return (
    <View style={styles.container}>
      {/* Header avec profil en haut à droite */}
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>MESSAY</Text>
        {user ? (
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.nom.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Connexion</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.userName}>
            {user ? `${user.prenom || user.nom}` : 'Invité'}
          </Text>
        </View>

      <View style={styles.servicesContainer}>
        <Text style={styles.sectionTitle}>Nos Services</Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => {
                if (service.id === 'tricycle') router.push('/(tabs)/tricycle');
                // Autres services à implémenter
              }}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.promoSection}>
        <Text style={styles.sectionTitle}>Promotions</Text>
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>🎉 Bienvenue sur MESSAY !</Text>
          <Text style={styles.promoText}>
            Profitez de -20% sur votre première course
          </Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  servicesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  promoSection: {
    padding: 20,
  },
  promoCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  promoText: {
    fontSize: 14,
    color: '#666',
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
