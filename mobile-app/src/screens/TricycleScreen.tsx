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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';
import { courseService } from '../services/courseService';
import { useAuthStore } from '../store/authStore';

export default function TricycleScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [location, setLocation] = useState<any>(null);
  const [departAdresse, setDepartAdresse] = useState('');
  const [destinationAdresse, setDestinationAdresse] = useState('');
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
      });

      setDepartAdresse('Position actuelle');

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

  const handleRequestCourse = async () => {
    if (!location || !destinationAdresse.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse de destination');
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
        departAdresse: departAdresse,
        destinationLatitude: location.latitude + 0.01,
        destinationLongitude: location.longitude + 0.01,
        destinationAdresse: destinationAdresse,
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
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Demander un Tricycle</Text>
        <Text style={styles.subtitle}>
          {nearbyDrivers.length} conducteur(s) disponible(s) à proximité
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
            placeholder="Adresse de destination"
            value={destinationAdresse}
            onChangeText={setDestinationAdresse}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, !destinationAdresse.trim() && styles.buttonDisabled]}
          onPress={handleRequestCourse}
          disabled={!destinationAdresse.trim() || loading}
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

      {nearbyDrivers.length > 0 && (
        <View style={styles.driversSection}>
          <Text style={styles.sectionTitle}>Conducteurs à proximité</Text>
          {nearbyDrivers.map((driver: any) => (
            <View key={driver.id} style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {driver.user.nom.charAt(0)}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>
                  {driver.user.prenom} {driver.user.nom}
                </Text>
                <View style={styles.driverStats}>
                  <FontAwesome5 name="star" size={12} color="#FFB800" />
                  <Text style={styles.driverRating}>{driver.note}/5</Text>
                  <Text style={styles.driverCourses}>
                    • {driver.nombreCourses} courses
                  </Text>
                </View>
              </View>
              <View style={styles.driverBadge}>
                <Text style={styles.driverBadgeText}>
                  {driver.statut === 'DISPONIBLE' ? 'Disponible' : 'Occupé'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driversSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  driverAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRating: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  driverCourses: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  driverBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  driverBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
