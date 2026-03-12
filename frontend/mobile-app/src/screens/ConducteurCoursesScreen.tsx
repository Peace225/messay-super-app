import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  StatusBar,
  Animated,
} from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import * as Location from 'expo-location';
import { isPointInRestrictedZone } from '../config/restrictedZones';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Course {
  id: string;
  departAdresse: string;
  destinationAdresse: string;
  distance: number;
  prix: number;
  statut: string;
  createdAt: string;
  user: {
    nom: string;
    prenom: string;
    telephone: string;
  };
}

export default function ConducteurCoursesScreen() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRestrictedZoneAlert, setShowRestrictedZoneAlert] = useState(false);
  const [currentRestrictedZone, setCurrentRestrictedZone] = useState<string>('');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animation d'apparition au chargement
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Surveillance GPS
  useEffect(() => {
    let locationSubscription: any;

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 50,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            const restrictionCheck = isPointInRestrictedZone(latitude, longitude);
            
            if (restrictionCheck.isRestricted && restrictionCheck.zone) {
              setCurrentRestrictedZone(
                `Vous êtes actuellement sur:\n${restrictionCheck.zone.nom}\n\n${restrictionCheck.zone.description}\n\nCette voie est INTERDITE aux tricycles. Veuillez emprunter un itinéraire alternatif immédiatement.`
              );
              setShowRestrictedZoneAlert(true);
            }
          }
        );
      }
    };

    startLocationTracking();
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/conducteur/mes-courses');
      setCourses(response.data);
    } catch (error) {
      console.error('Erreur chargement courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const handleCourseAction = async (courseId: string, action: 'accepter' | 'demarrer' | 'terminer') => {
    try {
      await api.patch(`/courses/${courseId}/${action}`);
      Alert.alert('Succès ✨', `Course ${action}e avec succès !`);
      fetchCourses();
    } catch (error) {
      Alert.alert('Erreur', `Impossible de ${action} la course.`);
    }
  };

  const getStatusConfig = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', label: 'NOUVELLE DEMANDE', icon: 'time' };
      case 'ACCEPTEE': return { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', label: 'EN ROUTE VERS CLIENT', icon: 'car' };
      case 'EN_COURS': return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', label: 'COURSE EN COURS', icon: 'map' };
      case 'TERMINEE': return { color: '#64748B', bg: 'rgba(100, 116, 139, 0.1)', label: 'TERMINÉE', icon: 'checkmark-circle' };
      case 'ANNULEE': return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'ANNULÉE', icon: 'close-circle' };
      default: return { color: '#94a3b8', bg: '#f1f5f9', label: statut, icon: 'ellipse' };
    }
  };

  const renderCourse = ({ item, index }: { item: Course, index: number }) => {
    const statusConfig = getStatusConfig(item.statut);

    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20 * (index + 1), 0] }) }] }]}>
        
        {/* EN-TÊTE CARTE */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
            <Text style={[styles.badgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceValue}>{item.prix}</Text>
            <Text style={styles.priceCurrency}>FCFA</Text>
          </View>
        </View>

        {/* INFO CLIENT */}
        <View style={styles.clientSection}>
          <View style={styles.clientAvatar}>
            <Ionicons name="person" size={18} color="#94a3b8" />
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{item.user.prenom} {item.user.nom}</Text>
            <Text style={styles.clientPhone}>{item.user.telephone}</Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call" size={18} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* TIMELINE TRAJET */}
        <View style={styles.timelineContainer}>
          <View style={styles.verticalLine} />
          <View style={styles.timelineRow}>
            <View style={styles.dotStart} />
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Lieu de prise en charge</Text>
              <Text style={styles.addressText} numberOfLines={2}>{item.departAdresse}</Text>
            </View>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.dotEnd}><View style={styles.dotEndInner} /></View>
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Destination finale</Text>
              <Text style={styles.addressText} numberOfLines={2}>{item.destinationAdresse}</Text>
            </View>
          </View>
        </View>

        {/* DISTANCE & BOUTONS D'ACTION */}
        <View style={styles.footerSection}>
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={14} color="#64748B" />
            <Text style={styles.distanceText}>{item.distance} km</Text>
          </View>

          {item.statut === 'EN_ATTENTE' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleCourseAction(item.id, 'accepter')}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Accepter la course</Text>
                <Ionicons name="arrow-forward" size={18} color="white" style={{marginLeft: 8}} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {item.statut === 'ACCEPTEE' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleCourseAction(item.id, 'demarrer')}>
              <LinearGradient colors={['#3B82F6', '#60A5FA']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Démarrer la course</Text>
                <Ionicons name="play" size={18} color="white" style={{marginLeft: 8}} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {item.statut === 'EN_COURS' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleCourseAction(item.id, 'terminer')}>
              <LinearGradient colors={['#10B981', '#34D399']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Terminer la course</Text>
                <Ionicons name="checkmark-done" size={18} color="white" style={{marginLeft: 8}} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      
      {/* HEADER PRO */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerPremium}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerGreeting}>Bonjour, {user?.prenom}</Text>
              <Text style={styles.headerTitle}>Tableau de bord</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>EN LIGNE</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* LISTE DES COURSES */}
      <FlatList
        data={courses}
        renderItem={renderCourse}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="radar" size={70} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>En attente de courses...</Text>
            <Text style={styles.emptySub}>Les demandes des clients apparaîtront ici en temps réel.</Text>
          </View>
        }
      />

      {/* MODAL ZONE INTERDITE 7D */}
      <Modal visible={showRestrictedZoneAlert} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalGlow} />
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={60} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>ALERTE SÉCURITÉ</Text>
            <Text style={styles.modalText}>{currentRestrictedZone}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowRestrictedZoneAlert(false)} activeOpacity={0.8}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.modalBtnGradient}>
                <Text style={styles.modalBtnText}>J'ai compris, je quitte la zone</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // HEADER
  headerPremium: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10 },
  headerGreeting: { fontSize: 13, color: '#FF8E64', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: 'white', marginTop: 4 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  onlineText: { color: '#10B981', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  listContainer: { padding: 20, paddingBottom: 100 },
  
  // CARTE COURSE
  card: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#94a3b8', shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  priceValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  priceCurrency: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginLeft: 4, marginBottom: 4 },

  // INFO CLIENT
  clientSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 16, marginBottom: 20 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  clientInfo: { flex: 1, marginLeft: 12 },
  clientName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  clientPhone: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },

  // TIMELINE
  timelineContainer: { position: 'relative', paddingLeft: 10, marginBottom: 20 },
  verticalLine: { position: 'absolute', left: 15, top: 15, bottom: 15, width: 2, backgroundColor: '#E2E8F0' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  dotStart: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', marginTop: 4, marginRight: 15, borderWidth: 3, borderColor: '#D1FAE5' },
  dotEnd: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B35', marginTop: 4, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  dotEndInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'white' },
  addressBox: { flex: 1 },
  addressLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  addressText: { fontSize: 14, fontWeight: '700', color: '#334155' },

  // FOOTER CARTE
  footerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  distanceText: { fontSize: 12, fontWeight: '800', color: '#64748B', marginLeft: 6 },
  
  actionBtnContainer: { flex: 1, marginLeft: 15, borderRadius: 14, overflow: 'hidden', elevation: 3 },
  actionGradient: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionText: { color: 'white', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },

  // EMPTY STATE
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#475569', marginTop: 20 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  // MODAL ALERTE
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 30, padding: 30, width: '100%', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  modalGlow: { position: 'absolute', top: -50, width: 150, height: 150, backgroundColor: '#EF4444', opacity: 0.15, borderRadius: 75, filter: 'blur(30px)' },
  modalHeader: { marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#EF4444', letterSpacing: 1, marginBottom: 15 },
  modalText: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, fontWeight: '600', marginBottom: 30 },
  modalBtn: { width: '100%', borderRadius: 18, overflow: 'hidden', elevation: 5, shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 10 },
  modalBtnGradient: { paddingVertical: 18, alignItems: 'center' },
  modalBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },
});