import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Image,
} from 'react-native';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { courseService, type Course, type CourseStatus } from '../services/courseService';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type CourseFilter = 'TOUTES' | 'ACTIVES' | 'TERMINEES' | 'ANNULEES';

const FILTERS: { value: CourseFilter; label: string }[] = [
  { value: 'TOUTES', label: 'Toutes' },
  { value: 'ACTIVES', label: 'En cours' },
  { value: 'TERMINEES', label: 'Terminées' },
  { value: 'ANNULEES', label: 'Annulées' },
];

const STATUS_LABELS: Record<CourseStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTEE: 'Acceptée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
};

const STATUS_COLORS: Record<CourseStatus, { bg: string; text: string; border: string }> = {
  EN_ATTENTE: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  ACCEPTEE: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  EN_COURS: { bg: '#f5f3ff', text: '#4f46e5', border: '#ddd6fe' },
  TERMINEE: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  ANNULEE: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

export default function CoursesHistoriqueScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CourseFilter>('TOUTES');
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Invalide toute réponse HTTP arrivée après un changement d'écran ou un nouvel appel.
  const requestId = useRef(0);

  const loadCourses = useCallback(async (isRefresh = false): Promise<void> => {
    const currentRequest = ++requestId.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // L'API MESSAY renvoie directement Course[], pas { courses: Course[] }.
      const result = await courseService.getUserCourses();
      if (!Array.isArray(result)) throw new Error('Format de réponse API inattendu');
      if (currentRequest === requestId.current) setCourses(result);
    } catch (err) {
      if (currentRequest === requestId.current) {
        console.error('[MESSAY] Erreur historique des courses :', err);
        setError('Impossible de récupérer vos courses. Vérifiez votre connexion puis réessayez.');
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Actualise les courses lorsque l'écran redevient visible.
  // Tous les hooks sont exécutés avant le rendu conditionnel Redirect.
  useFocusEffect(
    useCallback(() => {
      if (authLoading || !isAuthenticated) return;
      void loadCourses();
      return () => {
        requestId.current += 1;
      };
    }, [authLoading, isAuthenticated, loadCourses]),
  );

  const visibleCourses = useMemo(() => {
    switch (filter) {
      case 'ACTIVES':
        return courses.filter((c) =>
          c.statut === 'EN_ATTENTE' || c.statut === 'ACCEPTEE' || c.statut === 'EN_COURS',
        );
      case 'TERMINEES':
        return courses.filter((c) => c.statut === 'TERMINEE');
      case 'ANNULEES':
        return courses.filter((c) => c.statut === 'ANNULEE');
      default:
        return courses;
    }
  }, [courses, filter]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const renderCourse = ({ item: course }: { item: Course }) => {
    const statusStyle = STATUS_COLORS[course.statut] ?? STATUS_COLORS.EN_ATTENTE;
    const driver = course.conducteur?.user;
    const driverName = [driver?.prenom, driver?.nom].filter(Boolean).join(' ').trim();
    const driverPhoto = driver?.photo?.trim();
    const montant = course.prixFinal ?? course.prix;

    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <View style={styles.dateIconWrapper}>
              <FontAwesome5 name="calendar-alt" size={12} color="#64748b" />
            </View>
            <Text style={styles.courseDate}>{formatDate(course.createdAt)}</Text>
          </View>
          <View style={[styles.statutBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
            <Text style={[styles.statutText, { color: statusStyle.text }]}>
              {STATUS_LABELS[course.statut] ?? course.statut}
            </Text>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeTimeline}>
            <View style={[styles.dot, { backgroundColor: '#1e293b' }]} />
            <View style={styles.line} />
            <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          </View>
          <View style={styles.routeTexts}>
            <Text style={styles.addressText} numberOfLines={2}>
              {course.departAdresse || 'Départ non renseigné'}
            </Text>
            <View style={styles.routeSpacer} />
            <Text style={styles.addressText} numberOfLines={2}>
              {course.destinationAdresse || 'Destination non renseignée'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>
              {course.statut === 'TERMINEE' ? 'MONTANT' : 'PRIX ESTIMÉ'}
            </Text>
            <Text style={styles.priceValue}>{formatPrice(montant)}</Text>
          </View>

          {driver ? (
            <View style={styles.driverInfoBox}>
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={styles.miniDriverPic} />
              ) : (
                <View style={styles.driverFallback}>
                  <Ionicons name="person" size={15} color="#64748b" />
                </View>
              )}
              <Text style={styles.driverNameText} numberOfLines={1}>
                {driverName || 'Conducteur'}
              </Text>
            </View>
          ) : (
            <View style={styles.pendingDriverBox}>
              {course.statut === 'EN_ATTENTE' && (
                <ActivityIndicator size="small" color="#d97706" style={styles.pendingSpinner} />
              )}
              <Text style={styles.noDriverText}>
                {course.statut === 'EN_ATTENTE' ? 'Recherche...' : 'Non attribué'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>Vérification de votre session...</Text>
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;

  if (loading && !refreshing) {
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

      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.headerPremium}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes Courses</Text>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setFiltersVisible((visible) => !visible)}
            accessibilityLabel="Afficher ou masquer les filtres"
          >
            <Ionicons name="options-outline" size={22} color="#fbbf24" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {filtersVisible && (
        <View style={styles.filtersContainer}>
          {FILTERS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.filterChip, filter === option.value && styles.filterChipActive]}
              onPress={() => setFilter(option.value)}
              accessibilityRole="button"
            >
              <Text style={[styles.filterChipText, filter === option.value && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && courses.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Actualisation impossible. Données précédentes affichées.</Text>
          <TouchableOpacity onPress={() => void loadCourses(true)}>
            <Text style={styles.retryLink}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        style={styles.scrollArea}
        data={visibleCourses}
        renderItem={renderCourse}
        keyExtractor={(course) => course.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, visibleCourses.length === 0 && styles.emptyListContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadCourses(true)}
            tintColor="#fbbf24"
            colors={['#fbbf24']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name={error ? 'exclamation-circle' : 'route'} size={40} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>
              {error ? 'Chargement impossible' : filter === 'TOUTES' ? 'Aucune course pour le moment' : 'Aucune course correspondante'}
            </Text>
            <Text style={styles.emptySubtext}>
              {error ?? (filter === 'TOUTES'
                ? 'Vos demandes de tricycle apparaîtront ici, même avant la fin de la course.'
                : 'Essayez un autre filtre pour retrouver vos courses.')}
            </Text>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={error
                ? () => void loadCourses()
                : () => filter !== 'TOUTES' ? setFilter('TOUTES') : router.push('/(tabs)/tricycle')}
            >
              <Text style={styles.bookBtnText}>
                {error ? 'Réessayer' : filter !== 'TOUTES' ? 'Voir toutes les courses' : 'Commander maintenant'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  loadingText: { marginTop: 15, fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  headerPremium: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  filterBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(251,191,36,0.15)', justifyContent: 'center', alignItems: 'center' },
  filtersContainer: { paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7 },
  filterChipActive: { borderColor: '#fbbf24', backgroundColor: '#fef3c7' },
  filterChipText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#92400e' },
  errorBanner: { marginHorizontal: 20, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: '#fef2f2', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 12, color: '#991b1b', flex: 1 },
  retryLink: { color: '#b91c1c', fontWeight: '800', fontSize: 12 },

  scrollArea: { flex: 1, marginTop: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 15 },
  emptyListContent: { flexGrow: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
  emptyText: { fontSize: 18, fontWeight: '900', color: '#1e293b', textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#64748b', marginTop: 5, textAlign: 'center', paddingHorizontal: 25 },
  bookBtn: { marginTop: 30, backgroundColor: '#fbbf24', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 20 },
  bookBtnText: { color: '#1e293b', fontWeight: '900', fontSize: 15 },

  historyCard: { backgroundColor: '#fff', borderRadius: 25, padding: 20, marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateContainer: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dateIconWrapper: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10, marginRight: 10 },
  courseDate: { fontSize: 13, color: '#475569', fontWeight: '700' },
  statutBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statutText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },

  routeSection: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#f1f5f9' },
  routeTimeline: { alignItems: 'center', marginRight: 15, paddingVertical: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', elevation: 2 },
  line: { width: 2, height: 25, backgroundColor: '#cbd5e1', marginVertical: 4, borderStyle: 'dashed' },
  routeTexts: { flex: 1, justifyContent: 'space-between' },
  addressText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  routeSpacer: { height: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 8 },
  priceBlock: { flexShrink: 1 },
  priceLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 2 },
  priceValue: { fontSize: 19, fontWeight: '900', color: '#1e293b' },
  driverInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 15, maxWidth: '52%' },
  miniDriverPic: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  driverFallback: { width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  driverNameText: { fontSize: 12, fontWeight: '800', color: '#334155', flexShrink: 1 },
  pendingDriverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 15, borderWidth: 1, borderColor: '#fef3c7' },
  pendingSpinner: { marginRight: 6 },
  noDriverText: { fontSize: 12, color: '#d97706', fontWeight: '800' },
});
