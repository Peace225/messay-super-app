import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../store/authStore';
import {
  libelleSiegeInterurbain,
  lireMesBilletsInterurbains,
  lireBilletInterurbainParId,
  type BilletInterurbain,
} from '../services/messayBilletsInterurbains.service';

/** Billets historiques authentifiés par le JWT MESSAY (/api/tickets).
 * Ne consulte pas directement public.tickets : la liaison d'identité avec
 * les nouveaux billets Supabase n'est pas encore vérifiée côté serveur.
 */
type Tab = 'upcoming' | 'used' | 'history';
type TicketView = BilletInterurbain & {
  tab: Tab;
  statusLabel: string;
  dateLabel: string;
  timeLabel: string;
  seatLabel: string;
};

const PURPLE = '#7C3AED';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'upcoming', label: 'À VENIR' },
  { id: 'used', label: 'UTILISÉS' },
  { id: 'history', label: 'HISTORIQUE' },
];

const paidStatuses = new Set(['PAYE', 'UTILISE', 'EXPIRE', 'ANNULE']);

function safeDepartureTime(billet: BilletInterurbain): number | null {
  // Les départs MESSAY CI sont exprimés dans le fuseau Africa/Abidjan (UTC+0).
  // Ne pas inventer une heure lorsque le serveur n'en donne pas une correcte.
  const matchDate = billet.dateDepart.match(/^(\d{4}-\d{2}-\d{2})/);
  const matchTime = billet.heureDepart.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!matchDate || !matchTime) return null;
  const timestamp = Date.parse(`${matchDate[1]}T${matchTime[1]}:${matchTime[2]}:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 'Date non renseignée';
  const timestamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return 'Date non renseignée';
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function formatTime(value: string): string {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : 'Heure non renseignée';
}

function toTicketView(billet: BilletInterurbain, now: number): TicketView {
  const status = billet.statut.trim().toUpperCase();
  const departure = safeDepartureTime(billet);
  const passed = departure !== null && departure < now;
  let tab: Tab = 'history';
  let statusLabel = 'HISTORIQUE';

  if (status === 'PAYE' && !passed) {
    tab = 'upcoming';
    statusLabel = 'PAIEMENT ENREGISTRÉ';
  } else if (status === 'PAYE' && passed) {
    statusLabel = 'DÉPART PASSÉ';
  } else if (status === 'UTILISE') {
    tab = 'used';
    statusLabel = 'UTILISÉ';
  } else if (status === 'ANNULE') {
    statusLabel = 'ANNULÉ';
  } else if (status === 'EXPIRE') {
    statusLabel = 'EXPIRÉ';
  }

  return {
    ...billet,
    tab,
    statusLabel,
    dateLabel: formatDate(billet.dateDepart),
    timeLabel: formatTime(billet.heureDepart),
    seatLabel: libelleSiegeInterurbain(billet),
  };
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('fr-FR') : '—';
}

export default function MyTicketsScreen() {
  const router = useRouter();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [tickets, setTickets] = useState<BilletInterurbain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const detailRequest = useRef(0);
  const [openingDetailId, setOpeningDetailId] =
    useState<string | null>(null);

  const fetchTickets = useCallback(async (refresh = false) => {
    const request = ++latestRequest.current;
    const sessionUserId = useAuthStore.getState().user?.id ?? null;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (!sessionUserId) {
        throw new Error('Connexion requise. Reconnectez-vous pour consulter vos billets.');
      }
      const rows = await lireMesBilletsInterurbains(100);
      if (request !== latestRequest.current) return;
      if (useAuthStore.getState().user?.id !== sessionUserId) {
        throw new Error('La session a changé. Reconnectez-vous pour voir vos billets.');
      }
      // Une réservation RESERVE n'est pas un billet payé et ne s'affiche pas
      // dans les titres de transport. Idem pour les statuts inconnus.
      setTickets(rows.filter((row) => paidStatuses.has(row.statut.trim().toUpperCase())));
      setError(null);
    } catch (caught: unknown) {
      if (request !== latestRequest.current) return;
      setTickets([]); // Ne pas conserver des billets d'un compte précédent.
      setSelectedId(null);
      // Une erreur d'authentification ou de réseau n'est pas une liste vide.
      setError(
        caught instanceof Error && /session|reconnect|401|403/i.test(caught.message)
          ? 'Connexion requise. Reconnectez-vous pour consulter vos billets.'
          : 'Impossible de récupérer les billets. Vérifiez votre connexion puis réessayez.',
      );
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setTickets([]); // Le compte connecté a pu changer depuis la dernière visite.
    setSelectedId(null);
    void fetchTickets();
    return () => {
      latestRequest.current += 1;
      detailRequest.current += 1;
    };
  }, [fetchTickets, authUserId]));

  const openTicketDetail = useCallback(async (ticketId: string) => {
    const sessionUserId =
      useAuthStore.getState().user?.id ?? null;

    if (!sessionUserId) {
      Alert.alert(
        'Connexion requise',
        'Reconnectez-vous pour consulter ce billet.',
      );
      return;
    }

    const request = ++detailRequest.current;
    setOpeningDetailId(ticketId);

    try {
      const billet = await lireBilletInterurbainParId(ticketId);

      // Ne jamais afficher un billet après un changement
      // de compte ou une navigation ayant annulé la lecture.
      if (request !== detailRequest.current ||
          useAuthStore.getState().user?.id !== sessionUserId) {
        return;
      }

      if (!paidStatuses.has(billet.statut.trim().toUpperCase())) {
        throw new Error('Billet non valide pour la consultation.');
      }

      setTickets((previous) =>
        previous.map((item) =>
          item.id === ticketId ? billet : item
        )
      );

      setSelectedId(ticketId);
    } catch {
      if (request === detailRequest.current &&
          useAuthStore.getState().user?.id === sessionUserId) {
        Alert.alert(
          'Détail indisponible',
          'Impossible de vérifier ce billet auprès du serveur. Réessayez.',
        );
      }
    } finally {
      if (request === detailRequest.current) {
        setOpeningDetailId(null);
      }
    }
  }, []);

  const displayedTickets = useMemo(
    () => tickets.map((t) => toTicketView(t, Date.now())),
    [tickets],
  );
  const filtered = displayedTickets.filter((t) => t.tab === activeTab);
  const selected = displayedTickets.find((t) => t.id === selectedId) ?? null;

  const openMap = useCallback(async (ticket: TicketView) => {
    if (!ticket.gareDepart) {
      Alert.alert('Gare non renseignée', 'La compagnie n’a pas encore communiqué la gare de départ.');
      return;
    }
    const query = `${ticket.gareDepart}, ${ticket.depart}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Gare de départ', query);
    }
  }, []);

  const exportReceipt = useCallback(async (ticket: TicketView) => {
    // Ce PDF est un récapitulatif, pas un billet d'embarquement validé.
    // Le QR d'embarquement nécessite une émission/validation sécurisée serveur.
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family:Arial,Helvetica,sans-serif;color:#111827;padding:24px">
      <div style="border:2px solid #7C3AED;border-radius:16px;padding:22px">
      <h1 style="color:#6D28D9">MESSAY — Récapitulatif de voyage</h1>
      <p style="color:#B91C1C;font-weight:bold">DOCUMENT INFORMATIF — NON VALABLE POUR EMBARQUEMENT</p>
      <p><b>Référence :</b> ${escapeHtml(ticket.id)}</p>
      <p><b>Compagnie :</b> ${escapeHtml(ticket.compagnie)}</p>
      <p><b>Trajet :</b> ${escapeHtml(ticket.depart)} — ${escapeHtml(ticket.destination)}</p>
      <p><b>Date :</b> ${escapeHtml(ticket.dateLabel)} à ${escapeHtml(ticket.timeLabel)}</p>
      <p><b>Gare :</b> ${escapeHtml(ticket.gareDepart ?? 'Non renseignée')}</p>
      <p><b>Siège :</b> ${escapeHtml(ticket.seatLabel)}</p>
      <p><b>Statut :</b> ${escapeHtml(ticket.statusLabel)}</p>
      <p><b>Montant enregistré :</b> ${formatPrice(ticket.prix)} FCFA</p>
      <p style="font-size:12px;color:#6B7280">L'attribution du siège est gérée par la compagnie.
        Un document de contrôle d'embarquement sera disponible après raccordement de la validation serveur.</p>
      </div></body></html>`;
    try {
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri);
      else Alert.alert('Récapitulatif créé', 'Le document a été généré sur cet appareil.');
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le récapitulatif.');
    }
  }, []);

  const explainQr = () => Alert.alert(
    'QR non disponible',
    'Le contrôle d’embarquement doit être validé par le serveur. Aucun QR ne peut être créé localement à partir d’une simple référence.',
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#6D28D9', PURPLE]} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <TouchableOpacity accessibilityLabel="Retour" onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes Tickets</Text>
            {process.env.EXPO_PUBLIC_MESSAY_INTERURBAIN_QR_ENABLED === 'true' && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Accéder à mes billets QR interurbains"
                onPress={() => router.push('/mes-billets-qr' as any)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 12 }}
              >
                <Ionicons name="qr-code-outline" size={19} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>QR</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity accessibilityLabel="Actualiser les billets" onPress={() => void fetchTickets(true)}>
              <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setActiveTab(tab.id)}>
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabActive]}>{tab.label}</Text>
                {activeTab === tab.id && <View style={styles.tabLine} />}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ImageBackground
        source={require('../../assets/images/bus.jpg')}
        style={styles.bg}
        imageStyle={{ opacity: 0.04 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchTickets(true)}
              tintColor={PURPLE}
            />
          }
        >
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => void fetchTickets(true)}>
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={PURPLE} style={{ marginTop: 80 }} />
          ) : error && tickets.length === 0 ? null : filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <View style={styles.emptyRing} />
                <Ionicons name="ticket-outline" size={36} color={PURPLE} />
              </View>
              <Text style={styles.emptyTitle}>Aucun billet dans cette rubrique</Text>
              <Text style={styles.emptySub}>
                Seuls les billets enregistrés par MESSAY sont affichés ici.
                Les réservations non payées ne sont pas des billets de voyage.
              </Text>
              <TouchableOpacity style={styles.buyBtn} onPress={() => router.push('/(tabs)/tickets' as any)}>
                <LinearGradient colors={['#FF6B35', '#F97316']} style={styles.buyBtnGrad}>
                  <Text style={styles.buyBtnTxt}>Voir les compagnies</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : filtered.map((ticket) => (
            <View key={ticket.id} style={styles.ticketCard}>
              <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.ticketHeader}>
                <View style={styles.ticketTop}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.companyName} numberOfLines={2}>{ticket.compagnie}</Text>
                    <Text style={styles.ticketCode}>N° {ticket.id.slice(0, 8).toUpperCase()}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: '#FFF' }]} />
                    <Text style={styles.statusTxt}>{ticket.statusLabel}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.ticketBody}>
                <View style={styles.route}>
                  <View style={styles.city}>
                    <Text style={styles.cityLabel}>DE</Text>
                    <Text style={styles.cityName} numberOfLines={2}>{ticket.depart}</Text>
                    <Text style={styles.gare} numberOfLines={2}>{ticket.gareDepart ?? 'Gare non renseignée'}</Text>
                  </View>
                  <View style={styles.routeLine}>
                    <View style={styles.dot} />
                    <View style={styles.line} />
                    <MaterialCommunityIcons name="bus" size={20} color={PURPLE} />
                    <View style={styles.line} />
                    <View style={[styles.dot, { backgroundColor: PURPLE }]} />
                  </View>
                  <View style={styles.city}>
                    <Text style={styles.cityLabel}>À</Text>
                    <Text style={styles.cityName} numberOfLines={2}>{ticket.destination}</Text>
                    <Text style={styles.gare} numberOfLines={2}>{ticket.gareArrivee ?? 'Gare non renseignée'}</Text>
                  </View>
                </View>

                <View style={styles.gareBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gareLabel}>GARE DE DÉPART</Text>
                    <Text style={styles.gareName} numberOfLines={2}>
                      {ticket.gareDepart ?? 'Non renseignée par la compagnie'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.mapBtn} onPress={() => void openMap(ticket)}>
                    <Ionicons name="map-outline" size={14} color={PURPLE} />
                    <Text style={styles.mapBtnT}>Carte</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.divider}>
                  <View style={styles.hole} /><View style={styles.dashLine} /><View style={styles.hole} />
                </View>
                <View style={styles.details}>
                  <View style={styles.detail}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailTxt}>{ticket.dateLabel}</Text>
                  </View>
                  <View style={styles.detail}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailTxt}>{ticket.timeLabel}</Text>
                  </View>
                </View>
                <View style={styles.seatRow}>
                  <MaterialCommunityIcons name="seat" size={16} color={PURPLE} />
                  <Text style={styles.seatText}>{ticket.seatLabel}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Montant enregistré</Text>
                  <Text style={styles.priceTxt}>{formatPrice(ticket.prix)} FCFA</Text>
                </View>
                {ticket.statutAttributionSiege === 'HISTORIQUE_NON_RAPPROCHE' && (
                  <Text style={styles.warningText}>
                    Ancien billet : le siège n'est pas encore rapproché de l'inventaire MESSAY PRO.
                  </Text>
                )}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => {
                    if (process.env.EXPO_PUBLIC_MESSAY_INTERURBAIN_QR_ENABLED === 'true') {
                      router.push('/mes-billets-qr' as any);
                    } else {
                      explainQr();
                    }
                  }}>
                  <Ionicons name="qr-code-outline" size={17} color="#6B7280" />
                  <Text style={styles.actionTxt}>QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void exportReceipt(ticket)}>
                  <Ionicons name="document-text-outline" size={17} color="#6B7280" />
                  <Text style={styles.actionTxt}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void openMap(ticket)}>
                  <Ionicons name="navigate-outline" size={17} color="#6B7280" />
                  <Text style={styles.actionTxt}>Carte</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.primaryAction]}
                  onPress={() => void openTicketDetail(ticket.id)}
                  disabled={openingDetailId !== null}
                >
                  <Text style={styles.primaryTxt}>
                    {openingDetailId === ticket.id
                      ? 'Vérification...'
                      : 'Détails'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </ImageBackground>

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.close} onPress={() => setSelectedId(null)} accessibilityLabel="Fermer">
              <Ionicons name="close" size={20} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selected?.depart} → {selected?.destination}</Text>
            <Text style={styles.modalSub}>
              {selected?.dateLabel} • {selected?.timeLabel}
            </Text>
            <View style={styles.modalGare}>
              <Text style={styles.modalGareLabel}>Compagnie</Text>
              <Text style={styles.modalGareName}>{selected?.compagnie}</Text>
              <Text style={styles.modalGareLabel}>Gare de départ</Text>
              <Text style={styles.modalGareName}>{selected?.gareDepart ?? 'Non renseignée'}</Text>
              <Text style={styles.modalGareLabel}>Siège</Text>
              <Text style={styles.modalGareName}>{selected?.seatLabel}</Text>
              <Text style={styles.modalGareLabel}>Statut</Text>
              <Text style={styles.modalGareName}>{selected?.statusLabel}</Text>
              <Text style={styles.modalGareLabel}>Référence</Text>
              <Text style={styles.modalRef} selectable>{selected?.id}</Text>
            </View>
            <Text style={styles.modalHelp}>
              {process.env.EXPO_PUBLIC_MESSAY_INTERURBAIN_QR_ENABLED === 'true'
                 ? 'Ouvrez le bouton QR pour afficher votre billet officiel.'
                 : 'Le QR d’embarquement sera proposé après validation du contrôle côté serveur.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.buyBtn, { flex: 1 }]}
                onPress={() => selected && void exportReceipt(selected)}
              >
                <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.buyBtnGrad}>
                  <Ionicons name="document-text-outline" size={16} color="#FFF" />
                  <Text style={[styles.buyBtnTxt, { marginLeft: 6 }]}>Récapitulatif PDF</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapBtnLarge} onPress={() => selected && void openMap(selected)}>
                <Ionicons name="map-outline" size={16} color="#111" />
                <Text style={styles.mapBtnLargeText}>Carte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  tabActive: { color: '#FFF' },
  tabLine: { position: 'absolute', bottom: 0, width: '70%', height: 3, backgroundColor: '#FFF', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bg: { flex: 1 }, scroll: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  errorBox: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 18 },
  errorText: { color: '#991B1B', flexGrow: 1, flexBasis: '60%', fontSize: 12 },
  retryText: { color: '#7C3AED', fontSize: 12, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#E5E7EB', borderTopColor: PURPLE, borderRightColor: PURPLE, transform: [{ rotate: '-45deg' }] },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 30 },
  buyBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  buyBtnGrad: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buyBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  ticketCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  ticketHeader: { padding: 16 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  companyName: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  ticketCode: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5, backgroundColor: 'rgba(255,255,255,0.20)', maxWidth: '55%' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  ticketBody: { padding: 16 },
  route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  city: { flex: 1 },
  cityLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 },
  cityName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  gare: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  routeLine: { alignItems: 'center', paddingHorizontal: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  line: { width: 1, height: 18, backgroundColor: '#E5E7EB', marginVertical: 2 },
  gareBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 10, marginTop: 12 },
  gareLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.5 },
  gareName: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  mapBtn: { flexDirection: 'row', gap: 4, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  mapBtnT: { fontSize: 11, fontWeight: '700', color: PURPLE },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, marginHorizontal: -16 },
  hole: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F9FAFB' },
  dashLine: { flex: 1, height: 1, borderStyle: 'dashed', borderTopWidth: 1, borderColor: '#E5E7EB' },
  details: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailTxt: { fontSize: 12, color: '#374151', fontWeight: '600' },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  seatText: { fontSize: 12, fontWeight: '700', color: '#374151', flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  priceLabel: { fontSize: 11, color: '#6B7280' },
  priceTxt: { fontSize: 16, fontWeight: '900', color: '#111827' },
  warningText: { marginTop: 10, fontSize: 11, color: '#92400E' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 10, gap: 6, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F9FAFB' },
  actionTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  primaryAction: { backgroundColor: '#7C3AED15', marginLeft: 'auto' },
  primaryTxt: { color: PURPLE, fontWeight: '700', fontSize: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, width: '100%' },
  close: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontWeight: '800', fontSize: 15, marginTop: 8, marginRight: 26 },
  modalSub: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  modalGare: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, width: '100%', marginTop: 10, borderWidth: 1, borderColor: '#F3F4F6', gap: 3 },
  modalGareLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '700', marginTop: 7 },
  modalGareName: { fontWeight: '800', fontSize: 13, color: '#111827' },
  modalRef: { fontSize: 11, color: '#4B5563' },
  modalHelp: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 12 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  mapBtnLarge: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  mapBtnLargeText: { fontWeight: '700', color: '#111827', fontSize: 12 },
});
