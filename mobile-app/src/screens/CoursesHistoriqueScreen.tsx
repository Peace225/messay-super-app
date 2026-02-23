import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { courseService } from '../services/courseService';

export default function CoursesHistoriqueScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCourses = async () => {
    try {
      const response = await courseService.getUserCourses();
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Erreur chargement courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses();
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return '#FFA500';
      case 'ACCEPTEE':
        return '#4169E1';
      case 'EN_COURS':
        return '#9370DB';
      case 'TERMINEE':
        return '#32CD32';
      case 'ANNULEE':
        return '#DC143C';
      default:
        return '#666';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'ACCEPTEE':
        return 'Acceptée';
      case 'EN_COURS':
        return 'En cours';
      case 'TERMINEE':
        return 'Terminée';
      case 'ANNULEE':
        return 'Annulée';
      default:
        return statut;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mes courses</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {courses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛺</Text>
            <Text style={styles.emptyText}>Aucune course</Text>
            <Text style={styles.emptySubtext}>
              Vos courses apparaîtront ici
            </Text>
          </View>
        ) : (
          courses.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <Text style={styles.courseDate}>
                  {new Date(course.createdAt).toLocaleDateString('fr-FR')}
                </Text>
                <View
                  style={[
                    styles.statutBadge,
                    { backgroundColor: getStatutColor(course.statut) },
                  ]}
                >
                  <Text style={styles.statutText}>
                    {getStatutLabel(course.statut)}
                  </Text>
                </View>
              </View>

              <View style={styles.courseRoute}>
                <View style={styles.coursePoint}>
                  <Text style={styles.pointIcon}>📍</Text>
                  <Text style={styles.pointAdresse} numberOfLines={2}>
                    {course.departAdresse}
                  </Text>
                </View>
                <Text style={styles.courseArrow}>↓</Text>
                <View style={styles.coursePoint}>
                  <Text style={styles.pointIcon}>🎯</Text>
                  <Text style={styles.pointAdresse} numberOfLines={2}>
                    {course.destinationAdresse}
                  </Text>
                </View>
              </View>

              <View style={styles.courseDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Distance:</Text>
                  <Text style={styles.detailValue}>
                    {course.distance.toFixed(1)} km
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Durée estimée:</Text>
                  <Text style={styles.detailValue}>
                    {course.dureeEstimee} min
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Prix:</Text>
                  <Text style={styles.coursePrix}>
                    {course.prix.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>

              {course.conducteur && (
                <View style={styles.conducteurInfo}>
                  <Text style={styles.conducteurLabel}>Conducteur:</Text>
                  <Text style={styles.conducteurNom}>
                    {course.conducteur.user.prenom} {course.conducteur.user.nom}
                  </Text>
                  <Text style={styles.conducteurTel}>
                    {course.conducteur.user.telephone}
                  </Text>
                  {course.noteConducteur && (
                    <Text style={styles.conducteurNote}>
                      ⭐ {course.noteConducteur}/5
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
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
    backgroundColor: '#f5f5f5',
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
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF6B35',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  courseCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
    padding: 15,
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
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  courseDate: {
    fontSize: 14,
    color: '#666',
  },
  statutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  courseRoute: {
    marginBottom: 15,
  },
  coursePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pointIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  pointAdresse: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  courseArrow: {
    fontSize: 20,
    color: '#FF6B35',
    marginLeft: 10,
    marginVertical: 5,
  },
  courseDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  coursePrix: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  conducteurInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  conducteurLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  conducteurNom: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  conducteurTel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  conducteurNote: {
    fontSize: 14,
    color: '#FF6B35',
    marginTop: 5,
  },
});
