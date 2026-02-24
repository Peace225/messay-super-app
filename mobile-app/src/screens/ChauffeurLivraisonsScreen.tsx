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

interface Livraison {
  id: string;
  typeMateriau: string;
  quantite: number;
  unite: string;
  adresseLivraison: string;
  dateLivraison: string;
  heurePreferee: string;
  prix: number;
  statut: string;
  user: {
    nom: string;
    prenom: string;
    telephone: string;
  };
  camion?: {
    type: string;
    immatriculation: string;
  };
}

export default function ChauffeurLivraisonsScreen() {
  const { user } = useAuthStore();
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLivraisons = async () => {
    try {
      const response = await api.get('/btp/chauffeur/mes-livraisons');
      setLivraisons(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des livraisons:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLivraisons();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLivraisons();
  };

  const accepterLivraison = async (livraisonId: string) => {
    try {
      await api.patch(`/btp/${livraisonId}/accepter`);
      Alert.alert('Succès', 'Livraison acceptée !');
      fetchLivraisons();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'accepter la livraison');
    }
  };

  const demarrerLivraison = async (livraisonId: string) => {
    try {
      await api.patch(`/btp/${livraisonId}/en-route`);
      Alert.alert('Succès', 'Livraison en route !');
      fetchLivraisons();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de démarrer la livraison');
    }
  };

  const terminerLivraison = async (livraisonId: string) => {
    try {
      await api.patch(`/btp/${livraisonId}/livree`);
      Alert.alert('Succès', 'Livraison terminée !');
      fetchLivraisons();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de terminer la livraison');
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return '#FFB800';
      case 'CONFIRMEE': return '#2196F3';
      case 'EN_ROUTE': return '#4CAF50';
      case 'LIVREE': return '#666';
      case 'ANNULEE': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return 'En attente';
      case 'CONFIRMEE': return 'Confirmée';
      case 'EN_ROUTE': return 'En route';
      case 'LIVREE': return 'Livrée';
      case 'ANNULEE': return 'Annulée';
      default: return statut;
    }
  };

  const getMaterialLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      SABLE: 'Sable',
      GRAVIER: 'Gravier',
      CIMENT: 'Ciment',
      FER: 'Fer à béton',
      BRIQUE: 'Briques',
      AUTRE: 'Autre',
    };
    return labels[type] || type;
  };

  const renderLivraison = ({ item }: { item: Livraison }) => (
    <View style={styles.livraisonCard}>
      <View style={styles.livraisonHeader}>
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

      <View style={styles.materiauInfo}>
        <FontAwesome5 name="box" size={16} color="#FF6B35" />
        <Text style={styles.materiauText}>
          {getMaterialLabel(item.typeMateriau)} - {item.quantite} {item.unite}
        </Text>
      </View>

      <View style={styles.adresseInfo}>
        <FontAwesome5 name="map-marker-alt" size={16} color="#4CAF50" />
        <Text style={styles.adresse}>{item.adresseLivraison}</Text>
      </View>

      <View style={styles.dateInfo}>
        <FontAwesome5 name="calendar" size={14} color="#666" />
        <Text style={styles.dateText}>
          {new Date(item.dateLivraison).toLocaleDateString('fr-FR')} à {item.heurePreferee}
        </Text>
      </View>

      {item.camion && (
        <View style={styles.camionInfo}>
          <FontAwesome5 name="truck" size={14} color="#666" />
          <Text style={styles.camionText}>
            {item.camion.type} - {item.camion.immatriculation}
          </Text>
        </View>
      )}

      {item.statut === 'EN_ATTENTE' && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => accepterLivraison(item.id)}
        >
          <Text style={styles.actionButtonText}>Accepter la livraison</Text>
        </TouchableOpacity>
      )}

      {item.statut === 'CONFIRMEE' && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => demarrerLivraison(item.id)}
        >
          <Text style={styles.actionButtonText}>Démarrer la livraison</Text>
        </TouchableOpacity>
      )}

      {item.statut === 'EN_ROUTE' && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={() => terminerLivraison(item.id)}
        >
          <Text style={styles.actionButtonText}>Marquer comme livrée</Text>
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
        <Text style={styles.headerTitle}>Mes Livraisons</Text>
        <Text style={styles.headerSubtitle}>
          Bienvenue {user?.prenom} {user?.nom}
        </Text>
      </View>

      <FlatList
        data={livraisons}
        renderItem={renderLivraison}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune livraison disponible</Text>
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
  livraisonCard: {
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
  livraisonHeader: {
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
  materiauInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  materiauText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  adresseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  adresse: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  camionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
  },
  camionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
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
