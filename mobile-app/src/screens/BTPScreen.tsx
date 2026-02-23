import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const MATERIAUX = [
  { id: 'sable', nom: 'Sable', icon: '🏖️', unite: 'm³', prixUnitaire: 15000 },
  { id: 'gravier', nom: 'Gravier', icon: '🪨', unite: 'm³', prixUnitaire: 18000 },
  { id: 'ciment', nom: 'Ciment', icon: '🏗️', unite: 'sac', prixUnitaire: 5500 },
  { id: 'fer', nom: 'Fer à béton', icon: '⚙️', unite: 'tonne', prixUnitaire: 450000 },
];

const CAMIONS = [
  { id: 'benne', nom: 'Camion Benne', icon: '🚛', capacite: '10 tonnes' },
  { id: 'citerne', nom: 'Camion Citerne', icon: '🚚', capacite: '8000 litres' },
  { id: 'plateau', nom: 'Camion Plateau', icon: '🚐', capacite: '5 tonnes' },
];

export default function BTPScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedMateriau, setSelectedMateriau] = useState<any>(null);
  const [quantite, setQuantite] = useState('');
  const [selectedCamion, setSelectedCamion] = useState<any>(null);
  const [adresse, setAdresse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCommander = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour passer une commande',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    if (!selectedMateriau || !quantite || !selectedCamion || !adresse) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const total = selectedMateriau.prixUnitaire * parseFloat(quantite);
    
    setLoading(true);
    try {
      await api.post('/btp/commandes', {
        typeMateriau: selectedMateriau.id.toUpperCase(),
        quantite: parseFloat(quantite),
        unite: selectedMateriau.unite,
        typeCamion: selectedCamion.id.toUpperCase(),
        adresseLivraison: adresse,
        latitudeLivraison: 5.3599517, // Coordonnées par défaut (Abidjan)
        longitudeLivraison: -4.0082563,
        dateLivraison: new Date().toISOString(),
        prix: total,
      });

      Alert.alert('Succès', 'Votre commande a été enregistrée !', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedMateriau(null);
            setQuantite('');
            setSelectedCamion(null);
            setAdresse('');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lacarrière BTP</Text>
        <Text style={styles.subtitle}>Matériaux de construction</Text>
      </View>

      {/* Matériaux */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choisir un matériau</Text>
        <View style={styles.grid}>
          {MATERIAUX.map((materiau) => (
            <TouchableOpacity
              key={materiau.id}
              style={[
                styles.materiauCard,
                selectedMateriau?.id === materiau.id && styles.materiauCardActive,
              ]}
              onPress={() => setSelectedMateriau(materiau)}
            >
              <Text style={styles.materiauIcon}>{materiau.icon}</Text>
              <Text style={styles.materiauNom}>{materiau.nom}</Text>
              <Text style={styles.materiauPrix}>
                {materiau.prixUnitaire.toLocaleString()} FCFA/{materiau.unite}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quantité */}
      {selectedMateriau && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantité</Text>
          <View style={styles.quantiteContainer}>
            <TextInput
              style={styles.quantiteInput}
              placeholder={`Quantité en ${selectedMateriau.unite}`}
              keyboardType="numeric"
              value={quantite}
              onChangeText={setQuantite}
            />
            <Text style={styles.quantiteUnite}>{selectedMateriau.unite}</Text>
          </View>
          {quantite && (
            <Text style={styles.totalText}>
              Total: {(selectedMateriau.prixUnitaire * parseFloat(quantite || '0')).toLocaleString()} FCFA
            </Text>
          )}
        </View>
      )}

      {/* Type de camion */}
      {selectedMateriau && quantite && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de camion</Text>
          {CAMIONS.map((camion) => (
            <TouchableOpacity
              key={camion.id}
              style={[
                styles.camionCard,
                selectedCamion?.id === camion.id && styles.camionCardActive,
              ]}
              onPress={() => setSelectedCamion(camion)}
            >
              <Text style={styles.camionIcon}>{camion.icon}</Text>
              <View style={styles.camionInfo}>
                <Text style={styles.camionNom}>{camion.nom}</Text>
                <Text style={styles.camionCapacite}>Capacité: {camion.capacite}</Text>
              </View>
              {selectedCamion?.id === camion.id && (
                <Text style={styles.checkIcon}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Adresse de livraison */}
      {selectedMateriau && quantite && selectedCamion && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          <TextInput
            style={styles.adresseInput}
            placeholder="Entrez l'adresse de livraison"
            value={adresse}
            onChangeText={setAdresse}
            multiline
          />
        </View>
      )}

      {/* Bouton Commander */}
      {selectedMateriau && quantite && selectedCamion && adresse && (
        <View style={styles.footer}>
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.historiqueButton}
              onPress={() => router.push('/btp-historique' as any)}
            >
              <Text style={styles.historiqueButtonText}>📋 Voir l'historique</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.commanderButton}
            onPress={handleCommander}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.commanderButtonText}>Commander</Text>
            )}
          </TouchableOpacity>
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
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  materiauCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    width: '48%',
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  materiauCardActive: {
    borderColor: '#FF6B35',
  },
  materiauIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  materiauNom: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  materiauPrix: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  quantiteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  quantiteInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
  },
  quantiteUnite: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginTop: 10,
    textAlign: 'right',
  },
  camionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  camionCardActive: {
    borderColor: '#FF6B35',
  },
  camionIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  camionInfo: {
    flex: 1,
  },
  camionNom: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  camionCapacite: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  checkIcon: {
    fontSize: 24,
    color: '#FF6B35',
  },
  adresseInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 20,
  },
  historiqueButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  historiqueButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commanderButton: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  commanderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
