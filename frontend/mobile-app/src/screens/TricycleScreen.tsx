import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// --- CONFIGURATION ---
const CLIENT_LOCATION = { latitude: 5.3650, longitude: -4.0000 };
const ROUTE_COORDINATES = [
  { latitude: 5.3620, longitude: -4.0050 }, // Départ du tricycle
  { latitude: 5.3630, longitude: -4.0040 },
  { latitude: 5.3640, longitude: -4.0020 },
  CLIENT_LOCATION, // Point de rendez-vous
];

// --- ASSETS ---
const TRICYCLE_ICON = require('../../assets/images/map/tricycle-icon.png'); 

const OPERATEURS = [
  { id: 'orange', nom: 'Orange', logo: require('../../assets/images/payment/orange.png') },
  { id: 'mtn', nom: 'MTN', logo: require('../../assets/images/payment/mtn.png') },
  { id: 'moov', nom: 'Moov', logo: require('../../assets/images/payment/moov.png') },
  { id: 'wave', nom: 'Wave', logo: require('../../assets/images/payment/wave.png') },
];

const SERVICES = [
  { id: 'course', nom: 'Passager', icon: 'account-group' },
  { id: 'colis', nom: 'Colis', icon: 'package-variant-closed' },
];

const TAILLES_COLIS = [
  { id: 'petit', nom: 'Petit' },
  { id: 'moyen', nom: 'Moyen' },
  { id: 'grand', nom: 'Grand' },
];

export default function TricycleScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  
  // États de l'interface
  const [orderState, setOrderState] = useState<'saisie' | 'recherche' | 'accepte'>('saisie');
  const [activeService, setActiveService] = useState('course');
  const [tailleColis, setTailleColis] = useState('petit');
  const [payMode, setPayMode] = useState('cash'); 
  const [operateur, setOperateur] = useState('orange'); 
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [prixEstime, setPrixEstime] = useState(200);
  
  // États de l'itinéraire
  const [currentStep, setCurrentStep] = useState(0);
  const [tricycleLocation, setTricycleLocation] = useState(ROUTE_COORDINATES[0]);

  // Calcul du prix
  useEffect(() => {
    let basePrix = 200;
    if (activeService === 'colis') {
      if (tailleColis === 'petit') basePrix = 500;
      if (tailleColis === 'moyen') basePrix = 1500;
      if (tailleColis === 'grand') basePrix = 3000;
    }
    setPrixEstime(basePrix);
  }, [activeService, tailleColis]);

  // Logique de mouvement
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (orderState === 'accepte' && currentStep < ROUTE_COORDINATES.length - 1) {
      timer = setTimeout(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        setTricycleLocation(ROUTE_COORDINATES[nextStep]);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [orderState, currentStep]);

  const handleOrder = () => {
    if (!pickup || !destination) {
      Alert.alert("Champs requis", "Veuillez indiquer le trajet complet.");
      return;
    }
    setOrderState('recherche');
    setTimeout(() => {
      setOrderState('accepte');
      mapRef.current?.fitToCoordinates(ROUTE_COORDINATES, {
        edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
        animated: true,
      });
    }, 3000);
  };

  const handleCancel = () => {
    Alert.alert("Annulation", "Voulez-vous annuler cette course ?", [
      { text: "Non" },
      { 
        text: "Oui", 
        style: "destructive", 
        onPress: () => {
          setOrderState('saisie');
          setCurrentStep(0);
          setTricycleLocation(ROUTE_COORDINATES[0]);
          mapRef.current?.animateToRegion({
            latitude: CLIENT_LOCATION.latitude,
            longitude: CLIENT_LOCATION.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
        }
      }
    ]);
  };

  const selectedOpData = OPERATEURS.find(op => op.id === operateur);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: CLIENT_LOCATION.latitude, longitude: CLIENT_LOCATION.longitude,
          latitudeDelta: 0.04, longitudeDelta: 0.04,
        }}
      >
        {orderState === 'accepte' && (
          <>
            <Polyline coordinates={ROUTE_COORDINATES} strokeColor="#FF6B35" strokeWidth={4} lineDashPattern={[5, 5]} />
            <Marker coordinate={CLIENT_LOCATION} title="Moi"><View style={styles.clientMarker} /></Marker>
            <Marker coordinate={tricycleLocation} anchor={{ x: 0.5, y: 0.5 }} flat={true}>
              <Image source={TRICYCLE_ICON} style={styles.mapTricycleIcon} resizeMode="contain" />
            </Marker>
          </>
        )}
      </MapView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomContainer}>
        {orderState === 'saisie' && (
          <View style={styles.floatingCard}>
            <View style={styles.serviceTabs}>
              {SERVICES.map((srv) => (
                <TouchableOpacity key={srv.id} onPress={() => setActiveService(srv.id)} style={[styles.tabBtn, activeService === srv.id && styles.tabBtnActive]}>
                  <MaterialCommunityIcons name={srv.icon as any} size={18} color={activeService === srv.id ? '#FF6B35' : '#A0AEC0'} />
                  <Text style={[styles.tabText, activeService === srv.id && styles.tabTextActive]}>{srv.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeService === 'colis' && (
              <View style={styles.colisContainer}>
                <View style={styles.colisRow}>
                  {TAILLES_COLIS.map((t) => (
                    <TouchableOpacity key={t.id} onPress={() => setTailleColis(t.id)} style={[styles.colisBtn, tailleColis === t.id && styles.colisBtnActive]}>
                      <Text style={[styles.colisName, tailleColis === t.id && styles.colisNameActive]}>{t.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.inputsWrapper}>
              <View style={styles.routeIconsColumn}><Ionicons name="radio-button-on" size={18} color="#1A1A1A" /><View style={styles.routeVerticalLine} /><Ionicons name="location" size={20} color="#FF6B35" /></View>
              <View style={styles.inputsColumn}>
                <TextInput style={styles.input} placeholder="Lieu de départ" value={pickup} onChangeText={setPickup} />
                <View style={styles.divider} />
                <TextInput style={styles.input} placeholder="Destination" value={destination} onChangeText={setDestination} />
              </View>
            </View>

            <View style={styles.paymentContainer}>
              <Text style={styles.sectionTitle}>Paiement</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity onPress={() => setPayMode('cash')} style={[styles.payBtn, payMode === 'cash' && styles.payBtnActive]}>
                  <MaterialIcons name="payments" size={20} color={payMode === 'cash' ? '#48BB78' : '#A0AEC0'} />
                  <Text style={[styles.payText, payMode === 'cash' && styles.payTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPayMode('momo')} style={[styles.payBtn, payMode === 'momo' && styles.payBtnActiveMoMo]}>
                  <MaterialIcons name="smartphone" size={20} color={payMode === 'momo' ? '#3182CE' : '#A0AEC0'} />
                  <Text style={[styles.payText, payMode === 'momo' && styles.payTextActiveMoMo]}>MoMo</Text>
                </TouchableOpacity>
              </View>

              {payMode === 'momo' && (
                <View style={styles.operateursRow}>
                  {OPERATEURS.map((op) => (
                    <TouchableOpacity key={op.id} onPress={() => setOperateur(op.id)} style={[styles.opBtn, operateur === op.id && styles.opBtnActive]}>
                      <Image source={op.logo} style={styles.opLogo} resizeMode="contain" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.mainCta} onPress={handleOrder}>
              <Text style={styles.mainCtaText}>Commander • {prixEstime.toLocaleString()} F</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {orderState === 'recherche' && (
          <View style={styles.floatingCard}>
            <View style={styles.searchHeader}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.searchTitle}>Recherche d'un tricycle...</Text>
            </View>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setOrderState('saisie')}>
                <Text style={styles.cancelLinkText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {orderState === 'accepte' && (
          <View style={styles.floatingCard}>
            <View style={styles.etaHeader}>
                <Text style={styles.etaText}>{currentStep === ROUTE_COORDINATES.length - 1 ? "CHAUFFEUR ARRIVÉ" : "TRICYCLE EN ROUTE"}</Text>
                <Text style={styles.timeText}>{currentStep === ROUTE_COORDINATES.length - 1 ? "0 min" : "4 min"}</Text>
            </View>
            <View style={styles.driverProfile}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=200' }} style={styles.avatar} />
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>Moussa Diabaté</Text>
                <View style={styles.payBadge}>
                   {payMode === 'momo' ? (
                     <>
                       <Image source={selectedOpData?.logo} style={styles.smallOpLogo} />
                       <Text style={styles.payStatusText}>{selectedOpData?.nom}</Text>
                     </>
                   ) : (
                     <Text style={[styles.payStatusText, { color: '#48BB78' }]}>Espèces</Text>
                   )}
                </View>
              </View>
              <TouchableOpacity style={styles.callCircle}><Ionicons name="call" size={20} color="#FFF" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Annuler la course</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  map: { ...StyleSheet.absoluteFillObject },
  
  mapTricycleIcon: { width: 45, height: 45 },

  // --- MISE À JOUR : ESPACE POUR LA BARRE D'ONGLETS ---
  bottomContainer: { 
    position: 'absolute', 
    bottom: Platform.OS === 'ios' ? 120 : 110, // Décalage pour laisser respirer la Tab Bar 7D
    width: '100%', 
    paddingHorizontal: 15 
  },
  
  floatingCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 25, 
    padding: 20, 
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },

  serviceTabs: { flexDirection: 'row', backgroundColor: '#F7FAFC', borderRadius: 15, padding: 4, marginBottom: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#FFF', elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#A0AEC0', marginLeft: 6 },
  tabTextActive: { color: '#1A1A1A' },
  inputsWrapper: { flexDirection: 'row', backgroundColor: '#F7FAFC', borderRadius: 15, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EDF2F7' },
  routeIconsColumn: { alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  routeVerticalLine: { height: 20, width: 1, backgroundColor: '#CBD5E0', marginVertical: 3 },
  inputsColumn: { flex: 1 },
  input: { height: 30, fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  divider: { height: 1, backgroundColor: '#EDF2F7', marginVertical: 4 },
  paymentContainer: { marginBottom: 15 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#718096', marginBottom: 8, textTransform: 'uppercase' },
  paymentRow: { flexDirection: 'row', marginBottom: 8 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F7FAFC', marginHorizontal: 3, borderWidth: 1, borderColor: '#EDF2F7' },
  payBtnActive: { backgroundColor: '#F0FFF4', borderColor: '#48BB78' },
  payBtnActiveMoMo: { backgroundColor: '#EBF8FF', borderColor: '#3182CE' },
  payText: { fontSize: 12, fontWeight: '700', color: '#A0AEC0', marginLeft: 6 },
  payTextActive: { color: '#48BB78' },
  payTextActiveMoMo: { color: '#3182CE' },
  operateursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 },
  opBtn: { width: 55, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#EDF2F7' },
  opBtnActive: { borderColor: '#1A1A1A', backgroundColor: '#FFF', elevation: 2 },
  opLogo: { width: 28, height: 28 },
  mainCta: { backgroundColor: '#FF6B35', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 15 },
  mainCtaText: { color: '#FFF', fontSize: 15, fontWeight: '800', marginRight: 8 },
  driverProfile: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: { width: 45, height: 45, borderRadius: 22 },
  driverDetails: { flex: 1, marginLeft: 12 },
  driverName: { fontSize: 15, fontWeight: '800' },
  payBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  smallOpLogo: { width: 14, height: 14, marginRight: 5, borderRadius: 2 },
  payStatusText: { fontSize: 11, fontWeight: '600', color: '#718096' },
  callCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#48BB78', justifyContent: 'center', alignItems: 'center' },
  colisContainer: { marginBottom: 10 },
  colisRow: { flexDirection: 'row' },
  colisBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#F7FAFC', marginRight: 5 },
  colisBtnActive: { backgroundColor: '#FFF5F0', borderWidth: 1, borderColor: '#FF6B35' },
  colisName: { fontSize: 11, fontWeight: '700', color: '#A0AEC0' },
  colisNameActive: { color: '#FF6B35' },
  clientMarker: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1A1A1A', borderWidth: 3, borderColor: '#FFF' },
  etaHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F7FAFC', paddingBottom: 10, marginBottom: 10 },
  etaText: { fontSize: 11, fontWeight: '800', color: '#718096' },
  timeText: { fontSize: 15, fontWeight: '900', color: '#FF6B35' },
  cancelBtn: { marginTop: 15, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12 },
  cancelBtnText: { color: '#E53E3E', fontWeight: '800', fontSize: 13 },
  searchHeader: { alignItems: 'center', paddingVertical: 20 },
  searchTitle: { fontSize: 16, fontWeight: '800', marginTop: 10, color: '#1A1A1A' },
  cancelLink: { alignItems: 'center', paddingVertical: 10 },
  cancelLinkText: { color: '#718096', fontWeight: '600' }
});