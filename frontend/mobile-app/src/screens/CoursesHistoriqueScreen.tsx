import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router'; // 👈 IMPORT REDIRECT AJOUTÉ
import { useAuthStore } from '../store/authStore';
import { courseService } from '../services/courseService';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function CoursesHistoriqueScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 👉 LE CORRECTIF EST ICI : Si non connecté, on redirige proprement
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const loadCourses = async () => {
    try {
      const response = await courseService.getUserCourses();
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Erreur chargement courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  // Couleurs de badges Premium
  const getStatutStyles = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
      case 'ACCEPTEE': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'EN_COURS': return { bg: '#f5f3ff', text: '#4f46e5', border: '#ddd6fe' };
      case 'TERMINEE': return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'ANNULEE': return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      default: return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    }
  };

  const getStatutLabel = (statut: string) => {
    const labels: any = {
      'EN_ATTENTE': 'En attente',
      'ACCEPTEE': 'Acceptée',
      'EN_COURS': 'En cours',
      'TERMINEE': 'Terminée',
      'ANNULEE': 'Annulée'
    };
    return labels[statut] || statut;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>Récupération de l'historique...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* --- HEADER PREMIUM --- */}
      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.headerPremium}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes Courses</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={22} color="#fbbf24" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* --- LISTE DES COURSES --- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />}
      >
        {courses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="route" size={40} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>Aucun trajet effectué</Text>
            <Text style={styles.emptySubtext}>Vos prochaines courses en tricycle s'afficheront ici.</Text>
            
            <TouchableOpacity style={styles.bookBtn} onPress={() => router.back()}>
              <Text style={styles.bookBtnText}>Commander maintenant</Text>
            </TouchableOpacity>
          </View>
        ) : (
          courses.map((course) => {
            const statusStyle = getStatutStyles(course.statut);
            return (
              <View key={course.id} style={styles.historyCard}>
                
                {/* En-tête : Date & Statut */}
                <View style={styles.cardHeader}>
                  <View style={styles.dateContainer}>
                    <View style={styles.dateIconWrapper}>
                      <FontAwesome5 name="calendar-alt" size={12} color="#64748b" />
                    </View>
                    <Text style={styles.courseDate}>
                      {new Date(course.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.statutBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.statutText, { color: statusStyle.text }]}>
                      {getStatutLabel(course.statut)}
                    </Text>
                  </View>
                </View>

                {/* Détails du Trajet */}
                <View style={styles.routeSection}>
                  <View style={styles.routeTimeline}>
                    <View style={[styles.dot, { backgroundColor: '#1e293b' }]} />
                    <View style={styles.line} />
                    <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                  </View>
                  <View style={styles.routeTexts}>
                    <Text style={styles.addressText} numberOfLines={1}>{course.departAdresse}</Text>
                    <View style={styles.routeSpacer} />
                    <Text style={styles.addressText} numberOfLines={1}>{course.destinationAdresse}</Text>
                  </View>
                </View>

                {/* Footer : Prix & Chauffeur */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>MONTANT</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceValue}>{course.prix.toLocaleString()} F</Text>
                    </View>
                  </View>
                  
                  {course.conducteur ? (
                     <View style={styles.driverInfoBox}>
                        <Image 
                          source={{ uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=100' }} 
                          style={styles.miniDriverPic} 
                        />
                        <Text style={styles.driverNameText}>{course.conducteur.user.prenom}</Text>
                     </View>
                  ) : (
                    <View style={styles.pendingDriverBox}>
                      <ActivityIndicator size="small" color="#fbbf24" style={{marginRight: 6}}/>
                      <Text style={styles.noDriverText}>Recherche...</Text>
                    </View>
                  )}
                </View>

              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  loadingText: { marginTop: 15, fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  
  // Header Premium
  headerPremium: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  filterBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center' },

  scrollArea: { flex: 1, marginTop: -15 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  
  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
  emptyText: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  emptySubtext: { fontSize: 14, color: '#64748b', marginTop: 5, textAlign: 'center', paddingHorizontal: 40 },
  bookBtn: { marginTop: 30, backgroundColor: '#fbbf24', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 20 },
  bookBtnText: { color: '#1e293b', fontWeight: '900', fontSize: 15 },

  // History Card
  historyCard: { backgroundColor: '#fff', borderRadius: 25, padding: 20, marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateContainer: { flexDirection: 'row', alignItems: 'center' },
  dateIconWrapper: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10, marginRight: 10 },
  courseDate: { fontSize: 13, color: '#475569', fontWeight: '700' },
  statutBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statutText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  
  // Route Section
  routeSection: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#f1f5f9' },
  routeTimeline: { alignItems: 'center', marginRight: 15, paddingVertical: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', elevation: 2 },
  line: { width: 2, height: 25, backgroundColor: '#cbd5e1', marginVertical: 4, borderStyle: 'dashed' },
  routeTexts: { flex: 1, justifyContent: 'space-between' },
  addressText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  routeSpacer: { height: 25 },

  // Footer (Price & Driver)
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  priceLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 2 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline' },
  priceValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  
  driverInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15 },
  miniDriverPic: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  driverNameText: { fontSize: 13, fontWeight: '800', color: '#334155' },
  
  pendingDriverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, borderWidth: 1, borderColor: '#fef3c7' },
  noDriverText: { fontSize: 12, color: '#d97706', fontWeight: '800' }
});