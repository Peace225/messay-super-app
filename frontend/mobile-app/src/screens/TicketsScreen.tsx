import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// --- 1. CONFIGURATION DES COMPAGNIES ---
const COMPAGNIES = [
  { id: 'utb', nom: 'UTB', image: require('../../assets/images/compagnies/utb.png'), bgColor: '#E67E22', textColor: '#FFF', btnGradient: ['#F39C12', '#E67E22'] },
  { id: 'sbta', nom: 'SBTA', image: require('../../assets/images/compagnies/sbta.png'), bgColor: '#2E7D32', textColor: '#FFF', btnGradient: ['#388E3C', '#1B5E20'] },
  { id: 'avs', nom: 'AVS', image: require('../../assets/images/compagnies/avs.jpg'), bgColor: '#FFD700', textColor: '#E30613', btnGradient: ['#E30613', '#9E040D'] },
];

const TRAJETS = [
  { id: 'sb-1', compagnie: 'sbta', depart: 'Adjamé', destination: 'Gagnoa', heureDepart: '06:00', heureArrivee: '10:00', prix: 3500, siegesDisponibles: 14 },
  { id: 'av-1', compagnie: 'avs', depart: 'Bouaké', destination: 'Abidjan', heureDepart: '09:00', heureArrivee: '14:00', prix: 6000, siegesDisponibles: 25 },
  { id: 'ut-1', compagnie: 'utb', depart: 'Gesco', destination: 'Yamoussoukro', heureDepart: '06:15', heureArrivee: '09:00', prix: 5000, siegesDisponibles: 18 },
  { id: 'ut-2', compagnie: 'utb', depart: 'Gesco', destination: 'Man', heureDepart: '07:15', heureArrivee: '15:30', prix: 12000, siegesDisponibles: 10 },
];

const MOYENS_PAIEMENT = [
  { id: 'wave', image: require('../../assets/images/compagnies/wave.png') },
  { id: 'orange', image: require('../../assets/images/compagnies/orange.png') },
  { id: 'mtn', image: require('../../assets/images/compagnies/mtn.png') },
  { id: 'moov', image: require('../../assets/images/compagnies/moov.png') },
];

export default function TicketsUltraPremium() {
  const [selectedCompagnie, setSelectedCompagnie] = useState(null);
  const [selectedTrajet, setSelectedTrajet] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // États du formulaire
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [nbPlaces, setNbPlaces] = useState(1);
  const [typeBillet, setTypeBillet] = useState('Simple'); // 'Simple' ou 'Retour'
  const [selectedMethod, setSelectedMethod] = useState('wave');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const calculerTotal = () => {
    if (!selectedTrajet) return 0;
    const multiplicateur = typeBillet === 'Retour' ? 1.8 : 1; // Petite réduction sur l'aller-retour
    return Math.round(selectedTrajet.prix * nbPlaces * multiplicateur);
  };

  const handleValidation = () => {
    if (!nom || !telephone) {
      Alert.alert("Erreur", "Veuillez remplir toutes les informations du passager.");
      return;
    }
    Alert.alert("Succès", `Réservation de ${nbPlaces} place(s) confirmée pour ${nom}. Redirection vers le paiement...`);
    setModalVisible(false);
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerContainer}>
          <Text style={styles.mainTitle}>Gares & Trajets</Text>
          <Text style={styles.subTitle}>Réservez votre ticket (2026)</Text>
        </View>

        {/* --- SECTION COMPAGNIES --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compagnies d'élite</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            <TouchableOpacity onPress={() => setSelectedCompagnie(null)} style={[styles.compCard, !selectedCompagnie && { borderColor: '#FFF', borderWidth: 2 }]}>
              <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.allButtonGradient}>
                <Ionicons name="grid" size={24} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
            {COMPAGNIES.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => setSelectedCompagnie(c.id)} style={[styles.compCard, selectedCompagnie === c.id && { borderColor: c.bgColor, borderWidth: 2.5 }]}>
                 <Image source={c.image} style={styles.logoImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* --- LISTE DES TRAJETS --- */}
        <View style={styles.contentBody}>
          <Text style={styles.sectionTitle}>Départs programmés</Text>
          <Animated.View style={{ opacity: fadeAnim }}>
            {TRAJETS.filter(t => !selectedCompagnie || t.compagnie === selectedCompagnie).map((trajet) => {
                const comp = COMPAGNIES.find(c => c.id === trajet.compagnie) || COMPAGNIES[0];
                return (
                <View key={trajet.id} style={[styles.ultraCard, { backgroundColor: comp.bgColor }]}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.brandName, { color: comp.textColor }]}>{comp.nom}</Text>
                      <View style={styles.seatBadge}><Text style={[styles.seatText, { color: comp.textColor }]}>{trajet.siegesDisponibles} PLACES</Text></View>
                    </View>
                    <View style={styles.routeBox}>
                      <Text style={[styles.timeBig, { color: comp.textColor }]}>{trajet.heureDepart} → {trajet.heureArrivee}</Text>
                      <Text style={[styles.cityText, { color: comp.textColor }]}>{trajet.depart} - {trajet.destination}</Text>
                    </View>
                    <View style={[styles.cardFooter, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                      <Text style={[styles.priceBig, { color: comp.textColor }]}>{trajet.prix.toLocaleString()} FCFA</Text>
                      <TouchableOpacity style={styles.mainBtn} onPress={() => { setSelectedTrajet(trajet); setModalVisible(true); }}>
                          <LinearGradient colors={comp.btnGradient} style={styles.btnGrad}><Text style={styles.btnText}>RÉSERVER</Text></LinearGradient>
                      </TouchableOpacity>
                    </View>
                </View>
                );
            })}
          </Animated.View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* --- MODALE DE RÉSERVATION COMPLÈTE --- */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Détails de réservation</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close-circle" size={32} color="#888" /></TouchableOpacity>
                    </View>

                    {/* Résumé rapide */}
                    {selectedTrajet && (
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryRoute}>{selectedTrajet.depart} ➔ {selectedTrajet.destination}</Text>
                            <Text style={styles.summaryInfo}>{selectedTrajet.heureDepart} | Gare de départ : {selectedTrajet.depart}</Text>
                        </View>
                    )}

                    {/* Formulaire */}
                    <Text style={styles.inputLabel}>Nom complet du passager</Text>
                    <TextInput style={styles.input} placeholder="Ex: Jean Marc" value={nom} onChangeText={setNom} />

                    <Text style={styles.inputLabel}>Numéro de téléphone</Text>
                    <TextInput style={styles.input} placeholder="07 00 00 00 00" keyboardType="phone-pad" value={telephone} onChangeText={setTelephone} />

                    <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.inputLabel}>Places</Text>
                            <View style={styles.counterRow}>
                                <TouchableOpacity onPress={() => setNbPlaces(Math.max(1, nbPlaces - 1))} style={styles.counterBtn}><Ionicons name="remove" size={20} color="#1A1A2E" /></TouchableOpacity>
                                <Text style={styles.counterText}>{nbPlaces}</Text>
                                <TouchableOpacity onPress={() => setNbPlaces(nbPlaces + 1)} style={styles.counterBtn}><Ionicons name="add" size={20} color="#1A1A2E" /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Type</Text>
                            <View style={styles.typeRow}>
                                <TouchableOpacity onPress={() => setTypeBillet('Simple')} style={[styles.typeBtn, typeBillet === 'Simple' && styles.typeBtnActive]}><Text style={[styles.typeBtnText, typeBillet === 'Simple' && {color: '#FFF'}]}>Simple</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setTypeBillet('Retour')} style={[styles.typeBtn, typeBillet === 'Retour' && styles.typeBtnActive]}><Text style={[styles.typeBtnText, typeBillet === 'Retour' && {color: '#FFF'}]}>A / R</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.inputLabel}>Moyen de paiement</Text>
                    <View style={styles.paymentRow}>
                        {MOYENS_PAIEMENT.map((methode) => (
                            <TouchableOpacity key={methode.id} onPress={() => setSelectedMethod(methode.id)} style={[styles.payBtn, selectedMethod === methode.id && styles.payBtnActive]}>
                                <Image source={methode.image} style={styles.payIcon}/>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                        <Text style={styles.totalAmount}>{calculerTotal().toLocaleString()} FCFA</Text>
                    </View>

                    <TouchableOpacity style={styles.confirmBtn} onPress={handleValidation}>
                        <Text style={styles.confirmText}>CONFIRMER & PAYER</Text>
                    </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#0A0A15' },
  headerContainer: { paddingTop: 60, paddingHorizontal: 25 },
  mainTitle: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  subTitle: { color: '#666', fontSize: 14 },
  section: { marginTop: 25 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginLeft: 25, marginBottom: 15 },
  horizontalScroll: { paddingLeft: 25 },
  compCard: { width: 70, height: 70, backgroundColor: '#FFF', borderRadius: 20, marginRight: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  allButtonGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 50, height: 50, resizeMode: 'contain' },
  contentBody: { paddingHorizontal: 20, marginTop: 20 },
  ultraCard: { borderRadius: 25, padding: 22, marginBottom: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandName: { fontSize: 20, fontWeight: '900' },
  seatBadge: { backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  seatText: { fontSize: 10, fontWeight: 'bold' },
  routeBox: { marginVertical: 20 },
  timeBig: { fontSize: 26, fontWeight: '900' },
  cityText: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1.5 },
  priceBig: { fontSize: 22, fontWeight: '900' },
  mainBtn: { width: '45%' },
  btnGrad: { paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '900' },

  // --- MODALE ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, height: height * 0.85 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A2E' },
  summaryCard: { backgroundColor: '#F0F2F5', padding: 15, borderRadius: 20, marginBottom: 20 },
  summaryRoute: { fontSize: 18, fontWeight: 'bold', color: '#1A1A2E' },
  summaryInfo: { fontSize: 12, color: '#666', marginTop: 4 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F0F2F5', borderRadius: 15, padding: 15, fontSize: 16, color: '#1A1A2E' },
  formRow: { flexDirection: 'row', marginTop: 10 },
  counterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 15, padding: 5, justifyContent: 'space-between' },
  counterBtn: { width: 35, height: 35, backgroundColor: '#FFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  counterText: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  typeRow: { flexDirection: 'row', backgroundColor: '#F0F2F5', borderRadius: 15, padding: 5 },
  typeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  typeBtnActive: { backgroundColor: '#1A1A2E' },
  typeBtnText: { fontWeight: '700', color: '#666' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  payBtn: { width: '30%', height: 70, backgroundColor: '#FFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#EEE' },
  payBtnActive: { borderColor: '#E67E22', backgroundColor: '#FFF9F5' },
  payIcon: { width: 45, height: 45, resizeMode: 'contain' },
  totalContainer: { marginTop: 25, alignItems: 'center', backgroundColor: '#1A1A2E', padding: 20, borderRadius: 20 },
  totalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold' },
  totalAmount: { color: '#FFD700', fontSize: 28, fontWeight: '900', marginTop: 5 },
  confirmBtn: { backgroundColor: '#E30613', paddingVertical: 20, borderRadius: 20, alignItems: 'center', marginTop: 20 },
  confirmText: { color: '#FFF', fontWeight: '900', fontSize: 16 }
});