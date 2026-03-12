import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

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

  const handleAction = async (livraisonId: string, action: 'accepter' | 'en-route' | 'livree', message: string) => {
    try {
      await api.patch(`/btp/${livraisonId}/${action}`);
      Alert.alert('Succès logistique 🏗️', message);
      fetchLivraisons();
    } catch (error) {
      Alert.alert('Erreur', `Impossible d'effectuer l'action.`);
    }
  };

  const getStatusConfig = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', label: 'NOUVEAU BON', icon: 'document-text' };
      case 'CONFIRMEE': return { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', label: 'CHARGEMENT PRÉVU', icon: 'cube' };
      case 'EN_ROUTE': return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', label: 'EN TRANSIT', icon: 'truck' };
      case 'LIVREE': return { color: '#64748B', bg: 'rgba(100, 116, 139, 0.1)', label: 'LIVRÉ', icon: 'checkmark-done-circle' };
      case 'ANNULEE': return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'ANNULÉ', icon: 'close-circle' };
      default: return { color: '#94a3b8', bg: '#f1f5f9', label: statut, icon: 'ellipse' };
    }
  };

  const getMaterialLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      SABLE: 'Sable de construction',
      GRAVIER: 'Gravier concassé',
      CIMENT: 'Ciment (Sacs)',
      FER: 'Fer à béton',
      BRIQUE: 'Briques',
      AUTRE: 'Matériau divers',
    };
    return labels[type] || type;
  };

  const renderLivraison = ({ item, index }: { item: Livraison, index: number }) => {
    const status = getStatusConfig(item.statut);

    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20 * (index + 1), 0] }) }] }]}>
        
        {/* EN-TÊTE : STATUT & PRIX */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceValue}>{item.prix.toLocaleString()}</Text>
            <Text style={styles.priceCurrency}>FCFA</Text>
          </View>
        </View>

        {/* INFO CLIENT */}
        <View style={styles.clientSection}>
          <View style={styles.clientAvatar}>
            <Ionicons name="person" size={18} color="#94a3b8" />
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{item.user.prenom} {item.user.nom}</Text>
            <Text style={styles.clientPhone}>{item.user.telephone}</Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call" size={18} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* DÉTAILS MATÉRIAUX ET CAMION */}
        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}><FontAwesome5 name="cubes" size={12} color="#FF6B35" /></View>
            <View>
              <Text style={styles.detailLabel}>Cargaison</Text>
              <Text style={styles.detailValue}>{getMaterialLabel(item.typeMateriau)} <Text style={styles.detailHighlight}>• {item.quantite} {item.unite}</Text></Text>
            </View>
          </View>
          
          {item.camion && (
            <View style={[styles.detailRow, { marginTop: 15 }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0F9FF' }]}><FontAwesome5 name="truck" size={12} color="#0EA5E9" /></View>
              <View>
                <Text style={styles.detailLabel}>Véhicule assigné</Text>
                <Text style={styles.detailValue}>{item.camion.type} <Text style={styles.detailSub}>({item.camion.immatriculation})</Text></Text>
              </View>
            </View>
          )}
        </View>

        {/* LIEU ET DATE */}
        <View style={styles.locationSection}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color="#10B981" style={{ width: 25 }} />
            <Text style={styles.locationText}>{item.adresseLivraison}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="calendar" size={18} color="#64748B" style={{ width: 25 }} />
            <Text style={styles.locationText}>
              Le {new Date(item.dateLivraison).toLocaleDateString('fr-FR')} à <Text style={{fontWeight: '800'}}>{item.heurePreferee}</Text>
            </Text>
          </View>
        </View>

        {/* BOUTONS D'ACTION */}
        <View style={styles.footerSection}>
          {item.statut === 'EN_ATTENTE' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleAction(item.id, 'accepter', 'Bon de livraison accepté !')}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Accepter la livraison</Text>
                <Ionicons name="document-text" size={18} color="white" style={{marginLeft: 8}} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {item.statut === 'CONFIRMEE' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleAction(item.id, 'en-route', 'Cargaison en transit !')}>
              <LinearGradient colors={['#3B82F6', '#60A5FA']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Démarrer le transit</Text>
                <FontAwesome5 name="truck-moving" size={16} color="white" style={{marginLeft: 10}} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {item.statut === 'EN_ROUTE' && (
            <TouchableOpacity style={styles.actionBtnContainer} onPress={() => handleAction(item.id, 'livree', 'Déchargement confirmé !')}>
              <LinearGradient colors={['#10B981', '#34D399']} style={styles.actionGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                <Text style={styles.actionText}>Marquer comme Livrée</Text>
                <Ionicons name="checkmark-done" size={18} color="white" style={{marginLeft: 8}} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      
      {/* HEADER PRO */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerPremium}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerGreeting}>Bonjour, {user?.prenom}</Text>
              <Text style={styles.headerTitle}>Flotte BTP</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>ACTIF</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* LISTE DES LIVRAISONS */}
      <FlatList
        data={livraisons}
        renderItem={renderLivraison}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={70} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Aucun bon de livraison</Text>
            <Text style={styles.emptySub}>Les demandes de transport BTP apparaîtront ici.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // HEADER
  headerPremium: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10 },
  headerGreeting: { fontSize: 13, color: '#FF8E64', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: 'white', marginTop: 4 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  onlineText: { color: '#10B981', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  listContainer: { padding: 20, paddingBottom: 100 },
  
  // CARTE LIVRAISON
  card: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#94a3b8', shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  priceValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  priceCurrency: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginLeft: 4, marginBottom: 4 },

  // INFO CLIENT
  clientSection: { flexDirection: 'row', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 15 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  clientInfo: { flex: 1, marginLeft: 12 },
  clientName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  clientPhone: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },

  // BOX DÉTAILS MATÉRIAUX
  detailsBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF5F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  detailHighlight: { color: '#FF6B35' },
  detailSub: { color: '#64748B', fontWeight: '600' },

  // LIEU ET DATE
  locationSection: { marginBottom: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  locationText: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },

  // BOUTONS D'ACTION
  footerSection: { paddingTop: 10 },
  actionBtnContainer: { width: '100%', borderRadius: 16, overflow: 'hidden', elevation: 3 },
  actionGradient: { paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionText: { color: 'white', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // EMPTY STATE
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#475569', marginTop: 20 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});