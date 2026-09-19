import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, StatusBar, ImageBackground, Alert, Keyboard, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabase';

const FALLBACK = ['Soubré','Yamoussoukro','Bouaké','Guiberoua','Daloa','Dimbokro','Sinfra','Man','Issia','Abidjan'];

export default function BuyTicketScreen() {
  const router = useRouter();
  const { company, color, id } = useLocalSearchParams();
  const companyColor = (color as string) || '#FF6B35';
  const companyName = (company as string) || 'UTB CI';
  const companyId = (id as string) || '';

  const [depart, setDepart] = useState('');
  const [destination, setDestination] = useState('');
  const [garesDep, setGaresDep] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [departSugs, setDepartSugs] = useState<string[]>(FALLBACK);
  const [destSugs, setDestSugs] = useState<any[]>([]);
  const [showDep, setShowDep] = useState(false);
  const [showDest, setShowDest] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const destRef = useRef<TextInput>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 1. GARES DE LA COMPAGNIE CHOISIE (ville de départ)
        if (companyId) {
          const { data: gares } = await supabase.from('gares').select('id,nom,ville').eq('company_id', companyId).order('ville');
          if (gares && gares.length > 0) {
            setGaresDep(gares);
            const uniques = Array.from(new Set(gares.map((g: any) => g.ville))) as string[];
            setDepartSugs(uniques);
          } else {
            // Fallback si pas de gares : cherche toutes gares avec nom compagnie
            const { data: allGares } = await supabase.from('gares').select('id,nom,ville').ilike('ville', '%Abidjan%').limit(50);
            setGaresDep(allGares || []);
            setDepartSugs(FALLBACK);
          }

          // 2. DESTINATIONS DE LA COMPAGNIE CHOISIE
          const { data: dests } = await supabase.from('destinations').select('id,ville,prix,duree,horaires(heure_depart)').eq('company_id', companyId).order('ville');
          if (dests && dests.length > 0) {
            // Ajoute Abidjan si manquant
            const hasAbj = dests.some((d: any) => d.ville.toLowerCase() === 'abidjan');
            const full = hasAbj ? dests : [...dests, { id: 'abidjan-inject', ville: 'Abidjan', prix: 5000, duree: '3h30', horaires: [] }];
            setDestinations(full);
            setDestSugs(full);
          } else {
            // Fallback : destinations = villes où la compagnie a une gare (sauf depart)
            const { data: garesDest } = await supabase.from('gares').select('ville').eq('company_id', companyId);
            const villesDest = Array.from(new Set((garesDest || []).map((g: any) => g.ville))).map((v: any, i: number) => ({ id: 'gare-' + i, ville: v, prix: 5000, duree: '4h00', horaires: [] }));
            const list = villesDest.length > 0 ? villesDest : FALLBACK.map((v, i) => ({ id: 'fb-' + i, ville: v, prix: 5000, duree: '3h30', horaires: [] }));
            setDestinations(list);
            setDestSugs(list);
          }
        } else {
          setDepartSugs(FALLBACK);
          const fb = FALLBACK.map((v, i) => ({ id: 'fb-' + i, ville: v, prix: 5000, duree: '3h30', horaires: [] }));
          setDestinations(fb);
          setDestSugs(fb);
        }
      } catch (e) {
        console.log('load buy-ticket error', e);
        setDepartSugs(FALLBACK);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const getUniqueVilles = (arr: any[]) => Array.from(new Set(arr.map((d: any) => d.ville))) as string[];

  const onDepChange = (t: string) => {
    const all = garesDep.length ? getUniqueVilles(garesDep) : FALLBACK;
    setDepart(t);
    setDepartSugs(t ? all.filter(v => v.toLowerCase().includes(t.toLowerCase())) : all);
    setShowDep(true);
    setShowDest(false);
  };

  const onDepFocus = () => {
    const all = garesDep.length ? getUniqueVilles(garesDep) : FALLBACK;
    setDepartSugs(depart ? all.filter(v => v.toLowerCase().includes(depart.toLowerCase())) : all);
    setShowDep(true);
    setShowDest(false);
  };

  const onDestChange = (t: string) => {
    setDestination(t);
    let base = destinations.length ? destinations : [];
    let f = base.filter((d: any) => String(d.ville).toLowerCase() !== depart.toLowerCase());
    if (t) f = f.filter((d: any) => String(d.ville).toLowerCase().includes(t.toLowerCase()));
    setDestSugs(f);
    setShowDest(true);
    setShowDep(false);
  };

  const onDestFocus = () => {
    let base = destinations.length ? destinations : [];
    let f = base.filter((d: any) => String(d.ville).toLowerCase() !== depart.toLowerCase());
    if (destination) f = f.filter((d: any) => String(d.ville).toLowerCase().includes(destination.toLowerCase()));
    setDestSugs(f.length ? f : base.filter((d: any) => String(d.ville).toLowerCase() !== depart.toLowerCase()));
    setShowDest(true);
    setShowDep(false);
  };

  const formatDate = (d: Date) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

  const search = () => {
    if (!depart || !destination || depart.toLowerCase() === destination.toLowerCase()) {
      return Alert.alert('Erreur', 'Choisis 2 villes différentes');
    }
    Keyboard.dismiss();
    router.push({
      pathname: '/search-results',
      params: { depart, destination, date: formatDate(date), company: companyName, color: companyColor, id: companyId },
    } as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={companyColor} />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Chargement des gares {companyName}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={companyColor} />
      <LinearGradient colors={[companyColor, companyColor]} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.hBar}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#FFF" /></TouchableOpacity>
            <Text style={styles.hTitle}>{companyName}</Text>
            <View style={{ width: 26 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ImageBackground source={require('../../assets/images/bus.jpg')} style={styles.bg} imageStyle={{ opacity: 0.05 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} onScrollBeginDrag={() => { setShowDep(false); setShowDest(false); }}>
          <View style={styles.card}>
            <Text style={styles.title}>Où souhaitez vous aller?</Text>
            <Text style={styles.subtitle}>Gares de {companyName} uniquement</Text>

            <View style={[styles.field, { zIndex: 20 }]}>
              <Text style={styles.label}>Ville de départ</Text>
              <View style={[styles.inputW, showDep && styles.active]}>
                <Ionicons name="location" size={18} color={companyColor} />
                <TextInput value={depart} onChangeText={onDepChange} onFocus={onDepFocus} placeholder="Ex: Abidjan" style={styles.input} />
              </View>
              {showDep && (
                <View style={styles.box}>
                  {departSugs.slice(0, 6).map((v, i) => (
                    <TouchableOpacity key={v + '-' + i} style={styles.row} onPress={() => { setDepart(v); setShowDep(false); destRef.current?.focus(); }}>
                      <Text style={styles.txt}>{v}</Text>
                      <Ionicons name="bus" size={12} color={companyColor} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.field, { zIndex: 10 }]}>
              <Text style={styles.label}>Destination</Text>
              <View style={[styles.inputW, showDest && styles.active]}>
                <Ionicons name="navigate" size={18} color="#F59E0B" />
                <TextInput ref={destRef} value={destination} onChangeText={onDestChange} onFocus={onDestFocus} placeholder="Ex: Yamoussoukro" style={styles.input} />
              </View>
              {showDest && (
                <View style={styles.box}>
                  {destSugs.slice(0, 8).map((it: any, i: number) => (
                    <TouchableOpacity key={(it.id || it.ville) + '-' + i} style={styles.row} onPress={() => { setDestination(it.ville); setShowDest(false); }}>
                      <Text style={styles.bold}>{it.ville}</Text>
                      <Text style={styles.small}>{it.prix} FCFA • {it.duree}</Text>
                    </TouchableOpacity>
                  ))}
                  {destSugs.length === 0 && <Text style={styles.empty}>Aucune ville différente de {depart}</Text>}
                </View>
              )}
            </View>

            <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateBtn}>
              <Text style={styles.dateTxt}>{formatDate(date)}</Text>
              <Ionicons name="calendar-outline" size={20} color={companyColor} />
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={(_, d) => { setShowPicker(false); if (d) setDate(d); }} />
            )}

            <TouchableOpacity style={[styles.btn, { backgroundColor: companyColor, opacity: !depart || !destination ? 0.4 : 1 }]} onPress={search}>
              <Text style={styles.btnTxt}>Rechercher avec {companyName}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 16 },
  hBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  hTitle: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  bg: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, elevation: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  field: { marginBottom: 18, position: 'relative' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  inputW: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, height: 50, paddingHorizontal: 12 },
  active: { borderColor: '#FF6B35' },
  input: { flex: 1, fontWeight: '600', marginLeft: 8 },
  box: { position: 'absolute', top: 74, left: 0, right: 0, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', elevation: 10, zIndex: 50, overflow: 'hidden' },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txt: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  small: { fontSize: 11, color: '#6B7280' },
  empty: { padding: 12, textAlign: 'center', color: '#9CA3AF' },
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', height: 48, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  dateTxt: { fontWeight: '800' },
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#FFF', fontWeight: '800' },
});