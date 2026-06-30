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
  Image, // 🚩 NOUVEAU : Import de Image
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.7:5000';

interface Course {
  id: string;
  departAdresse: string;
  destinationAdresse: string;
  prix: number;
  statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  createdAt: string;
  user: { nom: string; prenom: string; telephone: string; };
}

interface WeeklyStats {
  totalRevenus: number;
  totalCourses: number;
}

export default function ConducteurCoursesScreen() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY' | 'PAYMENTS'>('ACTIVE');
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 🚩 NOUVEAU : État pour le bouton En ligne / Hors ligne
  const [isOnline, setIsOnline] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current; // 🚩 NOUVEAU : Animation du point vert

  // 📡 ANIMATION DU POINT CLIGNOTANT
  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1); // Arrête de clignoter si hors ligne
    }
  }, [isOnline]);

  useEffect(() => {
    let socket: Socket | null = null;
    if (!authLoading && isAuthenticated && isOnline) {
      socket = io(SOCKET_URL);
      socket.on('new-course-available', (newCourse: Course) => {
        setCourses(prev => [newCourse, ...prev.filter(c => c.id !== newCourse.id)]);
      });
    }
    return () => { if (socket) socket.disconnect(); };
  }, [authLoading, isAuthenticated, isOnline]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const timer = setTimeout(() => {
        fetchCourses();
        fetchStats();
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/mine/conducteur');
      setCourses(response.data);
    } catch (error) {
      console.error('Erreur API Courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/courses/weekly-stats');
      setStats(response.data);
    } catch (error: any) {
      console.error('Erreur API Stats:', error.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
    fetchStats();
  };

  const filteredData = useMemo(() => {
    if (activeTab === 'ACTIVE') return courses.filter(c => ['EN_ATTENTE', 'ACCEPTEE', 'EN_COURS'].includes(c.statut));
    if (activeTab === 'HISTORY') return courses.filter(c => ['TERMINEE', 'ANNULEE'].includes(c.statut));
    return [];
  }, [courses, activeTab]);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.patch(`/courses/${id}/${action}`);
      Alert.alert('Succès', `Statut mis à jour.`);
      fetchCourses();
      fetchStats();
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.error || 'Action impossible.');
    }
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnexion", style: "destructive", onPress: async () => { await logout(); } }
    ]);
  };

  // 🚩 PHOTO PAR DÉFAUT (Tu pourras utiliser user.photo plus tard)
  const defaultAvatar = "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=150&auto=format&fit=crop";

  const renderCourse = ({ item }: { item: Course }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.user ? `${item.user.prenom} ${item.user.nom}` : 'Client Inconnu'}</Text>
          <Text style={styles.priceText}>{item.prix} FCFA</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.statut) }]}>
          <Text style={styles.statusText}>{item.statut.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.locSection}>
        <View style={styles.locRow}>
          <Ionicons name="location" size={16} color="#10B981" />
          <Text style={styles.locText} numberOfLines={1}>{item.departAdresse}</Text>
        </View>
        <View style={styles.locRow}>
          <Ionicons name="flag" size={16} color="#FF6B35" />
          <Text style={styles.locText} numberOfLines={1}>{item.destinationAdresse}</Text>
        </View>
      </View>

      <View style={styles.actionContainer}>
        {item.statut === 'EN_ATTENTE' && (
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAction(item.id, 'accepter')}>
            <Text style={styles.btnText}>ACCEPTER</Text>
          </TouchableOpacity>
        )}
        {item.statut === 'ACCEPTEE' && (
          <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleAction(item.id, 'demarrer')}>
            <Text style={styles.btnText}>DÉMARRER</Text>
          </TouchableOpacity>
        )}
        {item.statut === 'EN_COURS' && (
          <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#10B981' }]} onPress={() => handleAction(item.id, 'terminer')}>
            <Text style={styles.btnText}>TERMINER</Text>
          </TouchableOpacity>
        )}
        {(item.statut === 'ACCEPTEE' || item.statut === 'EN_COURS') && item.user?.telephone && (
           <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert("Appel", `Appeler le ${item.user.telephone}`)}>
             <Ionicons name="call" size={20} color="#10B981" />
           </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderRevenus = () => (
    <View style={styles.revenuesContainer}>
      <View style={styles.revenueCard}>
        <View style={styles.revenueIconBox}>
          <Ionicons name="cash" size={35} color="#10B981" />
        </View>
        <Text style={styles.revenueTitle}>Chiffre d'affaires (Semaine)</Text>
        <Text style={styles.revenueAmount}>{stats?.totalRevenus || 0} FCFA</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#3B82F6" />
          <Text style={styles.statLabel}>Courses Terminées</Text>
          <Text style={styles.statValue}>{stats?.totalCourses || 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="star-outline" size={24} color="#F59E0B" />
          <Text style={styles.statLabel}>Note Moyenne</Text>
          <Text style={styles.statValue}>5.0</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loaderText}>Initialisation du tableau de bord...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            
            <View style={styles.profileSection}>
              {/* 🚩 NOUVEAU : La vraie image du conducteur */}
              <View style={styles.avatarWrapper}>
                <Image 
                  source={{ uri: (user as any)?.photo || defaultAvatar }} 
                  style={styles.avatarImage} 
                />
              </View>
              
              <View>
                <Text style={styles.headerName}>{user?.prenom} {user?.nom}</Text>
                
                {/* 🚩 NOUVEAU : Le Bouton En ligne / Hors Ligne interactif */}
                <TouchableOpacity 
                  style={[styles.onlineToggleBtn, !isOnline && styles.offlineToggleBtn]} 
                  onPress={() => setIsOnline(!isOnline)}
                >
                  <Animated.View style={[
                    styles.pulseDot, 
                    !isOnline && styles.pulseDotOffline,
                    { opacity: pulseAnim }
                  ]} />
                  <Text style={[styles.onlineText, !isOnline && styles.offlineText]}>
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                  </Text>
                </TouchableOpacity>

              </View>
            </View>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="power" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabBar}>
            <TabItem label="Radar" active={activeTab === 'ACTIVE'} onPress={() => setActiveTab('ACTIVE')} icon="flash" />
            <TabItem label="Histoire" active={activeTab === 'HISTORY'} onPress={() => setActiveTab('HISTORY')} icon="time" />
            <TabItem label="Revenus" active={activeTab === 'PAYMENTS'} onPress={() => setActiveTab('PAYMENTS')} icon="wallet" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {activeTab === 'PAYMENTS' ? (
        renderRevenus()
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filteredData}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name={activeTab === 'ACTIVE' ? "radar" : "clipboard-text-clock"} size={80} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>{activeTab === 'ACTIVE' ? "Radar en veille..." : "Historique vide"}</Text>
              <Text style={styles.emptySub}>
                {!isOnline 
                  ? "Vous êtes hors ligne. Passez en ligne pour recevoir des courses." 
                  : activeTab === 'ACTIVE' 
                    ? "Aucune commande dans ce secteur pour le moment." 
                    : "Vous n'avez pas encore terminé de courses."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'EN_ATTENTE': return '#64748b';
    case 'ACCEPTEE': return '#3B82F6';
    case 'EN_COURS': return '#F59E0B';
    case 'TERMINEE': return '#10B981';
    default: return '#EF4444';
  }
};

const TabItem = ({ label, active, onPress, icon }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabItem, active && styles.tabActive]}>
    <Ionicons name={active ? icon : `${icon}-outline`} size={18} color={active ? '#FF6B35' : '#94a3b8'} />
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10 },
  
  // Nouveaux styles Image & Toggle
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatarWrapper: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#FF6B35', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  
  onlineToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, marginTop: 4, alignSelf: 'flex-start' },
  offlineToggleBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  pulseDotOffline: { backgroundColor: '#EF4444' },
  onlineText: { fontSize: 11, color: '#10B981', fontWeight: '800' },
  offlineText: { color: '#EF4444' },

  headerName: { fontSize: 18, fontWeight: '800', color: 'white' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 15 },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10, marginTop: 25 },
  tabItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15 },
  tabActive: { backgroundColor: 'rgba(255, 107, 53, 0.1)' },
  tabLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: '700' },
  tabLabelActive: { color: '#FF6B35' },
  list: { padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 15, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  priceText: { fontSize: 15, fontWeight: '900', color: '#FF6B35', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: 'white', fontSize: 9, fontWeight: '800' },
  locSection: { marginBottom: 15, gap: 8, borderLeftWidth: 2, borderLeftColor: '#F1F5F9', marginLeft: 5, paddingLeft: 15 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  locText: { fontSize: 13, color: '#64748b', marginLeft: 10, flex: 1 },
  actionContainer: { flexDirection: 'row', gap: 10 },
  acceptBtn: { backgroundColor: '#FF6B35', padding: 15, borderRadius: 12, alignItems: 'center', flex: 1 },
  callBtn: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '900', fontSize: 12 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loaderText: { color: 'white', marginTop: 10, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#475569', marginTop: 15 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 10, marginTop: 5, lineHeight: 20 },
  revenuesContainer: { padding: 20 },
  revenueCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, alignItems: 'center', marginBottom: 20, elevation: 5, shadowColor: '#10B981', shadowOpacity: 0.2, shadowRadius: 15 },
  revenueIconBox: { backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 20, marginBottom: 15 },
  revenueTitle: { fontSize: 14, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
  revenueAmount: { fontSize: 36, fontWeight: '900', color: '#1e293b' },
  statsRow: { flexDirection: 'row', gap: 15 },
  statBox: { flex: 1, backgroundColor: 'white', padding: 20, borderRadius: 20, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 10, marginBottom: 5, textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' }
});