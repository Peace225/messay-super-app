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
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';
import { courseService } from '../services/courseService';
import { useAuthStore } from '../store/authStore';

// Coordonnées de Songon, Côte d'Ivoire
const SONGON_CENTER = {
  latitude: 5.2897,
  longitude: -4.2486,
};

const SONGON_RADIUS = 5000; // 5km de rayon

export default function TricycleScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [location, setLocation] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [departAdresse, setDepartAdresse] = useState('');
  const [destinationAdresse, setDestinationAdresse] = useState('');
  const [loading, setLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisation de localisation requise');
        // Utiliser la position par défaut de Songon
        setLocation({
          latitude: SONGON_CENTER.latitude,
          longitude: SONGON_CENTER.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        setDepartAdresse('Songon');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const userLat = currentLocation.coords.latitude;
      const userLon = currentLocation.coords.longitude;

      // Vérifier si l'utilisateur est dans la zone de Songon
      const distance = getDistance(
        userLat,
        userLon,
        SONGON_CENTER.latitude,
        SONGON_CENTER.longitude
      );

      if (distance > SONGON_RADIUS) {
        Alert.alert(
          'Zone non couverte',
          'Vous êtes en dehors de la zone de service Songon. La carte sera centrée sur Songon.',
          [{ text: 'OK' }]
        );
        setLocation({
          latitude: SONGON_CENTER.latitude,
          longitude: SONGON_CENTER.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        setDepartAdresse('Songon');
      } else {
        setLocation({
          latitude: userLat,
          longitude: userLon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        setDepartAdresse('Position actuelle');
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
    
    // Vérifier si la destination est dans la zone de Songon
    const distance = getDistance(
      coordinate.latitude,
      coordinate.longitude,
      SONGON_CENTER.latitude,
      SONGON_CENTER.longitude
    );

    if (distance > SONGON_RADIUS) {
      Alert.alert(
        'Zone non couverte',
        'Veuillez sélectionner une destination dans la zone de Songon (rayon de 5km).'
      );
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
        {/* Zone de service Songon */}
        <Circle
          center={SONGON_CENTER}
          radius={SONGON_RADIUS}
          strokeColor="rgba(255, 107, 53, 0.5)"
          fillColor="rgba(255, 107, 53, 0.1)"
          strokeWidth={2}
        />

        {/* Position actuelle */}
        <Marker 
          coordinate={location} 
          title="Vous êtes ici"
          description={departAdresse}
        >
          <View style={styles.currentLocationMarker}>
            <FontAwesome5 name="circle" size={20} color="#2196F3" />
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
            {nearbyDrivers.length} conducteur(s) disponible(s) • Zone: Songon
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
});
