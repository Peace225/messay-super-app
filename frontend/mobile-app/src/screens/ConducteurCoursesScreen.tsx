import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { courseService } from '../services/courseService';
import type { Course, WeeklyStats } from '../services/courseService';
import {
  conducteurDisponibiliteService,
  type DisponibiliteConducteur,
} from '../services/conducteurDisponibiliteService';

type Tab = 'ACTIVE' | 'HISTORY' | 'PAYMENTS';
type Action = 'accepter' | 'demarrer' | 'terminer';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string; icon: IconName; outline: IconName }[] = [
  { key: 'ACTIVE', label: 'Radar', icon: 'flash', outline: 'flash-outline' },
  { key: 'HISTORY', label: 'Historique', icon: 'time', outline: 'time-outline' },
  { key: 'PAYMENTS', label: 'Revenus', icon: 'wallet', outline: 'wallet-outline' },
];

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as {
      response?: { data?: { error?: string; message?: string } };
      message?: string;
    };
    return e.response?.data?.error ?? e.response?.data?.message ??
      e.message ?? 'Une erreur est survenue';
  }
  return 'Une erreur est survenue';
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function getStatusColor(status: Course['statut']): string {
  switch (status) {
    case 'EN_ATTENTE': return '#64748B';
    case 'ACCEPTEE': return '#3B82F6';
    case 'EN_COURS': return '#F59E0B';
    case 'TERMINEE': return '#10B981';
    default: return '#EF4444';
  }
}

function socketUrlFromApi(): string | null {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const base = api.defaults.baseURL?.trim();
  if (!base) return null;
  // api.ts définit déjà l'URL de l'API : il ne faut PAS coder en dur une autre IP.
  return base.replace(/\/+$/, '').replace(/\/api\/?$/i, '');
}

export default function ConducteurCoursesScreen() {
  const { user, logout, isAuthenticated, isLoading: authLoading, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('ACTIVE');
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [disponibilite, setDisponibilite] = useState<DisponibiliteConducteur | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changingAvailability, setChangingAvailability] = useState(false);
  const [actionCourseId, setActionCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isDriver = isAuthenticated && user?.role === 'CONDUCTEUR';
  const isBusy = disponibilite?.statut === 'EN_COURSE' || courses.some(
    c => !!c.conducteurId && (c.statut === 'ACCEPTEE' || c.statut === 'EN_COURS'),
  );
  const isOnline = disponibilite?.isOnline === true && disponibilite.isVerified && !isBusy;

  // Le backend est la source de vérité. La liste radar et l'historique ne sont pas la même API.
  const loadDashboard = useCallback(async (pullToRefresh = false): Promise<void> => {
    if (!isAuthenticated || user?.role !== 'CONDUCTEUR') return;
    const requestId = ++requestIdRef.current;
    if (pullToRefresh) setRefreshing(true);

    try {
      const [status, mine, weekly] = await Promise.all([
        conducteurDisponibiliteService.get(),
        courseService.getConducteurCourses(),
        courseService.getWeeklyStats(),
      ]);

      const hasActiveRide = mine.some(c => c.statut === 'ACCEPTEE' || c.statut === 'EN_COURS');
      const canSeeAvailable = status.isOnline && status.isVerified && !hasActiveRide;
      const available = canSeeAvailable ? await courseService.getAvailableCourses() : [];

      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      const mineIds = new Set(mine.map(c => c.id));
      setCourses([
        ...mine,
        ...available.filter(c => c.statut === 'EN_ATTENTE' && !mineIds.has(c.id)),
      ]);
      setDisponibilite(status);
      setStats(weekly);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      // Ne jamais afficher « En ligne » sur la base d'un état local périmé.
      setDisponibilite(null);
      setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    mountedRef.current = true;
    if (!authLoading && isDriver) {
      void loadDashboard();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      fadeAnim.stopAnimation();
    };
  }, [authLoading, isDriver, loadDashboard, fadeAnim]);

  useEffect(() => {
    pulseAnim.stopAnimation();
    if (!isOnline) {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.3, duration: 850, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isOnline, pulseAnim]);

  useEffect(() => {
    if (!isDriver || !accessToken) return;
    const url = socketUrlFromApi();
    if (!url) return;

    // Le serveur Socket.IO DOIT vérifier ce JWT avant d'autoriser ses salons.
    const socket = io(url, {
      auth: { token: accessToken },
      reconnection: true,
    });
    const refresh = () => { void loadDashboard(); };

    // Ne jamais insérer directement un événement Socket.IO dans la liste des courses :
    // toujours recharger les données via l'API authentifiée.
    socket.on('connect', refresh);
    socket.on('new-course-available', refresh);
    socket.on('new_course_available', refresh); // Compatibilité backend précédent
    socket.on('course_taken', refresh);
    socket.on('status-changed', refresh);
    socket.on('course_finished', refresh);
    socket.on('course_accepted', refresh);
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [isDriver, accessToken, loadDashboard]);

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  const toggleAvailability = async (): Promise<void> => {
    if (!disponibilite || changingAvailability || actionInFlightRef.current || isBusy) return;
    const next = !isOnline;
    if (next && !disponibilite.isVerified) {
      Alert.alert('Compte en attente', 'Votre profil doit être validé par un administrateur.');
      return;
    }

    setChangingAvailability(true);
    try {
      const updated = await conducteurDisponibiliteService.set(next);
      if (mountedRef.current) setDisponibilite(updated);
      await loadDashboard();
    } catch (err) {
      Alert.alert('Disponibilité non modifiée', getErrorMessage(err));
      await loadDashboard();
    } finally {
      if (mountedRef.current) setChangingAvailability(false);
    }
  };

  const handleAction = async (id: string, action: Action): Promise<void> => {
    if (actionInFlightRef.current || changingAvailability) return;
    actionInFlightRef.current = true;
    setActionCourseId(id);

    try {
      if (action === 'accepter') await courseService.acceptCourse(id);
      if (action === 'demarrer') await courseService.startCourse(id);
      if (action === 'terminer') await courseService.completeCourse(id);
      await loadDashboard();
      Alert.alert('Succès', action === 'accepter'
        ? 'Course acceptée.'
        : action === 'demarrer' ? 'Course démarrée.' : 'Course terminée.');
    } catch (err) {
      Alert.alert('Action impossible', getErrorMessage(err));
      await loadDashboard();
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) setActionCourseId(null);
    }
  };

  const callPassenger = async (phone: string): Promise<void> => {
    const sanitized = phone.replace(/[^\d+]/g, '');
    if (!sanitized) return;
    try {
      await Linking.openURL(`tel:${sanitized}`);
    } catch {
      Alert.alert('Appel impossible', 'Votre appareil ne peut pas lancer cet appel.');
    }
  };

  const handleLogout = (): void => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const visibleCourses = useMemo(() => {
    if (activeTab === 'ACTIVE') {
      return courses.filter(c =>
        c.statut === 'ACCEPTEE' || c.statut === 'EN_COURS' ||
        (isOnline && c.statut === 'EN_ATTENTE'),
      );
    }
    if (activeTab === 'HISTORY') return courses.filter(c => c.statut === 'TERMINEE' || c.statut === 'ANNULEE');
    return [];
  }, [activeTab, courses, isOnline]);

  const renderCourse = ({ item }: { item: Course }) => {
    const action: Action | null = item.statut === 'EN_ATTENTE' ? 'accepter'
      : item.statut === 'ACCEPTEE' ? 'demarrer'
      : item.statut === 'EN_COURS' ? 'terminer' : null;
    const actionLabel = action === 'accepter' ? 'ACCEPTER'
      : action === 'demarrer' ? 'DÉMARRER' : 'TERMINER';
    const actionColor = action === 'accepter' ? '#FF6B35'
      : action === 'demarrer' ? '#3B82F6' : '#10B981';
    const working = actionCourseId === item.id;
    const clientName = [item.user?.prenom, item.user?.nom].filter(Boolean).join(' ') || 'Client';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.priceText}>{formatMoney(item.prixFinal ?? item.prix)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.statut) }]}>
            <Text style={styles.statusText}>{item.statut.replace('_', ' ')}</Text>
          </View>
        </View>
        <View style={styles.locSection}>
          <View style={styles.locRow}>
            <Ionicons name="location" size={16} color="#10B981" />
            <Text style={styles.locText} numberOfLines={2}>{item.departAdresse}</Text>
          </View>
          <View style={styles.locRow}>
            <Ionicons name="flag" size={16} color="#FF6B35" />
            <Text style={styles.locText} numberOfLines={2}>{item.destinationAdresse}</Text>
          </View>
        </View>
        <View style={styles.actionContainer}>
          {action && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!!actionCourseId || changingAvailability || (action === 'accepter' && !isOnline)}
              style={[styles.acceptBtn, { backgroundColor: actionColor },
                (!!actionCourseId || changingAvailability) && styles.disabledButton]}
              onPress={() => { void handleAction(item.id, action); }}
            >
              {working ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>{actionLabel}</Text>}
            </TouchableOpacity>
          )}
          {(item.statut === 'ACCEPTEE' || item.statut === 'EN_COURS') && item.user?.telephone && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Appeler le client"
              style={styles.callBtn}
              onPress={() => { void callPassenger(item.user!.telephone!); }}
            >
              <Ionicons name="call" size={20} color="#10B981" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (authLoading || (loading && isDriver)) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loaderText}>Chargement du tableau de bord…</Text>
      </View>
    );
  }

  if (!isDriver) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.loaderText}>Accès réservé aux conducteurs connectés.</Text>
      </View>
    );
  }

  const availabilityLabel = !disponibilite ? 'Statut indisponible'
    : !disponibilite.isVerified ? 'En attente de validation'
    : isBusy ? 'En course'
    : isOnline ? 'En ligne' : 'Hors ligne';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <View style={styles.profileSection}>
              <View style={styles.avatarWrapper}>
                {user?.photo ? (
                  <Image source={{ uri: user.photo }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={27} color="white" />
                )}
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {[user?.prenom, user?.nom].filter(Boolean).join(' ')}
                </Text>
                <TouchableOpacity
                  style={[styles.onlineToggleBtn, !isOnline && styles.offlineToggleBtn,
                    (!disponibilite || isBusy || changingAvailability) && styles.disabledButton]}
                  disabled={!disponibilite || isBusy || changingAvailability || !!actionCourseId}
                  accessibilityRole="button"
                  accessibilityLabel={`Changer la disponibilité, actuellement ${availabilityLabel}`}
                  onPress={() => { void toggleAvailability(); }}
                >
                  {changingAvailability ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <Animated.View style={[styles.pulseDot,
                      !isOnline && styles.pulseDotOffline, { opacity: pulseAnim }]} />
                  )}
                  <Text style={[styles.onlineText, !isOnline && styles.offlineText]}>{availabilityLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity accessibilityLabel="Se déconnecter" onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="power" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <View style={styles.tabBar}>
            {TABS.map(tab => {
              const selected = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabItem, selected && styles.tabActive]}>
                  <Ionicons name={selected ? tab.icon : tab.outline} size={18}
                    color={selected ? '#FF6B35' : '#94A3B8'} />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {error && (
        <TouchableOpacity style={styles.errorBox} onPress={onRefresh}>
          <Ionicons name="warning-outline" size={18} color="#991B1B" />
          <Text style={styles.errorText}>{error} — Toucher pour réessayer</Text>
        </TouchableOpacity>
      )}

      {activeTab === 'PAYMENTS' ? (
        <View style={styles.revenuesContainer}>
          <View style={styles.revenueCard}>
            <Ionicons name="cash" size={35} color="#10B981" />
            <Text style={styles.revenueTitle}>Montant des courses (semaine)</Text>
            <Text style={styles.revenueAmount}>{formatMoney(stats?.totalRevenus ?? 0)}</Text>
            <Text style={styles.revenueHint}>Montant des courses terminées, pas nécessairement encaissé.</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#3B82F6" />
              <Text style={styles.statLabel}>Courses terminées</Text>
              <Text style={styles.statValue}>{stats?.totalCourses ?? 0}</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="star-outline" size={24} color="#F59E0B" />
              <Text style={styles.statLabel}>Note moyenne</Text>
              <Text style={styles.statValue}>
                {disponibilite?.rating == null ? '—' : disponibilite.rating.toFixed(1)}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.refreshStats} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color="#475569" />
            <Text style={styles.refreshStatsLabel}>{refreshing ? 'Actualisation…' : 'Actualiser'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={visibleCourses}
          renderItem={renderCourse}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name={activeTab === 'ACTIVE' ? 'radar' : 'clipboard-text-clock'}
                size={76} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'ACTIVE' ? 'Aucune course à afficher' : 'Historique vide'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'HISTORY'
                  ? 'Vos courses terminées et annulées apparaîtront ici.'
                  : isBusy ? 'Terminez votre course en cours pour reprendre de nouvelles demandes.'
                    : !isOnline ? 'Passez en ligne après validation de votre profil pour recevoir des courses.'
                      : 'Aucune nouvelle demande pour le moment. Tirez vers le bas pour actualiser.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  profileDetails: { flex: 1 },
  avatarWrapper: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#FF6B35', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' },
  avatarImage: { width: '100%', height: '100%' },
  onlineToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, marginTop: 5, alignSelf: 'flex-start', gap: 6 },
  offlineToggleBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  pulseDotOffline: { backgroundColor: '#EF4444' },
  onlineText: { fontSize: 11, color: '#10B981', fontWeight: '800' },
  offlineText: { color: '#EF4444' },
  disabledButton: { opacity: 0.65 },
  headerName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 15, marginLeft: 8 },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10, marginTop: 24 },
  tabItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14 },
  tabActive: { backgroundColor: 'rgba(255, 107, 53, 0.1)' },
  tabLabel: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
  tabLabelActive: { color: '#FF6B35' },
  list: { padding: 20, flexGrow: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  clientInfo: { flex: 1, paddingRight: 10 },
  clientName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  priceText: { fontSize: 15, fontWeight: '900', color: '#FF6B35', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  locSection: { marginBottom: 15, gap: 8, borderLeftWidth: 2, borderLeftColor: '#F1F5F9', marginLeft: 5, paddingLeft: 15 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  locText: { fontSize: 13, color: '#64748B', marginLeft: 10, flex: 1 },
  actionContainer: { flexDirection: 'row', gap: 10 },
  acceptBtn: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  callBtn: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 25 },
  loaderText: { color: '#FFFFFF', marginTop: 10, fontWeight: '600', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#475569', marginTop: 15 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 10, marginTop: 6, lineHeight: 20 },
  revenuesContainer: { padding: 20 },
  revenueCard: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 25, alignItems: 'center', marginBottom: 20, elevation: 5, shadowColor: '#10B981', shadowOpacity: 0.2, shadowRadius: 15 },
  revenueTitle: { fontSize: 13, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  revenueAmount: { fontSize: 30, fontWeight: '900', color: '#1E293B' },
  revenueHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 15 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, alignItems: 'center', elevation: 2, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 5 },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 10, marginBottom: 5, textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 12, gap: 8 },
  errorText: { fontSize: 12, color: '#991B1B', flex: 1 },
  refreshStats: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 8 },
  refreshStatsLabel: { fontSize: 12, color: '#475569', fontWeight: '700' },
});
