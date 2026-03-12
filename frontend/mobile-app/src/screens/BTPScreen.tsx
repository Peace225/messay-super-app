import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// --- DONNÉES DU TERRAIN ---
const MATERIAUX = [
  { id: 'sable', nom: 'Sable', image: require('../../assets/images/btp/sable.jpg'), unite: 'm³', prixUnitaire: 15000, options: ['Sable Fin', 'Gros Sable'] },
  { id: 'gravier', nom: 'Gravier', image: require('../../assets/images/btp/gravier.jpg'), unite: 'm³', prixUnitaire: 18000, options: ['Petit Gravier', 'Gros Gravier'] },
  { id: 'fer', nom: 'Fer à béton', image: require('../../assets/images/btp/fer.jpg'), unite: 'tonne', prixUnitaire: 450000, options: ['Fer 8', 'Fer 10', 'Fer 12'] },
  { id: 'ciment', nom: 'Ciment', image: require('../../assets/images/btp/ciment.jpg'), unite: 'sac', prixUnitaire: 5500, options: ['CPJ 32.5', 'CPJ 42.5'] },
];

const LOCATIONS = [
  { id: 'benne', nom: 'Camion Benne', image: require('../../assets/images/btp/benne.jpg'), capacite: '20 Tonnes', prixJour: 150000 },
  { id: 'plateau', nom: 'Camion Plateau', image: require('../../assets/images/btp/plateau.jpg'), capacite: '10 Tonnes', prixJour: 120000 },
];

export default function BTPScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [typeSpecifique, setTypeSpecifique] = useState('');
  const [quantite, setQuantite] = useState('');
  const [adresse, setAdresse] = useState('');
  const [loading, setLoading] = useState(false);

  const openOrderModal = (item: any) => {
    setSelectedItem(item);
    setTypeSpecifique(item.options ? item.options[0] : '');
    setModalVisible(true);
  };

  const handleValidation = () => {
    if (!adresse || !quantite) {
      Alert.alert("Champs manquants", "Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setModalVisible(false);
      router.push('/btp-tracking'); 
    }, 1500);
  };

  const totalPrix = selectedItem ? (selectedItem.prixUnitaire || selectedItem.prixJour) * parseFloat(quantite || '0') : 0;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER PREMIUM */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerPremium}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.brandText}>LACARRIÈRE 🏗️</Text>
            <Text style={styles.headerTitle}>Matériaux & Engins</Text>
          </View>
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/btp-historique' as any)}>
            <Ionicons name="receipt-outline" size={24} color="#fbbf24" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
        
        {/* SECTION MATERIAUX */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catalogue Matériaux</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {MATERIAUX.map((m) => (
              <TouchableOpacity key={m.id} style={styles.materialCard} onPress={() => openOrderModal(m)}>
                <Image source={m.image} style={styles.matImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.matOverlay}>
                  <Text style={styles.matName}>{m.nom}</Text>
                  <View style={styles.matPriceBadge}>
                    <Text style={styles.matPriceText}>{m.prixUnitaire.toLocaleString()} F</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* SECTION LOCATION AVEC DESIGN DE FOND CAPSULE */}
        <View style={styles.locationContainer}>
          <LinearGradient colors={['#f1f5f9', '#e2e8f0']} style={styles.locationWrapper}>
            <View style={styles.locationHeaderInside}>
              <Text style={styles.locationTitleInside}>Location d'Engins</Text>
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fbbf24" />
                <Text style={styles.secureBadgeText}>Garanti</Text>
              </View>
            </View>

            {LOCATIONS.map((l) => (
              <TouchableOpacity key={l.id} style={styles.enginCard} onPress={() => openOrderModal(l)}>
                <Image source={l.image} style={styles.enginImage} />
                <View style={styles.enginInfo}>
                  <Text style={styles.enginName}>{l.nom}</Text>
                  <Text style={styles.enginCap}>Capacité: {l.capacite}</Text>
                  <Text style={styles.enginPrice}>{l.prixJour.toLocaleString()} F <Text style={styles.dayLabel}>/ Jour</Text></Text>
                </View>
                <View style={styles.addBtn}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </LinearGradient>
        </View>

      </ScrollView>

      {/* MODAL DE COMMANDE */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            {selectedItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalMainTitle}>Détails de commande</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close-circle" size={32} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                {/* OPTIONS DE TYPE */}
                {selectedItem.options && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Type de {selectedItem.nom}</Text>
                    <View style={styles.optionsWrapper}>
                      {selectedItem.options.map((opt: string) => (
                        <TouchableOpacity 
                          key={opt} 
                          onPress={() => setTypeSpecifique(opt)}
                          style={[styles.optChip, typeSpecifique === opt && styles.optChipActive]}
                        >
                          <Text style={[styles.optChipText, typeSpecifique === opt && {color: '#fff'}]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Quantité ({selectedItem.unite || 'Jours'})</Text>
                  <TextInput style={styles.premiumInput} placeholder="Entrez la quantité" keyboardType="numeric" value={quantite} onChangeText={setQuantite} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Lieu de livraison</Text>
                  <TextInput style={[styles.premiumInput, {height: 80, textAlignVertical: 'top'}]} placeholder="Adresse du chantier..." multiline value={adresse} onChangeText={setAdresse} />
                </View>

                <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.totalCard}>
                   <View>
                      <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                      <Text style={styles.totalAmount}>{totalPrix.toLocaleString()} FCFA</Text>
                   </View>
                   <TouchableOpacity style={styles.confirmButton} onPress={handleValidation}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>VALIDER</Text>}
                   </TouchableOpacity>
                </LinearGradient>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#fcfcfc' },
  headerPremium: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandText: { color: '#fbbf24', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  historyBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 15 },
  
  section: { marginTop: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginLeft: 25, marginBottom: 15 },
  horizontalScroll: { paddingLeft: 25, paddingRight: 10 },

  // Matériaux
  materialCard: { width: 160, height: 210, borderRadius: 25, marginRight: 15, overflow: 'hidden', elevation: 5 },
  matImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  matOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 15 },
  matName: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 5 },
  matPriceBadge: { backgroundColor: '#FF6B35', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  matPriceText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  // Location avec Fond
  locationContainer: { marginHorizontal: 20, marginTop: 30 },
  locationWrapper: { borderRadius: 35, padding: 20, elevation: 3 },
  locationHeaderInside: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  locationTitleInside: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  secureBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', marginLeft: 4, textTransform: 'uppercase' },
  enginCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 22, padding: 12, alignItems: 'center', marginBottom: 12, elevation: 2 },
  enginImage: { width: 70, height: 70, borderRadius: 15 },
  enginInfo: { flex: 1, marginLeft: 15 },
  enginName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  enginCap: { fontSize: 11, color: '#64748b', marginVertical: 2 },
  enginPrice: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  dayLabel: { fontSize: 10, fontWeight: '400', color: '#94a3b8' },
  addBtn: { backgroundColor: '#FF6B35', width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, maxHeight: height * 0.85 },
  modalIndicator: { width: 40, height: 5, backgroundColor: '#e2e8f0', borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalMainTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  optionsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, backgroundColor: '#f1f5f9' },
  optChipActive: { backgroundColor: '#0f172a' },
  optChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  premiumInput: { backgroundColor: '#f8fafc', borderRadius: 15, padding: 15, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#e2e8f0' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 25, marginTop: 10 },
  totalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900' },
  totalAmount: { color: '#fbbf24', fontSize: 20, fontWeight: '900' },
  confirmButton: { backgroundColor: '#FF6B35', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },
  confirmText: { color: '#fff', fontWeight: '900', fontSize: 14 }
});