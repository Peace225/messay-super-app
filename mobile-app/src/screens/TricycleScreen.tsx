import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';
import { courseService } from '../services/courseService';
import { useAuthStore } from '../store/authStore';
import {
  RESTRICTED_ZONES,
  isPointInRestrictedZone,
  doesRouteIntersectRestrictedZone,
} from '../config/restrictedZones';

// Coordonnées du centre de la Côte d'Ivoire (Yamoussoukro)
const COTE_IVOIRE_CENTER = {
  latitude: 6.8270,
  longitude: -5.2893,
};

// Rayon approximatif pour couvrir toute la Côte d'Ivoire (environ 400km)
const COTE_IVOIRE_RADIUS = 400000; // 400km de rayon

export default function TricycleScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [location, setLocation] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [departAdresse, setDepartAdresse] = useState('');
  const [destinationAdresse, setDestinationAdresse] = useState('');
  const [loading, setLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [showRestrictedZoneModal, setShowRestrictedZoneModal] = useState(false);
  const [restrictedZoneMessage, setRestrictedZoneMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisation de localisation requise');
        // Utiliser la position par défaut (centre de la Côte d'Ivoire)
        setLocation({
          latitude: COTE_IVOIRE_CENTER.latitude,
          longitude: COTE_IVOIRE_CENTER.longitude,
          latitudeDelta: 3.0,
          longitudeDelta: 3.0,
        });
        setDepartAdresse('Côte d\'Ivoire');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const userLat = currentLocation.coords.latitude;
      const userLon = currentLocation.coords.longitude;

      // Vérifier si l'utilisateur est en Côte d'Ivoire
      const distance = getDistance(
        userLat,
        userLon,
        COTE_IVOIRE_CENTER.latitude,
        COTE_IVOIRE_CENTER.longitude
      );

      if (distance > COTE_IVOIRE_RADIUS) {
        Alert.alert(
          'Zone non couverte',
          'Vous êtes en dehors de la Côte d\'Ivoire. La carte sera centrée sur le pays.',
          [{ text: 'OK' }]
        );
        setLocation({
          latitude: COTE_IVOIRE_CENTER.latitude,
          longitude: COTE_IVOIRE_CENTER.longitude,
          latitudeDelta: 3.0,
          longitudeDelta: 3.0,
        });
        setDepartAdresse('Côte d\'Ivoire');
      } else {
        setLocation({
          latitude: userLat,
          longitude: userLon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        setDepartAdresse('Position actuelle');

        // Vérifier si la position actuelle est en zone interdite
        const restrictionCheck = isPointInRestrictedZone(userLat, userLon);
        if (restrictionCheck.isRestricted && restrictionCheck.zone) {
          Alert.alert(
            '⚠️ Zone Interdite',
            `Vous êtes actuellement sur ${restrictionCheck.zone.nom}, une zone interdite aux tricycles.\n\n${restrictionCheck.zone.description}\n\nVous ne pouvez pas commander de tricycle depuis cette position.`,
            [{ text: 'Compris' }]
          );
        }
      }

      // Charger les conducteurs à proximité
      loadNearbyDrivers(userLat, userLon);
    })();
  }, []);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  };

  const loadNearbyDrivers = async (lat: number, lon: number) => {
    try {
      const response = await courseService.findNearbyDrivers(lat, lon);
      setNearbyDrivers(response.drivers || []);
    } catch (error) {
      console.error('Erreur chargement conducteurs:', error);
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    
    // Vérifier si la destination est en Côte d'Ivoire
    const distance = getDistance(
      coordinate.latitude,
      coordinate.longitude,
      COTE_IVOIRE_CENTER.latitude,
      COTE_IVOIRE_CENTER.longitude
    );

    if (distance > COTE_IVOIRE_RADIUS) {
      Alert.alert(
        'Zone non couverte',
        'Veuillez sélectionner une destination en Côte d\'Ivoire.'
      );
      return;
    }

    // Vérifier si la destination est en zone interdite
    const restrictionCheck = isPointInRestrictedZone(
      coordinate.latitude,
      coordinate.longitude
    );

    if (restrictionCheck.isRestricted && restrictionCheck.zone) {
      setRestrictedZoneMessage(
        `⚠️ ZONE INTERDITE AUX TRICYCLES\n\n${restrictionCheck.zone.nom}\n\n${restrictionCheck.zone.description}\n\nSelon l'arrêté du Ministre-Gouverneur du District d'Abidjan, la circulation des tricycles est formellement interdite sur cette voie.\n\nVeuillez choisir une autre destination.`
      );
      setShowRestrictedZoneModal(true);
      return;
    }

    setDestination(coordinate);
    setDestinationAdresse('Destination sélectionnée sur la carte');
  };

  const handleRequestCourse = async () => {
    if (!location) {
      Alert.alert('Erreur', 'Position de départ non disponible');
      return;
    }

    if (!destination && !destinationAdresse.trim()) {
      Alert.alert('Erreur', 'Veuillez sélectionner une destination sur la carte ou entrer une adresse');
      return;
    }

    // Vérifier si le départ est en zone interdite
    const startRestriction = isPointInRestrictedZone(location.latitude, location.longitude);
    if (startRestriction.isRestricted && startRestriction.zone) {
      Alert.alert(
        '⚠️ Départ en Zone Interdite',
        `Votre position de départ (${startRestriction.zone.nom}) est une zone interdite aux tricycles.\n\nVous ne pouvez pas commander de tricycle depuis cette position.`,
        [{ text: 'Compris' }]
      );
      return;
    }

    // Vérifier si la destination est en zone interdite
    if (destination) {
      const endRestriction = isPointInRestrictedZone(destination.latitude, destination.longitude);
      if (endRestriction.isRestricted && endRestriction.zone) {
        Alert.alert(
          '⚠️ Destination en Zone Interdite',
          `Votre destination (${endRestriction.zone.nom}) est une zone interdite aux tricycles.\n\nVeuillez choisir une autre destination.`,
          [{ text: 'Compris' }]
        );
        return;
      }

      // Vérifier si le trajet traverse des zones interdites
      const routeCheck = doesRouteIntersectRestrictedZone(
        location.latitude,
        location.longitude,
        destination.latitude,
        destination.longitude
      );

      if (routeCheck.intersects && routeCheck.zones.length > 0) {
        const zoneNames = routeCheck.zones.map((z) => `• ${z.nom}`).join('\n');
        Alert.alert(
          '⚠️ Trajet Traversant des Zones Interdites',
          `Attention! Votre trajet pourrait traverser les zones suivantes interdites aux tricycles:\n\n${zoneNames}\n\nLe conducteur devra emprunter un itinéraire alternatif, ce qui peut augmenter la durée et le prix du trajet.\n\nSouhaitez-vous continuer?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer', onPress: () => proceedWithBooking() },
          ]
        );
        return;
      }
    }

    await proceedWithBooking();
  };

  const proceedWithBooking = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour demander une course',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const response = await courseService.createCourse({
        departLatitude: location.latitude,
        departLongitude: location.longitude,
        departAdresse: departAdresse || 'Position actuelle',
        destinationLatitude: destination?.latitude || location.latitude + 0.01,
        destinationLongitude: destination?.longitude || location.longitude + 0.01,
        destinationAdresse: destinationAdresse || 'Destination sélectionnée',
      });

      Alert.alert(
        'Course demandée',
        `Prix estimé: ${response.course.prix} FCFA\n${response.message}`,
        [
          {
            text: 'Voir mes courses',
            onPress: () => router.push('/courses-historique' as any),
          },
          { text: 'OK' },
        ]
      );

      // Réinitialiser
      setDestination(null);
      setDestinationAdresse('');
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la demande');
    } finally {
      setLoading(false);
    }
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={location}
        onPress={handleMapPress}
      >
        {/* Zone de service Côte d'Ivoire */}
        <Circle
          center={COTE_IVOIRE_CENTER}
          radius={COTE_IVOIRE_RADIUS}
          strokeColor="rgba(255, 107, 53, 0.3)"
          fillColor="rgba(255, 107, 53, 0.05)"
          strokeWidth={2}
        />

        {/* Zones interdites aux tricycles */}
        {RESTRICTED_ZONES.map((zone) => (
          <Polyline
            key={zone.id}
            coordinates={zone.coordinates}
            strokeColor="rgba(255, 0, 0, 0.6)"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        ))}

        {/* Position actuelle */}
        <Marker 
          coordinate={location} 
          title="Vous êtes ici"
          description={departAdresse}
        >
          <View style={styles.currentLocationMarker}>
            <FontAwesome5 name="hand-paper" size={20} color="#2196F3" />
          </View>
        </Marker>

        {/* Destination */}
        {destination && (
          <Marker 
            coordinate={destination} 
            title="Destination"
            description={destinationAdresse}
            pinColor="red"
          />
        )}

        {/* Conducteurs à proximité */}
        {nearbyDrivers.map((driver: any) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.positionLatitude,
              longitude: driver.positionLongitude,
            }}
            title={`${driver.user.prenom} ${driver.user.nom}`}
            description={`Note: ${driver.note}/5 • ${driver.nombreCourses} courses`}
          >
            <View style={styles.driverMarker}>
              <FontAwesome5 name="motorcycle" size={24} color="#FF6B35" />
            </View>
          </Marker>
        ))}
      </MapView>

      <ScrollView style={styles.infoPanel} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Demander un Tricycle</Text>
          <Text style={styles.subtitle}>
            {nearbyDrivers.length} conducteur(s) disponible(s) • Côte d'Ivoire
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <FontAwesome5 name="map-marker-alt" size={20} color="#4CAF50" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Adresse de départ"
              value={departAdresse}
              onChangeText={setDepartAdresse}
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="flag-checkered" size={20} color="#F44336" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Adresse de destination ou cliquez sur la carte"
              value={destinationAdresse}
              onChangeText={setDestinationAdresse}
            />
          </View>

          <Text style={styles.hint}>
            💡 Appuyez sur la carte pour sélectionner votre destination
          </Text>

          <TouchableOpacity
            style={[styles.button, (!destination && !destinationAdresse.trim()) && styles.buttonDisabled]}
            onPress={handleRequestCourse}
            disabled={(!destination && !destinationAdresse.trim()) || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="motorcycle" size={20} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.buttonText}>Demander une course</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Zone Interdite */}
      <Modal
        visible={showRestrictedZoneModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRestrictedZoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <FontAwesome5 name="exclamation-triangle" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Zone Interdite</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>{restrictedZoneMessage}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowRestrictedZoneModal(false)}
            >
              <Text style={styles.modalButtonText}>Compris</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  currentLocationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 5,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
