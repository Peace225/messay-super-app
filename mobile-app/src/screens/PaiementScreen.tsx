import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

const MOYENS_PAIEMENT = [
  { id: 'CARTE_BANCAIRE', nom: 'Carte Bancaire', icon: 'credit-card', iconColor: '#4CAF50', couleur: '#4CAF50' },
  { id: 'ORANGE_MONEY', nom: 'Orange Money', icon: 'circle', iconColor: '#FF9800', couleur: '#FF9800' },
  { id: 'MTN_MOMO', nom: 'MTN Mobile Money', icon: 'circle', iconColor: '#FFEB3B', couleur: '#FFEB3B' },
  { id: 'WAVE', nom: 'Wave', icon: 'water', iconColor: '#2196F3', couleur: '#2196F3' },
  { id: 'ESPECES', nom: 'Espèces', icon: 'money-bill-wave', iconColor: '#4CAF50', couleur: '#4CAF50' },
];

interface PaiementScreenProps {
  montant: number;
  type: string;
  onSuccess?: () => void;
}

export default function PaiementScreen({ montant, type, onSuccess }: PaiementScreenProps) {
  const router = useRouter();
  const [selectedMoyen, setSelectedMoyen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePaiement = async () => {
    if (!selectedMoyen) {
      Alert.alert('Erreur', 'Veuillez sélectionner un moyen de paiement');
      return;
    }

    setLoading(true);

    // Simuler le paiement
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Paiement réussi !',
        `Votre paiement de ${montant} FCFA a été effectué avec succès.`,
        [
          {
            text: 'Télécharger le reçu',
            onPress: () => {
              Alert.alert('Reçu', 'Le reçu a été téléchargé dans vos documents');
            },
          },
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) onSuccess();
              router.back();
            },
          },
        ]
      );
    }, 2000);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paiement</Text>
        <View style={styles.montantCard}>
          <Text style={styles.montantLabel}>Montant à payer</Text>
          <Text style={styles.montant}>{montant.toLocaleString()} FCFA</Text>
          <Text style={styles.typeService}>{type}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choisir un moyen de paiement</Text>
        {MOYENS_PAIEMENT.map((moyen) => (
          <TouchableOpacity
            key={moyen.id}
            style={[
              styles.moyenCard,
              selectedMoyen === moyen.id && styles.moyenCardActive,
            ]}
            onPress={() => setSelectedMoyen(moyen.id)}
          >
            <FontAwesome5 name={moyen.icon} size={32} color={moyen.iconColor} style={{ marginRight: 15 }} />
            <Text style={styles.moyenNom}>{moyen.nom}</Text>
            {selectedMoyen === moyen.id && (
              <Text style={styles.checkIcon}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, !selectedMoyen && styles.payButtonDisabled]}
          onPress={handlePaiement}
          disabled={!selectedMoyen || loading}
        >
          <Text style={styles.payButtonText}>
            {loading ? 'Traitement...' : `Payer ${montant.toLocaleString()} FCFA`}
          </Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 20,
  },
  montantCard: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  montantLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  montant: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
  },
  typeService: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  moyenCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moyenCardActive: {
    borderColor: '#FF6B35',
  },
  moyenIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  moyenNom: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  checkIcon: {
    fontSize: 24,
    color: '#FF6B35',
  },
  footer: {
    padding: 20,
  },
  payButton: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
