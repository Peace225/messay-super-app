import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Dimensions, ImageBackground, Image, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';

const { width } = Dimensions.get('window');

// Mapping images locales (Supabase ne peut pas stocker les require)
const COMPANY_ASSETS: any = {
  'UTB CI': {
    image: require('../../assets/images/bus_utb.jpg'),
    logo: require('../../assets/logos/utb.png'),
    short: 'UTB CI', routes: 42, cities: 9, rating: 4.9, status: 'Premium', priceFrom: '5000'
  },
  'Transports AVS': {
    image: require('../../assets/images/bus_avs.jpg'),
    logo: require('../../assets/logos/avs.png'),
    short: 'AVS', routes: 38, cities: 18, rating: 4.8, status: 'VIP', priceFrom: '5000'
  },
  'CTE Transport Express': {
    image: require('../../assets/images/bus_cte.jpg'),
    logo: require('../../assets/logos/cte.png'),
    short: 'CTE', routes: 35, cities: 12, rating: 4.7, status: 'Confort', priceFrom: '3000'
  },
  'MTK Transport': {
    image: require('../../assets/images/bus_mtk.jpg'),
    logo: require('../../assets/logos/mtk.png'),
    short: 'MTK', routes: 28, cities: 14, rating: 4.6, status: 'Express', priceFrom: '2000'
  },
  'MD Transport': {
    image: require('../../assets/images/bus_mdt.jpg'),
    logo: require('../../assets/logos/mdt.png'),
    short: 'MDT', routes: 31, cities: 16, rating: 4.5, status: 'Rapide', priceFrom: '3500'
  },
  'SBTA': {
    image: require('../../assets/images/bus_sbta.jpg'),
    logo: require('../../assets/logos/sbta.png'),
    short: 'SBTA', routes: 25, cities: 10, rating: 4.4, status: 'Fiable', priceFrom: '4000'
  },
  'STAF Transport': {
    image: require('../../assets/images/bus_staf.jpg'),
    logo: require('../../assets/logos/staf.png'),
    short: 'STAF', routes: 22, cities: 9, rating: 4.3, status: 'Eco', priceFrom: '2500'
  },
  'STL Transport': {
    image: require('../../assets/images/bus_stl.jpg'),
    logo: require('../../assets/logos/stl.png'),
    short: 'STL', routes: 19, cities: 8, rating: 4.7, status: 'VIP', priceFrom: '6000'
  },
  'TRANS': {
    image: require('../../assets/images/bus_trans.jpg'),
    logo: require('../../assets/images/bus_trans.jpg'),
    short: 'TRA', routes: 24, cities: 11, rating: 4.4, status: 'Ponctuel', priceFrom: '4500'
  },
  'SITTI Transport Terreste International': {
    image: require('../../assets/images/bus_sitti.jpg'),
    logo: require('../../assets/images/bus_sitti.jpg'),
    short: 'SITTI', routes: 18, cities: 7, rating: 4.6, status: 'Luxe', priceFrom: '5500'
  },
};

const FALLBACK_IMAGE = require('../../assets/images/bus.jpg');

export default function TicketsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const logoScrollRef = useRef<ScrollView>(null);
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);

  // Fetch depuis Supabase
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;

      // Merge Supabase + assets locaux
      const merged = (data || []).map((c: any) => ({
        ...c,
        ...(COMPANY_ASSETS[c.name] || {
          short: c.name.substring(0, 4).toUpperCase(),
          routes: 10, cities: 5, rating: 4.5, status: 'Standard', priceFrom: '5000',
          image: FALLBACK_IMAGE,
          logo: FALLBACK_IMAGE,
        })
      }));

      setCompanies(merged);
    } catch (e) {
      console.log('Erreur Supabase, utilisation fallback', e);
      // Fallback si Supabase vide
      setCompanies(Object.entries(COMPANY_ASSETS).map(([name, assets]: any) => ({
        id: name, name, color: '#FF6B35', gare_name: '', ...assets
      })));
    } finally {
      setLoading(false);
    }
  };

  const partners = companies.slice(0, 8);

  useEffect(() => {
    if (partners.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentLogoIndex + 1) % partners.length;
      logoScrollRef.current?.scrollTo({ x: nextIndex * 88, animated: true });
      setCurrentLogoIndex(nextIndex);
    }, 2500);
    return () => clearInterval(interval);
  }, [currentLogoIndex, partners.length]);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCompany = (company: any) => {
    router.push({
      pathname: `/company/${company.id}`,
      params: { name: company.name, color: company.color, id: company.id }
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 10, color: '#86868B' }}>Chargement des compagnies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#FF6B35', '#ED8936']} style={styles.headerGradient}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Compagnies</Text>
              <Text style={styles.headerSub}>{companies.length} partenaires officiels</Text>
            </View>
            <TouchableOpacity style={styles.filterBtn} onPress={fetchCompanies}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.partnersSection}>
          <View style={styles.partnersHeader}>
            <Text style={styles.partnersTitle}>Partenaires premium</Text>
            <View style={styles.dots}>
              {partners.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentLogoIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
          <ScrollView
            ref={logoScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.logosScroll}
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={88}
          >
            {partners.map((comp) => (
              <TouchableOpacity key={comp.id} onPress={() => openCompany(comp)} style={styles.logoCard}>
                <View style={styles.logoWrapper}>
                  <Image source={comp.logo} style={styles.logoImage} resizeMode="contain" defaultSource={FALLBACK_IMAGE} />
                </View>
                <Text style={styles.logoName} numberOfLines={1}>{comp.short}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search" size={18} color="#86868B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Rechercher une compagnie..."
            placeholderTextColor="#86868B"
          />
        </View>

        <View style={styles.grid}>
          {filteredCompanies.map((company) => (
            <TouchableOpacity key={company.id} onPress={() => openCompany(company)} activeOpacity={0.9} style={styles.card}>
              <ImageBackground source={company.image} style={styles.cardImage} imageStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.cardOverlay}>
                  <View style={[styles.badge, { backgroundColor: company.color }]}>
                    <Text style={styles.badgeTxt}>{company.short}</Text>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.price}>Dès {company.priceFrom}</Text>
                    <Text style={styles.currency}>FCFA</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
              <View style={styles.cardContent}>
                <Text style={styles.companyName} numberOfLines={1}>{company.name}</Text>
                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="map-outline" size={14} color="#86868B" />
                    <Text style={styles.metaTxt}>{company.cities} villes</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.metaTxt}>{company.rating}</Text>
                  </View>
                </View>
                <View style={styles.footer}>
                  <View style={[styles.routesPill, { backgroundColor: company.color + '15' }]}>
                    <MaterialCommunityIcons name="bus-multiple" size={14} color={company.color} />
                    <Text style={[styles.routesTxt, { color: company.color }]}>{company.routes}</Text>
                  </View>
                  <Text style={[styles.statusTxt, { color: company.color }]}>{company.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerGradient: { paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 },
  filterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  partnersSection: { backgroundColor: '#FFF', paddingTop: 20, paddingBottom: 16, marginTop: -10, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  partnersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  partnersTitle: { fontSize: 17, fontWeight: '800', color: '#1D1D1F' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 18, backgroundColor: '#FF6B35' },
  logosScroll: { paddingHorizontal: 20, gap: 16 },
  logoCard: { alignItems: 'center', width: 72 },
  logoWrapper: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0', padding: 8 },
  logoImage: { width: '100%', height: '100%' },
  logoName: { fontSize: 11, fontWeight: '600', color: '#4B5563', textAlign: 'center' },
  searchCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, marginBottom: 20, backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, height: 50, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1D1D1F' },
  grid: { paddingHorizontal: 20, paddingBottom: 100, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: (width - 52) / 2, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  cardImage: { height: 110 },
  cardOverlay: { flex: 1, justifyContent: 'space-between', padding: 12, flexDirection: 'row', alignItems: 'flex-start' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  priceTag: { backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: 'flex-end' },
  price: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  currency: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700' },
  cardContent: { padding: 12 },
  companyName: { fontSize: 15, fontWeight: '800', color: '#1D1D1F', marginBottom: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 11, color: '#86868B', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routesPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  routesTxt: { fontSize: 10, fontWeight: '700' },
  statusTxt: { fontSize: 11, fontWeight: '800' },
});