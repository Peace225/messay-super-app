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

// --- LE TRAJET DU TRICYCLE (Simulé) ---
const ROUTE_COORDINATES = [
  { latitude: 5.3620, longitude: -4.0050 }, // Position initiale du chauffeur
  { latitude: 5.3630, longitude: -4.0040 },
  { latitude: 5.3640, longitude: -4.0020 },
  { latitude: 5.3650, longitude: -4.0000 }, // Position du client (Pickup)
];

export default function TricycleTrackingScreen() {
  const router = useRouter();
  
  // Animations
  const [pulseAnim] = useState(new Animated.Value(1));
  const [currentStep, setCurrentStep] = useState(0);
  const [tricycleLocation, setTricycleLocation] = useState(ROUTE_COORDINATES[0]);

  // Animation de pulsation autour du tricycle
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // Déplacement simulé du tricycle sur la carte
  useEffect(() => {
    if (currentStep < ROUTE_COORDINATES.length - 1) {
      const timer = setTimeout(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        setTricycleLocation(ROUTE_COORDINATES[nextStep]);
      }, 3000); // Bouge toutes les 3 secondes
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const clientLocation = ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1];
  const isArrived = currentStep === ROUTE_COORDINATES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* --- CARTE GPS --- */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 5.3640,
          longitude: -4.0020,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        {/* Ligne du trajet */}
        <Polyline 
          coordinates={ROUTE_COORDINATES}
          strokeColor="#fbbf24" // Jaune MESSAY
          strokeWidth={4}
          lineDashPattern={[2, 4]}
        />

        {/* Marqueur Client (Pickup) */}
        <Marker coordinate={clientLocation}>
          <View style={styles.markerClient}>
            <Ionicons name="person" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Marqueur Tricycle (Animé) */}
        <Marker coordinate={tricycleLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.tricycleMarkerWrapper}>
            <Animated.View style={[styles.tricyclePulse, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.tricycleIconBox}>
              <FontAwesome5 name="motorcycle" size={16} color="#1e293b" />
            </View>
          </View>
        </Marker>
      </MapView>

      {/* --- BOUTON RETOUR --- */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color="#1e293b" />
      </TouchableOpacity>

      {/* --- PANNEAU INFÉRIEUR (BOTTOM SHEET) --- */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragIndicator} />
        
        {/* Statut & ETA */}
        <View style={styles.etaContainer}>
          <Text style={styles.etaTitle}>
            {isArrived ? "VOTRE CHAUFFEUR EST LÀ" : "ARRIVÉE DU CHAUFFEUR DANS"}
          </Text>
          <Text style={[styles.etaTime, isArrived && { color: '#10b981' }]}>
            {isArrived ? "À l'instant" : `${4 - currentStep} min`}
          </Text>
        </View>

        {/* Carte du Chauffeur */}
        <View style={styles.driverCard}>
          <View style={styles.driverPicWrapper}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400' }} style={styles.driverPic} />
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>4.8</Text>
              <Ionicons name="star" size={10} color="#fff" />
            </View>
          </View>
          
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>Kouassi Jean</Text>
            <Text style={styles.tricycleInfo}>Tricycle Piaggio • <Text style={styles.plate}>7890 AB 01</Text></Text>
          </View>
          
          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Sécurité et Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="shield-checkmark" size={20} color="#3b82f6" />
            <Text style={styles.actionText}>Sécurité</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-social" size={20} color="#1e293b" />
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>
        </View>

        {/* Bouton Annuler */}
        <TouchableOpacity style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Annuler la course</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: width, height: height * 0.65 },
  
  markerClient: { backgroundColor: '#1e293b', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 4 },
  tricycleMarkerWrapper: { justifyContent: 'center', alignItems: 'center' },
  tricyclePulse: { position: 'absolute', width: 45, height: 45, backgroundColor: 'rgba(251, 191, 36, 0.4)', borderRadius: 22.5 },
  tricycleIconBox: { backgroundColor: '#fbbf24', padding: 10, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 5 },

  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#fff', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },

  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, elevation: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 } },
  dragIndicator: { width: 45, height: 5, backgroundColor: '#e2e8f0', borderRadius: 5, alignSelf: 'center', marginBottom: 20 },
  
  etaContainer: { alignItems: 'center', marginBottom: 20 },
  etaTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1.5, marginBottom: 5 },
  etaTime: { fontSize: 26, fontWeight: '900', color: '#1e293b' },

  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  driverPicWrapper: { position: 'relative', marginRight: 15 },
  driverPic: { width: 55, height: 55, borderRadius: 27.5 },
  ratingBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  ratingText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginRight: 2 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 17, fontWeight: '900', color: '#1e293b' },
  tricycleInfo: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' },
  plate: { fontWeight: '800', color: '#1e293b' },
  callBtn: { backgroundColor: '#10b981', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 3 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 15, marginHorizontal: 5 },
  actionText: { marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#1e293b' },

  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '700' }
});