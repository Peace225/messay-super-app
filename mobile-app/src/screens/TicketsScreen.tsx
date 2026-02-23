import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const COMPAGNIES = [
  { id: 'utb', nom: 'UTB', logo: '🚌', couleur: '#FF6B35' },
  { id: 'sta', nom: 'STA', logo: '🚍', couleur: '#4CAF50' },
  { id: 'rvs', nom: 'RVS', logo: '🚐', couleur: '#2196F3' },
];

const TRAJETS = [
  {
    id: '1',
    compagnie: 'utb',
    depart: 'Abidjan',
    destination: 'Yamoussoukro',
    heureDepart: '08:00',
    heureArrivee: '11:30',
    prix: 5000,
    siegesDisponibles: 12,
  },
  {
    id: '2',
    compagnie: 'sta',
    depart: 'Abidjan',
    destination: 'Bouaké',
    heureDepart: '09:00',
    heureArrivee: '13:00',
    prix: 7000,
    siegesDisponibles: 8,
  },
  {
    id: '3',
    compagnie: 'rvs',
    depart: 'Abidjan',
    destination: 'San Pedro',
    heureDepart: '10:00',
    heureArrivee: '15:00',
    prix: 8500,
    siegesDisponibles: 15,
  },
  {
    id: '4',
    compagnie: 'utb',
    depart: 'Abidjan',
    destination: 'Korhogo',
    heureDepart: '07:00',
    heureArrivee: '15:30',
    prix: 12000,
    siegesDisponibles: 5,
  },
];

export default function TicketsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedCompagnie, setSelectedCompagnie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReserver = async (trajet: any) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour réserver un ticket',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      await api.post('/tickets', {
        compagnie: trajet.compagnie.toUpperCase(),
        depart: trajet.depart,
        destination: trajet.destination,
        dateDepart: new Date().toISOString(),
        heureDepart: trajet.heureDepart,
        siege: 'A' + Math.floor(Math.random() * 30 + 1), // Siège aléatoire
        prix: trajet.prix,
      });

      Alert.alert('Succès', 'Votre ticket a été réservé avec succès !', [
        {
          text: 'Voir mes tickets',
          onPress: () => router.push('/tickets-historique' as any),
        },
        { text: 'OK' },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la réservation');
    } finally {
      setLoading(false);
    }
  };

  const trajetsFiltered = selectedCompagnie
    ? TRAJETS.filter((t) => t.compagnie === selectedCompagnie)
    : TRAJETS;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transport Interurbain</Text>
        <Text style={styles.subtitle}>Réservez votre voyage</Text>
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.historiqueButton}
            onPress={() => router.push('/tickets-historique' as any)}
          >
            <Text style={styles.historiqueButtonText}>📋 Mes tickets</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Compagnies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compagnies</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.compagnieCard,
              !selectedCompagnie && styles.compagnieCardActive,
            ]}
            onPress={() => setSelectedCompagnie(null)}
          >
            <Text style={styles.compagnieLogo}>🚌</Text>
            <Text style={styles.compagnieNom}>Toutes</Text>
          </TouchableOpacity>
          {COMPAGNIES.map((compagnie) => (
            <TouchableOpacity
              key={compagnie.id}
              style={[
                styles.compagnieCard,
                selectedCompagnie === compagnie.id && styles.compagnieCardActive,
              ]}
              onPress={() => setSelectedCompagnie(compagnie.id)}
            >
              <Text style={styles.compagnieLogo}>{compagnie.logo}</Text>
              <Text style={styles.compagnieNom}>{compagnie.nom}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trajets */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trajets disponibles</Text>
        {trajetsFiltered.map((trajet) => {
          const compagnie = COMPAGNIES.find((c) => c.id === trajet.compagnie);
          return (
            <View key={trajet.id} style={styles.trajetCard}>
              <View style={styles.trajetHeader}>
                <Text style={styles.trajetLogo}>{compagnie?.logo}</Text>
                <Text style={styles.trajetCompagnie}>{compagnie?.nom}</Text>
                <View style={styles.siegesBadge}>
                  <Text style={styles.siegesText}>
                    {trajet.siegesDisponibles} places
                  </Text>
                </View>
              </View>

              <View style={styles.trajetRoute}>
                <View style={styles.trajetPoint}>
                  <Text style={styles.trajetVille}>{trajet.depart}</Text>
                  <Text style={styles.trajetHeure}>{trajet.heureDepart}</Text>
                </View>
                <Text style={styles.trajetArrow}>→</Text>
                <View style={styles.trajetPoint}>
                  <Text style={styles.trajetVille}>{trajet.destination}</Text>
                  <Text style={styles.trajetHeure}>{trajet.heureArrivee}</Text>
                </View>
              </View>

              <View style={styles.trajetFooter}>
                <Text style={styles.trajetPrix}>{trajet.prix} FCFA</Text>
                <TouchableOpacity
                  style={styles.reserverButton}
                  onPress={() => handleReserver(trajet)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.reserverButtonText}>Réserver</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  historiqueButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
    alignSelf: 'center',
  },
  historiqueButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  compagnieCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginLeft: 20,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  compagnieCardActive: {
    borderColor: '#FF6B35',
  },
  compagnieLogo: {
    fontSize: 32,
    marginBottom: 5,
  },
  compagnieNom: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  trajetCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trajetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  trajetLogo: {
    fontSize: 24,
    marginRight: 10,
  },
  trajetCompagnie: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  siegesBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  siegesText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  trajetRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  trajetPoint: {
    flex: 1,
  },
  trajetVille: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  trajetHeure: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  trajetArrow: {
    fontSize: 24,
    color: '#FF6B35',
    marginHorizontal: 10,
  },
  trajetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trajetPrix: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  reserverButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 20,
  },
  reserverButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
