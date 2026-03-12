import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', nom: 'Tous', icon: 'apps', couleur: '#6366f1' },
  { id: 'CONCERT', nom: 'Concerts', icon: 'musical-notes', couleur: '#ec4899' },
  { id: 'SPORT', nom: 'Sports', icon: 'trophy', couleur: '#22c55e' },
  { id: 'THEATRE', nom: 'Théâtre', icon: 'mask', couleur: '#a855f7' },
  { id: 'FESTIVAL', nom: 'Festivals', icon: 'sparkles', couleur: '#f59e0b' },
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
    description: "Festival des Musiques Urbaines d'Anoumabo",
  },
];

export default function EventsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedCategorie, setSelectedCategorie] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // --- LOGIQUE DE FILTRAGE RÉPARÉE ---
  const eventsFiltered = EVENTS.filter((event) => {
    const matchCategorie = selectedCategorie === 'all' || event.categorie === selectedCategorie;
    const matchSearch = searchQuery === '' || 
      event.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.lieu.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategorie && matchSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleReserver = (event: any) => {
    if (!isAuthenticated) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour réserver.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => router.push('/login') },
      ]);
      return;
    }
    router.push({
      pathname: '/paiement',
      params: { montant: event.prix, type: `Événement - ${event.titre}` },
    });
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER PREMIUM */}
      <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.headerPremium}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Découvrir</Text>
            <Text style={styles.titlePremium}>Événements</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInputPremium}
            placeholder="Artiste, lieu ou mot-clé..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="rgba(255,255,255,0.5)"
          />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
        
        {/* CATEGORIES PILLS */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategorie(cat.id)}
                style={[
                  styles.catPill,
                  selectedCategorie === cat.id && { backgroundColor: cat.couleur }
                ]}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={18} 
                  color={selectedCategorie === cat.id ? '#fff' : cat.couleur} 
                />
                <Text style={[styles.catPillText, selectedCategorie === cat.id && styles.catPillTextActive]}>
                  {cat.nom}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* EVENTS LIST */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.resultsText}>
            {eventsFiltered.length} événements à venir
          </Text>

          {eventsFiltered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>Aucun événement trouvé</Text>
            </View>
          ) : (
            eventsFiltered.map((event) => {
              const cat = CATEGORIES.find(c => c.id === event.categorie);
              return (
                <View key={event.id} style={styles.premiumCard}>
                  <View style={styles.cardImageWrapper}>
                    <Image source={{ uri: event.image }} style={styles.cardImg} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />
                    <View style={[styles.cardBadge, { backgroundColor: cat?.couleur }]}>
                      <Text style={styles.cardBadgeText}>{cat?.nom}</Text>
                    </View>
                    <View style={styles.priceTag}>
                      <Text style={styles.priceTagText}>{event.prix.toLocaleString()} F</Text>
                    </View>
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{event.titre}</Text>
                    
                    <View style={styles.cardMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-clear-outline" size={14} color="#6366f1" />
                        <Text style={styles.metaText}>{formatDate(event.date)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={14} color="#6366f1" />
                        <Text style={styles.metaText} numberOfLines={1}>{event.lieu}</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.buyBtn}
                      onPress={() => handleReserver(event)}
                    >
                      <Text style={styles.buyBtnText}>Réserver ma place</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  headerPremium: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '500' },
  titlePremium: { color: '#fff', fontSize: 28, fontWeight: '900' },
  profileBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 10,
    borderRadius: 15,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInputPremium: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16 },
  scrollBody: { flex: 1 },
  section: { marginTop: 20 },
  catScroll: { paddingLeft: 20, paddingRight: 10 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  catPillText: { marginLeft: 8, fontWeight: '600', color: '#64748b' },
  catPillTextActive: { color: '#fff' },
  resultsText: { marginLeft: 20, color: '#94a3b8', fontWeight: '600', marginBottom: 15 },
  premiumCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  cardImageWrapper: { height: 180, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  cardBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cardBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  priceTag: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceTagText: { color: '#1e1b4b', fontWeight: '900', fontSize: 16 },
  cardInfo: { padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', marginBottom: 15 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  metaText: { marginLeft: 5, color: '#64748b', fontSize: 13 },
  buyBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
  },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginRight: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 16 }
});