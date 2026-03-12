import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Linking, // Ajout pour la fonction d'appel
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function BTPHistoriqueScreen() {
  const router = useRouter();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommandes = async () => {
    try {
      // Simulation pour tester le rendu visuel si besoin, sinon on garde l'API
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

  // Nouvelle palette de couleurs "Premium" (Pastel + Vif)
  const getStatutStyle = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': 
        return { bg: '#FFF4E5', text: '#FF9800', icon: 'clock-outline' };
      case 'CONFIRMEE': 
        return { bg: '#E3F2FD', text: '#2196F3', icon: 'check-circle-outline' };
      case 'EN_ROUTE': 
        return { bg: '#F3E5F5', text: '#9C27B0', icon: 'truck-fast-outline' };
      case 'LIVREE': 
        return { bg: '#E8F5E9', text: '#4CAF50', icon: 'check-decagram-outline' };
      case 'ANNULEE': 
        return { bg: '#FFEBEE', text: '#F44336', icon: 'close-circle-outline' };
      default: 
        return { bg: '#F5F5F5', text: '#757575', icon: 'help-circle-outline' };
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return 'En attente de validation';
      case 'CONFIRMEE': return 'Commande confirmée';
      case 'EN_ROUTE': return 'Camion en route';
      case 'LIVREE': return 'Matériaux livrés';
      case 'ANNULEE': return 'Commande annulée';
      default: return statut;
    }
  };

  // Fonction pour appeler le chauffeur
  const handleCall = (telephone: string) => {
    Linking.openURL(`tel:${telephone}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Synchronisation de vos chantiers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER PREMIUM DEGRADÉ */}
      <LinearGradient colors={['#FF6B35', '#FF8E64']} style={styles.headerPremium}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
              <Ionicons name="chevron-back" size={24} color="#FF6B35" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
              <Text style={styles.titleWhite}>Mes Livraisons</Text>
              <Text style={styles.subtitleWhite}>{commandes.length} commande(s) BTP</Text>
            </View>
            <View style={{ width: 40 }} /> {/* Espace compensatoire */}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
        }
      >
        {commandes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="hard-hat" size={45} color="#FF6B35" />
            </View>
            <Text style={styles.emptyText}>Votre chantier est vide</Text>
            <Text style={styles.emptySubtext}>
              Commandez du sable, du ciment ou du gravier et suivez leur arrivée en temps réel.
            </Text>
            
            <TouchableOpacity 
              style={styles.orderButton}
              onPress={() => router.push('/(tabs)/btp')}
            >
              <Text style={styles.orderButtonText}>Démarrer une commande</Text>
              <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {commandes.map((commande) => {
              const statutStyle = getStatutStyle(commande.statut);
              
              return (
                <View key={commande.id} style={styles.commandeCard}>
                  
                  {/* LIGNE 1 : Statut dynamique */}
                  <View style={styles.cardHeaderTop}>
                    <View style={[styles.statutBadgePremium, { backgroundColor: statutStyle.bg }]}>
                      <MaterialCommunityIcons name={statutStyle.icon as any} size={16} color={statutStyle.text} style={{ marginRight: 6 }} />
                      <Text style={[styles.statutTextPremium, { color: statutStyle.text }]}>
                        {getStatutLabel(commande.statut)}
                      </Text>
                    </View>
                    <Text style={styles.commandeId}>#{commande.id?.substring(0,6).toUpperCase() || '10X4B'}</Text>
                  </View>

                  <View style={styles.dividerLight} />

                  {/* LIGNE 2 : Date et Prix */}
                  <View style={styles.cardInfoRow}>
                    <View style={styles.infoBlock}>
                      <Text style={styles.infoLabel}>Date prévue</Text>
                      <Text style={styles.infoValueDark}>
                        {new Date(commande.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.infoBlock, { alignItems: 'flex-end' }]}>
                      <Text style={styles.infoLabel}>Montant Total</Text>
                      <Text style={styles.commandePrixPro}>
                        {commande.prix?.toLocaleString() || 'N/A'} <Text style={styles.currency}>FCFA</Text>
                      </Text>
                    </View>
                  </View>

                  {/* LIGNE 3 : Détails de la marchandise */}
                  <View style={styles.materialsBox}>
                    <View style={styles.materialIcon}>
                      <MaterialCommunityIcons name="cube-outline" size={24} color="#FF6B35" />
                    </View>
                    <View style={styles.materialDetails}>
                      <Text style={styles.materialName}>{commande.typeMateriau}</Text>
                      <Text style={styles.materialQty}>{commande.quantite} {commande.unite} • {commande.typeCamion}</Text>
                    </View>
                  </View>

                  {/* LIGNE 4 : Destination */}
                  <View style={styles.destinationBox}>
                    <Ionicons name="location" size={16} color="#4CAF50" style={{ marginTop: 2 }}/>
                    <Text style={styles.destinationText} numberOfLines={2}>
                      {commande.adresseLivraison}
                    </Text>
                  </View>

                  {/* CARTE CHAUFFEUR INTERACTIVE (Si assigné) */}
                  {commande.chauffeur?.user?.prenom && (
                    <View style={styles.driverPremiumBox}>
                      <View style={styles.driverAvatar}>
                        <FontAwesome5 name="truck-loading" size={16} color="#fff" />
                      </View>
                      
                      <View style={styles.driverDetails}>
                        <Text style={styles.driverRole}>Livreur assigné</Text>
                        <Text style={styles.driverName}>
                          {commande.chauffeur.user.prenom} {commande.chauffeur.user.nom}
                        </Text>
                      </View>

                      {/* Bouton d'appel rapide */}
                      <TouchableOpacity 
                        style={styles.callButton}
                        onPress={() => handleCall(commande.chauffeur.user.telephone)}
                      >
                        <Ionicons name="call" size={18} color="#FF6B35" />
                      </TouchableOpacity>
                    </View>
                  )}

                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F7', // Gris très léger ultra moderne
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F5F7',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  // Nouveaux styles du Header
  headerPremium: {
    paddingTop: 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 10,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  backCircle: {
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  titleWhite: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  subtitleWhite: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '600',
  },
  
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  
  // Empty State Premium
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 35,
  },
  orderButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 20,
    elevation: 5,
    alignItems: 'center',
  },
  orderButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  listContainer: {
    paddingHorizontal: 15,
  },
  
  // Design de la Carte
  commandeCard: {
    backgroundColor: '#fff',
    marginTop: 15,
    borderRadius: 24,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statutBadgePremium: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statutTextPremium: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  commandeId: {
    fontSize: 13,
    color: '#999',
    fontWeight: 'bold',
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 15,
  },
  
  // Ligne Date et Prix
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValueDark: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '800',
  },
  commandePrixPro: {
    fontSize: 18,
    color: '#FF6B35',
    fontWeight: '900',
  },
  currency: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Boite Matériaux grise
  materialsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 16,
    marginBottom: 15,
  },
  materialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    elevation: 2,
  },
  materialDetails: {
    flex: 1,
  },
  materialName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
    marginBottom: 2,
  },
  materialQty: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },

  // Destination
  destinationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 5,
    marginBottom: 5,
  },
  destinationText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
    lineHeight: 20,
  },

  // Boite Chauffeur
  driverPremiumBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  driverAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  driverDetails: {
    flex: 1,
  },
  driverRole: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});