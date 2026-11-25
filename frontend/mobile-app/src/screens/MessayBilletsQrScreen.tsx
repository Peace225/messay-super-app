/** Billets interurbains QR du compte MESSAY authentifié.
 * Les billets sont lus côté serveur; le QR n'est jamais fabriqué à partir du ticketId.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import MessayBilletQrCard from '../components/MessayBilletQrCard';
import { lireBilletsQr, lireQrBillet, type NouveauBilletQr, type NouveauBilletQrDetail } from '../services/messayBilletsQr.client';

const QR_ENABLED = process.env.EXPO_PUBLIC_MESSAY_INTERURBAIN_QR_ENABLED === 'true';

export default function MessayBilletsQrScreen() {
  const router = useRouter();
  const userId = useAuthStore(s => s.user?.id ?? null);
  const [billets, setBillets] = useState<NouveauBilletQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NouveauBilletQrDetail | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const detailRef = useRef(0);

  const charger = useCallback(async (refresh = false) => {
    const request = ++requestRef.current;
    const session = useAuthStore.getState().user?.id;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (!QR_ENABLED) throw new Error('MESSAY_QR_NON_ACTIVE');
      if (!session) throw new Error('MESSAY_SESSION_ABSENTE');
      const rows = await lireBilletsQr();
      if (request !== requestRef.current || useAuthStore.getState().user?.id !== session) return;
      setBillets(rows);
      setError(null);
    } catch {
      if (request !== requestRef.current) return;
      setBillets([]);
      setSelected(null);
      setError(!QR_ENABLED
        ? 'La consultation des QR codes n’est pas encore activée.'
        : 'Impossible de vérifier les billets. Réessayez une fois connecté.');
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setBillets([]);
    setSelected(null);
    void charger();
    return () => { requestRef.current++; detailRef.current++; };
  }, [charger, userId]));

  const afficherQr = useCallback(async (billetId: string) => {
    const session = useAuthStore.getState().user?.id;
    if (!session) return Alert.alert('Connexion requise', 'Reconnectez-vous à MESSAY.');
    const request = ++detailRef.current;
    setOpeningId(billetId);
    try {
      const result = await lireQrBillet(billetId);
      if (detailRef.current !== request || useAuthStore.getState().user?.id !== session) return;
      setSelected(result);
    } catch {
      if (detailRef.current === request && useAuthStore.getState().user?.id === session) {
        Alert.alert('Billet indisponible', 'Impossible de vérifier le QR code auprès du serveur. Réessayez.');
      }
    } finally {
      if (detailRef.current === request) setOpeningId(null);
    }
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()}>
          <Ionicons name="arrow-back" color="#FFF" size={23} />
        </Pressable>
        <Text style={s.headerTitle}>Billets QR interurbains</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser" onPress={() => void charger(true)}>
          <Ionicons name="refresh" color="#FFF" size={22} />
        </Pressable>
      </View>
      {loading ? <ActivityIndicator style={s.loading} size="large" color="#6D28D9" /> : (
        <FlatList
          data={billets}
          keyExtractor={item => item.id}
          refreshing={refreshing}
          onRefresh={() => void charger(true)}
          contentContainerStyle={s.list}
          ListHeaderComponent={<Text style={s.info}>Seuls les billets réellement émis sont consultables. Le siège est attribué ensuite par la compagnie.</Text>}
          ListEmptyComponent={<Text style={s.empty}>{error ?? 'Aucun nouveau billet confirmé pour ce compte.'}</Text>}
          renderItem={({ item }) => (
            <View style={s.ticket}>
              <Text style={s.company}>{item.compagnie}</Text>
              <Text style={s.trip}>{item.depart} → {item.destination}</Text>
              <Text style={s.meta}>{item.dateDepart} · {item.heureDepart} · {item.prix.toLocaleString('fr-FR')} FCFA</Text>
              <Text style={s.seat}>{item.siegeAffichage ? `Siège : ${item.siegeAffichage}` : 'Siège en attente d’attribution par la compagnie'}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={openingId !== null}
                style={[s.button, openingId !== null && s.disabled]}
                onPress={() => void afficherQr(item.id)}>
                <Ionicons name="qr-code-outline" color="#FFF" size={20} />
                <Text style={s.buttonText}>{openingId === item.id ? 'Vérification…' : 'Afficher le QR officiel'}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      <Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.modal}>
          <Pressable style={s.close} accessibilityRole="button" onPress={() => setSelected(null)}>
            <Ionicons name="close-circle" color="#111827" size={29} />
            <Text>Fermer</Text>
          </Pressable>
          {selected && <MessayBilletQrCard
            qrPayload={selected.qrPayload}
            compagnie={selected.compagnie}
            depart={selected.depart}
            destination={selected.destination}
            dateDepart={selected.dateDepart}
            heureDepart={selected.heureDepart}
            siegeAffichage={selected.siegeAffichage}
          />}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FC' },
  header: { backgroundColor: '#6D28D9', padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', flex: 1 },
  loading: { flex: 1 },
  list: { padding: 16, paddingBottom: 35 },
  info: { color: '#475467', fontSize: 13, marginBottom: 16 },
  empty: { textAlign: 'center', color: '#667085', padding: 25 },
  ticket: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 14 },
  company: { color: '#6D28D9', fontWeight: '800', fontSize: 17 },
  trip: { color: '#101828', fontWeight: '700', fontSize: 15, marginTop: 8 },
  meta: { color: '#475467', fontSize: 12, marginTop: 8 },
  seat: { color: '#344054', marginVertical: 12, fontSize: 12 },
  button: { backgroundColor: '#6D28D9', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  buttonText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  modal: { flex: 1, backgroundColor: '#F8F9FC', padding: 16, justifyContent: 'center' },
  close: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'absolute', top: 18, right: 18, zIndex: 5 },
});
