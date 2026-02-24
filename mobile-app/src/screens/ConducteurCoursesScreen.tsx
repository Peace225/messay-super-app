import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface Course {
  id: string;
  departAdresse: string;
  destinationAdresse: string;
  distance: number;
  prix: number;
  statut: string;
  createdAt: string;
  user: {
    nom: string;
    prenom: string;
    telephone: string;
  };
}

export default function ConducteurCoursesScreen() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/conducteur/mes-courses');
      setCourses(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const accepterCourse = async (courseId: string) => {
    try {
      await api.patch(`/courses/${courseId}/accepter`);
      Alert.alert('Succès', 'Course acceptée !');
      fetchCourses();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'accepter la course');
    }
  };

  const demarrerCourse = async (courseId: string) => {
    try {
      await api.patch(`/courses/${courseId}/demarrer`);
      Alert.alert('Succès', 'Course démarrée !');
      fetchCourses();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de démarrer la course');
    }
  };

  const terminerCourse = async (courseId: string) => {
    try {
      await api.patch(`/courses/${courseId}/terminer`);
      Alert.alert('Succès', 'Course terminée !');
      fetchCourses();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de terminer la course');
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return '#FFB800';
      case 'ACCEPTEE': return '#2196F3';
      case 'EN_COURS': return '#4CAF50';
      case 'TERMINEE': return '#666';
      case 'ANNULEE': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return 'En attente';
      case 'ACCEPTEE': return 'Acceptée';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      case 'ANNULEE': return 'Annulée';
      default: return statut;
    }
  };

  const renderCourse = ({ item }: { item: Course }) => (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.statut) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.statut)}</Text>
        </View>
        <Text style={styles.prix}>{item.prix} FCFA</Text>
      </View>

      <View style={styles.clientInfo}>
        <FontAwesome5 name="user" size={16} color="#666" />
        <Text style={styles.clientNom}>
          {item.user.prenom} {item.user.nom}
        </Text>
        <Text style={styles.clientTel}>{item.user.telephone}</Text>
      </View>

      <View style={styles.trajetInfo}>
        <View style={styles.trajetRow}>
          <FontAwesome5 name="map-marker-alt" size={16} color="#4CAF50" />
          <Text style={styles.adresse}>{item.departAdresse}</Text>
        </View>
        <View style={styles.trajetRow}>
          <FontAwesome5 name="flag-checkered" size={16} color="#F44336" />
          <Text style={styles.adresse}>{item.destinationAdresse}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <FontAwesome5 name="route" size={14} color="#666" />
          <Text style={styles.detailText}>{item.distance} km</Text>
        </View>
      </View>

      {item.statut === 'EN_ATTENTE' && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => accepterCourse(item.id)}
        >
          <Text style={styles.actionButtonText}>Accepter la course</Text>
        </TouchableOpacity>
      )}

      {item.statut === 'ACCEPTEE' && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => demarrerCourse(item.id)}
        >
          <Text style={styles.actionButtonText}>Démarrer la course</Text>
        </TouchableOpacity>
      )}

      {item.statut === 'EN_COURS' && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={() => terminerCourse(item.id)}
        >
          <Text style={styles.actionButtonText}>Terminer la course</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Courses</Text>
        <Text style={styles.headerSubtitle}>
          Bienvenue {user?.prenom} {user?.nom}
        </Text>
      </View>

      <FlatList
        data={courses}
        renderItem={renderCourse}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune course disponible</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  listContainer: {
    padding: 15,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  prix: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clientNom: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  clientTel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 'auto',
  },
  trajetInfo: {
    marginBottom: 12,
  },
  trajetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  adresse: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  actionButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
});
