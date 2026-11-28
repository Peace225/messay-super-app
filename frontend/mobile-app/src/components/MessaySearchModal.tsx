import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

// Recherche réelle des lignes enregistrées dans Supabase.
// AUCUN prix, trajet, horaire ou numéro de place n'est simulé ici.
// Une ligne et ses horaires ne confirment PAS la disponibilité des sièges.

type Option = {
  id: string;
  companyId: string;
  company: string;
  color: string;
  depart: string;
  destination: string;
  prix: number | null;
  duree: string | null;
  horaires: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onTricycle: () => void;
};

const normalise = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const dateFR = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

export default function MessaySearchModal({ visible, onClose, onTricycle }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requestId = useRef(0);
  const [depart, setDepart] = useState('Abidjan');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!visible) {
      requestId.current += 1;
      setShowDatePicker(false);
    }
  }, [visible]);

  const close = () => {
    requestId.current += 1;
    onClose();
  };

  const edit = (field: 'depart' | 'destination', value: string) => {
    if (field === 'depart') setDepart(value);
    else setDestination(value);
    requestId.current += 1;
    setSearched(false);
    setOptions([]);
    setError('');
    setLoading(false);
  };

  const search = async () => {
    const dep = depart.trim();
    const dest = destination.trim();
    if (dep.length < 2 || dest.length < 2) {
      setError('Saisis une ville de départ et une destination (2 caractères minimum).');
      return;
    }
    if (normalise(dep) === normalise(dest)) {
      setError('Choisis deux villes différentes.');
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    setSearched(false);
    setError('');
    setOptions([]);

    try {
      // 1. Seules les gares véritablement enregistrées peuvent servir de départ.
      const { data: gares, error: garesError } = await supabase
        .from('gares')
        .select('id,ville,company_id')
        .ilike('ville', `%${dep}%`)
        .limit(150);
      if (garesError) throw garesError;
      if (currentRequest !== requestId.current) return;

      const ids = [...new Set((gares || [])
        .filter((g: any) => normalise(String(g.ville || '')).includes(normalise(dep)))
        .map((g: any) => String(g.id)))];

      if (!ids.length) {
        setOptions([]);
        setSearched(true);
        return;
      }

      // 2. On exige une relation explicite entre la destination et la gare de départ.
      // Cela évite d'associer artificiellement un trajet à une compagnie.
      const { data: lignes, error: lignesError } = await supabase
        .from('destinations')
        .select('id,ville,prix,duree,company_id,gare_depart_id,companies(name,color),horaires(id,heure_depart),gare_arrivee:gares!destinations_gare_arrivee_id_fkey(id,nom,ville)')
        .in('gare_depart_id', ids)
        .limit(300);
      if (lignesError) throw lignesError;
      if (currentRequest !== requestId.current) return;

      const gareById = new Map((gares || []).map((g: any) => [String(g.id), String(g.ville)]));
      const found: Option[] = [];
      const seen = new Set<string>();

      for (const raw of lignes || []) {
        const l: any = raw;
        const arriveeVille = String(l.gare_arrivee?.ville || l.ville || '');
        const villeDepart = gareById.get(String(l.gare_depart_id)) || '';
        if (!arriveeVille || !normalise(arriveeVille).includes(normalise(dest))) continue;
        if (!villeDepart || !l.company_id) continue;
        const key = `${l.id}-${l.gare_depart_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const heures = Array.isArray(l.horaires)
          ? [...new Set(l.horaires
            .map((h: any) => String(h.heure_depart || '').slice(0, 5))
            .filter((h: string) => /^\d{2}:\d{2}$/.test(h)))].sort() as string[]
          : [];
        const prix = l.prix === null || l.prix === undefined || l.prix === ''
          ? null : Number(l.prix);

        found.push({
          id: key,
          companyId: String(l.company_id),
          company: String(l.companies?.name || 'Compagnie non renseignée'),
          color: /^#[a-fA-F0-9]{6}$/.test(String(l.companies?.color || ''))
            ? String(l.companies.color) : '#FF6B35',
          depart: villeDepart,
          destination: arriveeVille,
          prix: prix !== null && Number.isFinite(prix) && prix > 0 ? prix : null,
          duree: l.duree ? String(l.duree) : null,
          horaires: heures,
        });
      }

      found.sort((a, b) => (a.prix ?? Infinity) - (b.prix ?? Infinity));
      console.info(`[MESSAY SEARCH] gares=${ids.length}, lignes=${(lignes || []).length}, resultats=${found.length}`);
      setOptions(found.slice(0, 50));
      setSearched(true);
    } catch (e) {
      if (currentRequest !== requestId.current) return;
      console.warn('[MESSAY SEARCH] Erreur Supabase :', e);
      setError('Recherche indisponible. Vérifie la connexion Internet et les autorisations Supabase.');
      setSearched(false);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  const openOption = (item: Option) => {
    // Ne pas ouvrir un parcours de réservation sur des horaires/prix inventés.
    if (item.horaires.length === 0 || item.prix === null) return;
    close();
    router.push({
      pathname: '/search-results',
      params: {
        depart: item.depart,
        destination: item.destination,
        date: dateFR(date),
        company: item.company,
        color: item.color,
        id: item.companyId,
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer la recherche" />
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>RECHERCHE MESSAY</Text>
              <Text style={styles.title}>Où allons-nous ?</Text>
              <Text style={styles.subtitle}>Des trajets issus de nos données, pas des simulations.</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeButton} accessibilityLabel="Fermer">
              <Ionicons name="close" size={20} color="#243047" />
            </TouchableOpacity>
          </View>

          <View style={styles.modeRow}>
            <View style={[styles.mode, styles.modeActive]}>
              <Ionicons name="bus" size={18} color="#FFFFFF" />
              <Text style={styles.modeTextActive}>Billets de bus</Text>
            </View>
            <TouchableOpacity style={styles.mode} onPress={() => { close(); onTricycle(); }}>
              <Ionicons name="car-sport-outline" size={18} color="#556173" />
              <Text style={styles.modeText}>Tricycle</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Ionicons name="navigate-circle-outline" size={22} color="#FF6B35" />
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Ville de départ</Text>
                <TextInput
                  value={depart}
                  onChangeText={(v) => edit('depart', v)}
                  style={styles.input}
                  placeholder="Ex. Abidjan"
                  autoCapitalize="words"
                  accessibilityLabel="Ville de départ"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Ionicons name="location-outline" size={22} color="#FF6B35" />
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Destination</Text>
                <TextInput
                  value={destination}
                  onChangeText={(v) => edit('destination', v)}
                  style={styles.input}
                  placeholder="Ex. Yamoussoukro"
                  autoCapitalize="words"
                  returnKeyType="search"
                  onSubmitEditing={search}
                  accessibilityLabel="Destination"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(!showDatePicker)}>
              <Ionicons name="calendar-outline" size={20} color="#FF6B35" />
              <Text style={styles.dateText}>Date prévue : {dateFR(date)}</Text>
              <Ionicons name="chevron-down" size={17} color="#64748B" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                minimumDate={new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, chosenDate) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (chosenDate) setDate(chosenDate);
                }}
              />
            )}

            <TouchableOpacity
              onPress={search}
              disabled={loading}
              accessibilityRole="button"
              style={styles.searchButton}
            >
              <LinearGradient colors={['#FF8B43', '#F45322']} style={styles.searchGradient}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="search" size={19} color="#FFFFFF" />}
                <Text style={styles.searchButtonText}>{loading ? 'Recherche en cours...' : 'Rechercher les vrais trajets'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {!!error && <Text style={styles.error}>{error}</Text>}
            {searched && !options.length && (
              <View style={styles.empty}>
                <Ionicons name="information-circle-outline" size={28} color="#FF6B35" />
                <Text style={styles.emptyTitle}>Aucun trajet confirmé dans nos données</Text>
                <Text style={styles.emptyText}>Nous n'avons trouvé aucune ligne reliant explicitement ces villes. Essaie une autre recherche ou consulte les compagnies.</Text>
              </View>
            )}
            {!!options.length && (
              <View style={styles.results}>
                <Text style={styles.resultsTitle}>{options.length} ligne{options.length > 1 ? 's' : ''} trouvée{options.length > 1 ? 's' : ''}</Text>
                <Text style={styles.resultsHint}>Les horaires publiés ne garantissent pas une place disponible à la date choisie.</Text>
                {options.map((item) => {
                  const bookable = item.horaires.length > 0 && item.prix !== null;
                  return (
                    <View key={item.id} style={styles.resultCard}>
                      <View style={styles.companyRow}>
                        <View style={[styles.companyDot, { backgroundColor: item.color }]} />
                        <Text style={styles.companyName}>{item.company}</Text>
                      </View>
                      <Text style={styles.route}>{item.depart}  →  {item.destination}</Text>
                      <Text style={styles.meta}>
                        {item.prix === null ? 'Tarif non renseigné' : `${item.prix.toLocaleString('fr-FR')} FCFA`}
                        {'  •  '}{item.duree || 'Durée non renseignée'}
                      </Text>
                      <Text style={styles.hours}>
                        {item.horaires.length ? `Horaires publiés : ${item.horaires.join(' • ')}` : 'Horaires non publiés'}
                      </Text>
                      <TouchableOpacity
                        disabled={!bookable}
                        onPress={() => openOption(item)}
                        style={[styles.resultAction, !bookable && styles.disabledAction]}
                      >
                        <Text style={styles.resultActionText}>{bookable ? 'Consulter ce trajet' : 'Informations insuffisantes'}</Text>
                        {bookable && <Ionicons name="arrow-forward" color="#FFFFFF" size={16} />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,14,26,0.62)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F7F8FC', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10, maxHeight: '93%' },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CFD4DD', alignSelf: 'center', marginBottom: 17 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  headingCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: '#FF6B35', fontWeight: '900', letterSpacing: 1.6, fontSize: 10 },
  title: { fontSize: 27, fontWeight: '900', color: '#111827', marginTop: 4 },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8ECF2', alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 17 },
  mode: { flex: 1, height: 46, borderRadius: 15, backgroundColor: '#EEF1F6', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  modeActive: { backgroundColor: '#FF6B35' },
  modeTextActive: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  modeText: { color: '#556173', fontWeight: '700', fontSize: 12 },
  field: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, borderColor: '#E8EBF2', paddingHorizontal: 15, marginBottom: 10, alignItems: 'center', backgroundColor: '#FFFFFF', minHeight: 66, gap: 10 },
  inputBlock: { flex: 1, paddingVertical: 8 },
  label: { color: '#9099AA', fontWeight: '800', fontSize: 10, letterSpacing: 0.4 },
  input: { paddingVertical: 4, fontSize: 16, color: '#111827', fontWeight: '700' },
  dateField: { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 16, backgroundColor: '#FFFFFF', marginBottom: 12 },
  dateText: { flex: 1, fontSize: 12, color: '#344255', fontWeight: '700' },
  searchButton: { overflow: 'hidden', borderRadius: 17, marginBottom: 12 },
  searchGradient: { height: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  error: { color: '#B91C1C', fontWeight: '700', marginBottom: 12, lineHeight: 20 },
  empty: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 25, marginTop: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'center', marginTop: 8 },
  emptyText: { color: '#64748B', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  results: { paddingTop: 8, paddingBottom: 12 },
  resultsTitle: { fontSize: 19, fontWeight: '900', color: '#111827' },
  resultsHint: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 8 },
  resultCard: { marginTop: 11, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF1F5', borderRadius: 18 },
  companyRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  companyDot: { width: 8, height: 8, borderRadius: 4 },
  companyName: { color: '#111827', fontSize: 13, fontWeight: '900', flex: 1 },
  route: { color: '#1E293B', fontSize: 15, fontWeight: '800', marginTop: 8 },
  meta: { color: '#FF6B35', fontWeight: '800', fontSize: 12, marginTop: 8 },
  hours: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 5 },
  resultAction: { backgroundColor: '#18263D', height: 41, borderRadius: 13, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabledAction: { opacity: 0.52 },
  resultActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
});
