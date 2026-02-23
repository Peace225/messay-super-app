import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { courseService } from '../services/courseService';
import { useAuthStore } from '../store/authStore';

export default function TricycleScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [location, setLocation] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisation de localisation requise');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Charger les conducteurs à proximité
      loadNearbyDrivers(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
    })();
  }, []);

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
    setDestination(coordinate);
  };

  const handleRequestCourse = async () => {
    if (!location || !destination) {
      Alert.alert('Erreur', 'Veuillez sélectionner une destination sur la carte');
      return;
    }

    // Vérifier si l'utilisateur est authentifié
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
        departAdresse: 'Position actuelle',
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        destinationAdresse: 'Destination sélectionnée',
      });

      Alert.alert(
        'Course demandée',
        `Prix estimé: ${response.course.prix} FCFA\n${response.message}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigation vers le suivi de course (à implémenter)
              router.back();
            },
          },
        ]
      );
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
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={location}
        onPress={handleMapPress}
      >
        {/* Position actuelle */}
        <Marker coordinate={location} title="Vous êtes ici" pinColor="blue" />

        {/* Destination */}
        {destination && (
          <Marker coordinate={destination} title="Destination" pinColor="red" />
        )}

        {/* Conducteurs à proximité */}
        {nearbyDrivers.map((driver: any) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.positionLatitude,
              longitude: driver.positionLongitude,
            }}
            title={`Conducteur ${driver.user.nom}`}
            description={`Note: ${driver.note}/5`}
          >
            <Text style={styles.driverMarker}>🛺</Text>
          </Marker>
        ))}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoTitle}>Demander un tricycle</Text>
        <Text style={styles.infoText}>
          {nearbyDrivers.length} conducteur(s) disponible(s) à proximité
        </Text>
        <Text style={styles.infoHint}>
          Appuyez sur la carte pour sélectionner votre destination
        </Text>

        <TouchableOpacity
          style={[styles.button, !destination && styles.buttonDisabled]}
          onPress={handleRequestCourse}
          disabled={!destination || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Demander une course</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  driverMarker: {
    fontSize: 30,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoHint: {
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
