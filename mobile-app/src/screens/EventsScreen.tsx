import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { FontAwesome5 } from '@expo/vector-icons';

const CATEGORIES = [
  { id: 'all', nom: 'Tous', icon: 'star', couleur: '#FF6B35' },
  { id: 'CONCERT', nom: 'Concerts', icon: 'music', couleur: '#E91E63' },
  { id: 'SPORT', nom: 'Sports', icon: 'futbol', couleur: '#4CAF50' },
  { id: 'THEATRE', nom: 'Théâtre', icon: 'theater-masks', couleur: '#9C27B0' },
  { id: 'FESTIVAL', nom: 'Festivals', icon: 'glass-cheers', couleur: '#FF9800' },
];

const EVENTS = [
  {
    id: '1',
    titre: 'Concert Zouglou Night',
    categorie: 'CONCERT',
    date: '2026-03-15T20:00:00',
    lieu: 'Palais de la Culture',
    adresse: 'Plateau, Abidjan',
    prix: 5000,
    placesDisponibles: 450,
    image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    description: 'Grande soirée zouglou avec les meilleurs artistes ivoiriens',
  },
  {
    id: '2',
    titre: 'Match ASEC vs Africa Sports',
    categorie: 'SPORT',
    date: '2026-03-20T16:00:00',
    lieu: 'Stade FHB',
    adresse: 'Plateau, Abidjan',
    prix: 2000,
    placesDisponibles: 8000,
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
    description: 'Derby abidjanais au stade Félix Houphouët-Boigny',
  },
  {
    id: '3',
    titre: 'Festival FEMUA',
    categorie: 'FESTIVAL',
    date: '2026-04-10T18:00:00',
    lieu: 'Place de la Paix',
    adresse: 'Anoumabo, Abidjan',
    prix: 3000,
    placesDisponibles: 2000,
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    description: 'Festival des Musiques Urbaines d\'Anoumabo',
  },
  {
    id: '4',
    titre: 'Pièce de théâtre: Le Mariage',
    categorie: 'THEATRE',
    date: '2026-03-25T19:00:00',
    lieu: 'Théâtre National',
    adresse: 'Treichville, Abidjan',
    prix: 4000,
    placesDisponibles: 300,
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
    description: 'Comédie hilarante sur les traditions du mariage',
  },
  {
    id: '5',
    titre: 'Concert Afrobeat Live',
    categorie: 'CONCERT',
    date: '2026-03-28T21:00:00',
    lieu: 'Ivoire Golf Club',
    adresse: 'Cocody, Abidjan',
    prix: 7500,
    placesDisponibles: 600,
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    description: 'Soirée afrobeat avec DJ internationaux',
  },
  {
    id: '6',
    titre: 'Marathon d\'Abidjan',
    categorie: 'SPORT',
    date: '2026-04-05T07:00:00',
    lieu: 'Boulevard VGE',
    adresse: 'Marcory, Abidjan',
    prix: 1500,
    placesDisponibles: 3000,
    image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800',
    description: 'Course de 10km et 21km à travers Abidjan',
  },
];

export default function EventsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedCategorie, setSelectedCategorie] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleReserver = async (event: any) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour réserver un billet',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    router.push({
      pathname: '/paiement',
      params: {
        montant: event.prix,
        type: `Événement - ${event.titre}`,
      },
    });
  };

  const eventsFiltered = EVENTS.filter((event) => {
    const matchCategorie = selectedCategorie === 'all' || event.categorie === selectedCategorie;
    const matchSearch = searchQuery === '' || 
      event.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.lieu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategorie && matchSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatHeure = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Événements</Text>
        <Text style={styles.subtitle}>Concerts, sports, spectacles</Text>
        
        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un événement..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesome5 name="times-circle" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Catégories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Catégories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((categorie) => (
            <TouchableOpacity
              key={categorie.id}
              style={[
                styles.categorieCard,
                selectedCategorie === categorie.id && styles.categorieCardActive,
              ]}
              onPress={() => setSelectedCategorie(categorie.id)}
            >
              <FontAwesome5 name={categorie.icon} size={24} color={categorie.couleur} />
              <Text style={styles.categorieNom}>{categorie.nom}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Événements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {eventsFiltered.length} événement{eventsFiltered.length > 1 ? 's' : ''} trouvé{eventsFiltered.length > 1 ? 's' : ''}
        </Text>
        {eventsFiltered.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="calendar-times" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>Aucun événement trouvé</Text>
            <Text style={styles.emptyStateSubtext}>
              Essayez de modifier vos critères de recherche
            </Text>
          </View>
        ) : (
          eventsFiltered.map((event) => {
            const categorie = CATEGORIES.find((c) => c.id === event.categorie);
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventImageContainer}>
                  <Image 
                    source={{ uri: event.image }} 
                    style={styles.eventImage}
                    resizeMode="cover"
                  />
                  <View style={[styles.categorieBadge, { backgroundColor: categorie?.couleur }]}>
                    <Text style={styles.categorieBadgeText}>{categorie?.nom}</Text>
                  </View>
                </View>

                <View style={styles.eventContent}>
                  <Text style={styles.eventTitre}>{event.titre}</Text>
                  <Text style={styles.eventDescription} numberOfLines={2}>
                    {event.description}
                  </Text>

                  <View style={styles.eventInfo}>
                    <View style={styles.eventInfoRow}>
                      <FontAwesome5 name="calendar" size={14} color="#666" />
                      <Text style={styles.eventInfoText}>
                        {formatDate(event.date)} à {formatHeure(event.date)}
                      </Text>
                    </View>
                    <View style={styles.eventInfoRow}>
                      <FontAwesome5 name="map-marker-alt" size={14} color="#666" />
                      <Text style={styles.eventInfoText}>{event.lieu}</Text>
                    </View>
                    <View style={styles.eventInfoRow}>
                      <FontAwesome5 name="users" size={14} color="#666" />
                      <Text style={styles.eventInfoText}>
                        {event.placesDisponibles} places disponibles
                      </Text>
                    </View>
                  </View>

                  <View style={styles.eventFooter}>
                    <Text style={styles.eventPrix}>{event.prix.toLocaleString()} FCFA</Text>
                    <TouchableOpacity
                      style={styles.reserverButton}
                      onPress={() => handleReserver(event)}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <FontAwesome5 name="ticket-alt" size={14} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.reserverButtonText}>Réserver</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginTop: 15,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
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
  categorieCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginLeft: 20,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorieCardActive: {
    borderColor: '#FF6B35',
  },
  categorieNom: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  eventImageContainer: {
    backgroundColor: '#f0f0f0',
    height: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  categorieBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categorieBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventContent: {
    padding: 15,
  },
  eventTitre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  eventInfo: {
    marginBottom: 15,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventInfoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  eventPrix: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  reserverButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reserverButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
});
