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
import api from '../services/api';

export default function BTPHistoriqueScreen() {
  const router = useRouter();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommandes = async () => {
    try {
      const response = await api.get('/btp/commandes');
      setCommandes(response.data.commandes || []);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommandes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCommandes();
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return '#FFA500';
      case 'CONFIRMEE':
        return '#4169E1';
      case 'EN_ROUTE':
        return '#9370DB';
      case 'LIVREE':
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
      case 'CONFIRMEE':
        return 'Confirmée';
      case 'EN_ROUTE':
        return 'En route';
      case 'LIVREE':
        return 'Livrée';
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
        <Text style={styles.title}>Historique des commandes</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {commandes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande</Text>
            <Text style={styles.emptySubtext}>
              Vos commandes apparaîtront ici
            </Text>
          </View>
        ) : (
          commandes.map((commande) => (
            <View key={commande.id} style={styles.commandeCard}>
              <View style={styles.commandeHeader}>
                <Text style={styles.commandeDate}>
                  {new Date(commande.createdAt).toLocaleDateString('fr-FR')}
                </Text>
                <View
                  style={[
                    styles.statutBadge,
                    { backgroundColor: getStatutColor(commande.statut) },
                  ]}
                >
                  <Text style={styles.statutText}>
                    {getStatutLabel(commande.statut)}
                  </Text>
                </View>
              </View>

              <View style={styles.commandeBody}>
                <View style={styles.commandeRow}>
                  <Text style={styles.commandeLabel}>Matériau:</Text>
                  <Text style={styles.commandeValue}>
                    {commande.typeMateriau}
                  </Text>
                </View>
                <View style={styles.commandeRow}>
                  <Text style={styles.commandeLabel}>Quantité:</Text>
                  <Text style={styles.commandeValue}>
                    {commande.quantite} {commande.unite}
                  </Text>
                </View>
                <View style={styles.commandeRow}>
                  <Text style={styles.commandeLabel}>Camion:</Text>
                  <Text style={styles.commandeValue}>
                    {commande.typeCamion}
                  </Text>
                </View>
                <View style={styles.commandeRow}>
                  <Text style={styles.commandeLabel}>Adresse:</Text>
                  <Text style={styles.commandeValue}>
                    {commande.adresseLivraison}
                  </Text>
                </View>
                <View style={styles.commandeRow}>
                  <Text style={styles.commandeLabel}>Prix:</Text>
                  <Text style={styles.commandePrix}>
                    {commande.prix.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>

              {commande.chauffeur && (
                <View style={styles.chauffeurInfo}>
                  <Text style={styles.chauffeurLabel}>Chauffeur:</Text>
                  <Text style={styles.chauffeurNom}>
                    {commande.chauffeur.user.prenom}{' '}
                    {commande.chauffeur.user.nom}
                  </Text>
                  <Text style={styles.chauffeurTel}>
                    {commande.chauffeur.user.telephone}
                  </Text>
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
  commandeCard: {
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
  commandeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commandeDate: {
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
  commandeBody: {
    marginBottom: 10,
  },
  commandeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commandeLabel: {
    fontSize: 14,
    color: '#666',
  },
  commandeValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  commandePrix: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  chauffeurInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  chauffeurLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  chauffeurNom: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  chauffeurTel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});
