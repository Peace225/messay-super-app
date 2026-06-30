import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.7:5000';

interface Livraison {
  id: string;
  departAdresse: string; 
  destinationAdresse: string; 
  prix: number;
  statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  user: { nom: string; prenom: string; telephone: string; };
}

interface WeeklyStats {
  totalRevenus: number;
  totalCourses: number;
}

export default function ChauffeurLivraisonsScreen() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'HISTORY' | 'PAYMENTS'>('MISSIONS');
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;
  const onlinePulse = useRef(new Animated.Value(1)).current; // 🚩 Nouveau : Pulse pour le point vert

  // 📡 1. RADAR SOCKET.IO
  useEffect(() => {
    let socket: Socket | null = null;
    if (!authLoading && isAuthenticated && isOnline) {
      socket = io(SOCKET_URL);
      socket.on('new-course-available', (newLivraison: Livraison) => {
        setLivraisons(prev => [newLivraison, ...prev.filter(l => l.id !== newLivraison.id)]);
      });
    }
    return () => { if (socket) socket.disconnect(); };
  }, [authLoading, isAuthenticated, isOnline]);

  // 🌀 2. ANIMATIONS (Radar & Online Dot)
  useEffect(() => {
    if (isOnline) {
      // Animation du radar
      if (activeTab === 'MISSIONS' && livraisons.length === 0) {
        radarAnim.setValue(0);
        Animated.loop(Animated.timing(radarAnim, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
      }
      // Animation du point "En ligne"
      Animated.loop(
        Animated.sequence([
          Animated.timing(onlinePulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(onlinePulse, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      radarAnim.stopAnimation();
      onlinePulse.setValue(1);
    }
  }, [isOnline, activeTab, livraisons]);

  // 🛡️ 3. CHARGEMENT DONNÉES
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [authLoading, isAuthenticated]);

  const fetchData = async () => {
    try {
      const [resLivraisons, resStats] = await Promise.all([
        api.get('/courses/mine/chauffeur'),
        api.get('/courses/weekly-stats')
      ]);
      setLivraisons(resLivraisons.data);
      setStats(resStats.data);
    } catch (error) {
      console.error('Erreur chargement Dashboard Ibrahim');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredData = useMemo(() => {
    if (activeTab === 'MISSIONS') return livraisons.filter(l => ['EN_ATTENTE', 'ACCEPTEE', 'EN_COURS'].includes(l.statut));
    if (activeTab === 'HISTORY') return livraisons.filter(l => ['TERMINEE', 'ANNULEE'].includes(l.statut));
    return [];
  }, [livraisons, activeTab]);

  const typePermis = (user as any)?.permis || 'C';
  const exp = (user as any)?.experience || '8 ans';
  const totalBons = stats?.totalCourses || 0;
  const defaultAvatar = "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=150";

  const renderLivraison = ({ item }: { item: Livraison }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.priceValue}>{item.prix.toLocaleString()} FCFA</Text>
        <View style={styles.badgeBTP}><Text style={styles.badgeText}>BON BTP</Text></View>
      </View>
      <View style={styles.locBox}>
        <View style={styles.locRow}><FontAwesome5 name="industry" size={12} color="#64748B" /><Text style={styles.locText}>{item.departAdresse}</Text></View>
        <View style={styles.locRow}><FontAwesome5 name="hard-hat" size={12} color="#F59E0B" /><Text style={styles.locText}>{item.destinationAdresse}</Text></View>
      </View>
      <TouchableOpacity style={styles.btnAccept} onPress={() => Alert.alert("Action", "Accepter ce bon ?")}><Text style={styles.btnText}>ACCEPTER LE BON</Text></TouchableOpacity>
    </View>
  );

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#F59E0B" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <View style={styles.profileBox}>
              {/* 🚩 ZONE PHOTO ARRANGÉE */}
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: (user as any)?.photo || defaultAvatar }} 
                  style={styles.avatar} 
                />
                {isOnline && (
                  <Animated.View style={[styles.onlineDot, { opacity: onlinePulse }]} />
                )}
              </View>
              
              <View>
                <Text style={styles.name}>{user?.prenom} {user?.nom}</Text>
                <View style={styles.roleBadge}>
                   <Text style={styles.role}>CHAUFFEUR POIDS LOURD</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              onPress={() => setIsOnline(!isOnline)} 
              style={[styles.statusBtn, !isOnline && styles.statusBtnOff]}
            >
              <Ionicons name={isOnline ? "radio" : "power"} size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statItem}><Text style={styles.statLabel}>PERMIS</Text><Text style={styles.statValue}>{typePermis}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statLabel}>EXP.</Text><Text style={styles.statValue}>{exp}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statLabel}>BONS</Text><Text style={styles.statValue}>{totalBons}</Text></View>
          </View>

          <View style={styles.tabBar}>
            <TabItem label="Radar" active={activeTab === 'MISSIONS'} icon="flash" onPress={() => setActiveTab('MISSIONS')} />
            <TabItem label="Histoire" active={activeTab === 'HISTORY'} icon="time" onPress={() => setActiveTab('HISTORY')} />
            <TabItem label="Revenus" active={activeTab === 'PAYMENTS'} icon="wallet" onPress={() => setActiveTab('PAYMENTS')} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {activeTab === 'PAYMENTS' ? (
        <View style={styles.revenuesContainer}>
           <View style={styles.revenueCard}>
             <FontAwesome5 name="wallet" size={30} color="#F59E0B" />
             <Text style={styles.revenueLabel}>Gains de la semaine</Text>
             <Text style={styles.revenueValue}>{stats?.totalRevenus.toLocaleString() || 0} FCFA</Text>
           </View>
        </View>
      ) : (
        isOnline && activeTab === 'MISSIONS' && livraisons.length === 0 ? (
          <View style={styles.radarContainer}>
            <Animated.View style={[styles.radarCircle, { transform: [{ scale: radarAnim }], opacity: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
            <MaterialCommunityIcons name="truck-delivery" size={80} color="#cbd5e1" />
            <Text style={styles.radarTitle}>Recherche de chantiers...</Text>
          </View>
        ) : (
          <FlatList data={filteredData} renderItem={renderLivraison} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} />} />
        )
      )}
    </View>
  );
}

const TabItem = ({ label, active, icon, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabItem, active && styles.tabActive]}>
    <Ionicons name={active ? icon : `${icon}-outline`} size={18} color={active ? "#F59E0B" : "#94a3b8"} />
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  profileBox: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  
  // 🚩 STYLES PHOTO ARRANGÉS
  avatarContainer: { position: 'relative' },
  avatar: { 
    width: 55, 
    height: 55, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: '#F59E0B',
    backgroundColor: '#1e293b'
  },
  onlineDot: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#10B981', 
    borderWidth: 2, 
    borderColor: '#1e293b' 
  },

  name: { color: 'white', fontWeight: '900', fontSize: 18 },
  roleBadge: { backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginTop: 2 },
  role: { color: '#F59E0B', fontSize: 9, fontWeight: '800' },
  
  statusBtn: { backgroundColor: '#10B981', padding: 10, borderRadius: 12, elevation: 5 },
  statusBtnOff: { backgroundColor: '#EF4444' },
  
  statsBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20, marginTop: 15, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#94a3b8', fontSize: 8, fontWeight: '800' },
  statValue: { color: 'white', fontSize: 14, fontWeight: '900' },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 },
  tabItem: { alignItems: 'center', padding: 8, borderRadius: 10, width: '30%' },
  tabActive: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  tabLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: '#F59E0B' },
  
  list: { padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  priceValue: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  badgeBTP: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#FEF3C7' },
  badgeText: { color: '#F59E0B', fontSize: 9, fontWeight: '900' },
  locBox: { gap: 8, marginBottom: 15 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  btnAccept: { backgroundColor: '#F59E0B', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '900', fontSize: 12 },
  
  radarContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 50 },
  radarCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#F59E0B' },
  radarTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginTop: 15 },
  
  revenuesContainer: { padding: 20 },
  revenueCard: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 4 },
  revenueLabel: { color: '#64748B', marginTop: 10, fontWeight: '600' },
  revenueValue: { fontSize: 28, fontWeight: '900', color: '#1e293b', marginTop: 5 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }
});