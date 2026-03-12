import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// --- LE TRAJET DU CAMION (D'Adjamé vers Cocody) ---
const ROUTE_COORDINATES = [
  { latitude: 5.3851, longitude: -4.0152 }, // Départ (Carrière Adjamé)
  { latitude: 5.3780, longitude: -4.0120 }, // En route...
  { latitude: 5.3700, longitude: -4.0080 }, // En route...
  { latitude: 5.3620, longitude: -4.0000 }, // Pont / Échangeur
  { latitude: 5.3520, longitude: -3.9920 }, // Arrivée proche...
  { latitude: 5.3453, longitude: -3.9881 }, // Destination (Chantier Cocody)
];

export default function BtpTrackingScreen() {
  const router = useRouter();
  
  // Animation du point jaune
  const [pulseAnim] = useState(new Animated.Value(1));
  
  // État pour la position en temps réel du camion
  const [currentStep, setCurrentStep] = useState(0);
  const [truckLocation, setTruckLocation] = useState(ROUTE_COORDINATES[0]);

  // 1. Animation de pulsation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // 2. Simulation du déplacement GPS du camion
  useEffect(() => {
    if (currentStep < ROUTE_COORDINATES.length - 1) {
      const timer = setTimeout(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        setTruckLocation(ROUTE_COORDINATES[nextStep]);
      }, 3000); // Le camion avance toutes les 3 secondes
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const origin = ROUTE_COORDINATES[0];
  const destination = ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* --- CARTE GPS --- */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 5.3650, // Centre de la carte (Abidjan)
          longitude: -4.0000,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {/* Le tracé complet de la route */}
        <Polyline 
          coordinates={ROUTE_COORDINATES}
          strokeColor="#1e293b" 
          strokeWidth={4}
          lineDashPattern={[2, 4]}
        />

        {/* Le tracé déjà parcouru (en vert pour montrer l'avancement) */}
        <Polyline 
          coordinates={ROUTE_COORDINATES.slice(0, currentStep + 1)}
          strokeColor="#10b981" 
          strokeWidth={5}
        />

        <Marker coordinate={origin}>
          <View style={styles.markerOrigin}><FontAwesome5 name="store" size={14} color="#fff" /></View>
        </Marker>

        <Marker coordinate={destination}>
          <View style={styles.markerDestination}><Ionicons name="flag" size={16} color="#fff" /></View>
        </Marker>

        {/* LE CAMION QUI SE DÉPLACE */}
        <Marker coordinate={truckLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.truckMarkerWrapper}>
            <Animated.View style={[styles.truckPulse, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.truckIconBox}>
              <FontAwesome5 name="truck-loading" size={14} color="#fff" />
            </View>
          </View>
        </Marker>
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#1e293b" />
      </TouchableOpacity>

      {/* --- PANNEAU INFÉRIEUR --- */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragIndicator} />
        
        <View style={styles.etaHeader}>
          <View>
            <Text style={styles.etaTitle}>Arrivée estimée</Text>
            {/* Le temps diminue dynamiquement en fonction de l'avancée */}
            <Text style={styles.etaTime}>
              {currentStep === ROUTE_COORDINATES.length - 1 ? "Arrivé !" : `${15 - (currentStep * 3)} min`}
            </Text>
          </View>
          <View style={[styles.statusBadge, currentStep === ROUTE_COORDINATES.length - 1 && { backgroundColor: '#10b981' }]}>
            <Text style={[styles.statusText, currentStep === ROUTE_COORDINATES.length - 1 && { color: '#fff' }]}>
              {currentStep === ROUTE_COORDINATES.length - 1 ? "LIVRAISON TERMINÉE" : "EN ROUTE"}
            </Text>
          </View>
        </View>

        <View style={styles.driverCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400' }} style={styles.driverPic} />
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>Moussa Diabaté</Text>
            <Text style={styles.driverTruck}>Camion Benne 20T • 1145 AB 01</Text>
          </View>
          <TouchableOpacity style={styles.callBtn}><Ionicons name="call" size={20} color="#fff" /></TouchableOpacity>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineStep}>
            <View style={styles.timelineIconWrapper}>
              <View style={[styles.timelineDot, styles.timelineDotActive]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
              <View style={[styles.timelineLine, styles.timelineLineActive]} />
            </View>
            <View style={styles.timelineTextWrapper}>
              <Text style={styles.stepTitle}>Commande chargée</Text>
              <Text style={styles.stepSub}>Carrière validée</Text>
            </View>
          </View>

          <View style={styles.timelineStep}>
            <View style={styles.timelineIconWrapper}>
              <View style={[styles.timelineDot, currentStep > 0 ? styles.timelineDotActive : styles.timelineDotCurrent]}>
                {currentStep > 0 ? <Ionicons name="checkmark" size={12} color="#fff" /> : <View style={styles.innerDot} />}
              </View>
              <View style={[styles.timelineLine, currentStep === ROUTE_COORDINATES.length - 1 && styles.timelineLineActive]} />
            </View>
            <View style={styles.timelineTextWrapper}>
              <Text style={currentStep > 0 ? styles.stepTitle : styles.stepTitleCurrent}>En cours de livraison</Text>
              <Text style={styles.stepSub}>Moussa est en chemin</Text>
            </View>
          </View>

          <View style={styles.timelineStep}>
            <View style={styles.timelineIconWrapper}>
              <View style={currentStep === ROUTE_COORDINATES.length - 1 ? [styles.timelineDot, styles.timelineDotActive] : styles.timelineDotInactive}>
                {currentStep === ROUTE_COORDINATES.length - 1 && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </View>
            <View style={styles.timelineTextWrapper}>
              <Text style={currentStep === ROUTE_COORDINATES.length - 1 ? styles.stepTitle : styles.stepTitleInactive}>Livraison sur le chantier</Text>
              <Text style={styles.stepSub}>
                {currentStep === ROUTE_COORDINATES.length - 1 ? "Le camion est arrivé" : "En attente d'arrivée"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ... Les styles restent exactement les mêmes que dans le code précédent ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: width, height: height * 0.55 },
  
  markerOrigin: { backgroundColor: '#1e293b', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 4 },
  markerDestination: { backgroundColor: '#ef4444', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 4 },
  
  truckMarkerWrapper: { justifyContent: 'center', alignItems: 'center' },
  truckPulse: { position: 'absolute', width: 45, height: 45, backgroundColor: 'rgba(251, 191, 36, 0.4)', borderRadius: 22.5 },
  truckIconBox: { backgroundColor: '#fbbf24', padding: 10, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 5 },

  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#fff', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } },

  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, elevation: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 } },
  dragIndicator: { width: 45, height: 5, backgroundColor: '#e2e8f0', borderRadius: 5, alignSelf: 'center', marginBottom: 25 },
  
  etaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  etaTitle: { fontSize: 13, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  etaTime: { fontSize: 28, fontWeight: '900', color: '#1e293b', marginTop: 2 },
  etaDistance: { fontSize: 16, color: '#94a3b8', fontWeight: '700' },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  statusText: { color: '#166534', fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 15, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0' },
  driverPic: { width: 55, height: 55, borderRadius: 27.5, marginRight: 15 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  driverTruck: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#475569', marginLeft: 4 },
  callBtn: { backgroundColor: '#10b981', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 3 },

  timeline: { paddingLeft: 10, marginBottom: 20 },
  timelineStep: { flexDirection: 'row', marginBottom: 20 },
  timelineIconWrapper: { alignItems: 'center', marginRight: 15 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  timelineDotActive: { backgroundColor: '#10b981' }, 
  timelineDotCurrent: { backgroundColor: '#fbbf24', borderWidth: 4, borderColor: '#fef3c7' }, 
  timelineDotInactive: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#cbd5e1', zIndex: 2, marginTop: 4 }, 
  innerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timelineLine: { width: 2, height: 40, backgroundColor: '#e2e8f0', position: 'absolute', top: 20 },
  timelineLineActive: { backgroundColor: '#10b981' },
  
  timelineTextWrapper: { flex: 1, paddingTop: 2 },
  stepTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  stepTitleCurrent: { fontSize: 15, fontWeight: '900', color: '#d97706' },
  stepTitleInactive: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  stepSub: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },

  supportBtn: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  supportBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 }
});