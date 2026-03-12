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
import { FontAwesome5 } from '@expo/vector-icons';

export default function TicketsHistoriqueScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = async () => {
    try {
      const response = await api.get('/tickets');
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Erreur chargement tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'RESERVE':
        return '#FFA500';
      case 'PAYE':
        return '#4169E1';
      case 'UTILISE':
        return '#32CD32';
      case 'ANNULE':
        return '#DC143C';
      case 'EXPIRE':
        return '#999';
      default:
        return '#666';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'RESERVE':
        return 'Réservé';
      case 'PAYE':
        return 'Payé';
      case 'UTILISE':
        return 'Utilisé';
      case 'ANNULE':
        return 'Annulé';
      case 'EXPIRE':
        return 'Expiré';
      default:
        return statut;
    }
  };

  const getCompagnieLogo = (compagnie: string) => {
    switch (compagnie) {
      case 'UTBS':
        return '🚌';
      case 'BTA':
        return '🚍';
      case 'RVS':
        return '🚐';
      default:
        return '🚌';
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
        <Text style={styles.title}>Mes tickets</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="ticket-alt" size={64} color="#ccc" style={{ marginBottom: 20 }} />
            <Text style={styles.emptyText}>Aucun ticket</Text>
            <Text style={styles.emptySubtext}>
              Vos tickets apparaîtront ici
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={styles.compagnieInfo}>
                  <Text style={styles.compagnieLogo}>
                    {getCompagnieLogo(ticket.compagnie)}
                  </Text>
                  <Text style={styles.compagnieNom}>{ticket.compagnie}</Text>
                </View>
                <View
                  style={[
                    styles.statutBadge,
                    { backgroundColor: getStatutColor(ticket.statut) },
                  ]}
                >
                  <Text style={styles.statutText}>
                    {getStatutLabel(ticket.statut)}
                  </Text>
                </View>
              </View>

              <View style={styles.ticketRoute}>
                <View style={styles.ticketPoint}>
                  <Text style={styles.ticketVille}>{ticket.depart}</Text>
                  <Text style={styles.ticketHeure}>{ticket.heureDepart}</Text>
                </View>
                <Text style={styles.ticketArrow}>→</Text>
                <View style={styles.ticketPoint}>
                  <Text style={styles.ticketVille}>{ticket.destination}</Text>
                </View>
              </View>

              <View style={styles.ticketDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(ticket.dateDepart).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Siège:</Text>
                  <Text style={styles.detailValue}>{ticket.siege}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Prix:</Text>
                  <Text style={styles.ticketPrix}>
                    {ticket.prix.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>

              <View style={styles.qrCodeSection}>
                <Text style={styles.qrCodeLabel}>Code QR:</Text>
                <Text style={styles.qrCodeValue}>{ticket.qrCode}</Text>
              </View>
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
  ticketCard: {
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
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  compagnieInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compagnieLogo: {
    fontSize: 24,
    marginRight: 10,
  },
  compagnieNom: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  ticketRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  ticketPoint: {
    flex: 1,
  },
  ticketVille: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  ticketHeure: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  ticketArrow: {
    fontSize: 24,
    color: '#FF6B35',
    marginHorizontal: 10,
  },
  ticketDetails: {
    marginBottom: 15,
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
  ticketPrix: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  qrCodeSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  qrCodeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  qrCodeValue: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
});
