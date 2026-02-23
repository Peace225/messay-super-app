import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5 } from '@expo/vector-icons';

const TYPES_DEMANDE = [
  { id: 'PROBLEME_TECHNIQUE', nom: 'Problème technique', icon: 'wrench' },
  { id: 'OBJET_PERDU', nom: 'Objet perdu', icon: 'search' },
  { id: 'LITIGE', nom: 'Litige', icon: 'balance-scale' },
  { id: 'QUESTION', nom: 'Question', icon: 'question-circle' },
  { id: 'AUTRE', nom: 'Autre', icon: 'comments' },
];

export default function SupportScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [sujet, setSujet] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour créer un ticket de support',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    if (!selectedType || !sujet || !description) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);

    // Simuler la création du ticket
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Ticket créé !',
        'Votre demande a été enregistrée. Notre équipe vous répondra dans les plus brefs délais.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedType(null);
              setSujet('');
              setDescription('');
            },
          },
        ]
      );
    }, 1500);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Support Client</Text>
        <Text style={styles.subtitle}>Nous sommes là pour vous aider 24/7</Text>
      </View>

      {/* Type de demande */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type de demande</Text>
        <View style={styles.typesGrid}>
          {TYPES_DEMANDE.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeCard,
                selectedType === type.id && styles.typeCardActive,
              ]}
              onPress={() => setSelectedType(type.id)}
            >
              <FontAwesome5 name={type.icon} size={24} color={selectedType === type.id ? '#fff' : '#FF6B35'} />
              <Text style={styles.typeNom}>{type.nom}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Formulaire */}
      {selectedType && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails de votre demande</Text>
          
          <Text style={styles.label}>Sujet</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Problème de paiement"
            value={sujet}
            onChangeText={setSujet}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Décrivez votre problème en détail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Envoi en cours...' : 'Envoyer'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact rapide */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact rapide</Text>
        
        <TouchableOpacity style={styles.contactCard}>
          <FontAwesome5 name="phone" size={32} color="#FF6B35" style={{ marginRight: 15 }} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Téléphone</Text>
            <Text style={styles.contactValue}>+225 07 00 00 00 00</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard}>
          <FontAwesome5 name="envelope" size={32} color="#FF6B35" style={{ marginRight: 15 }} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Email</Text>
            <Text style={styles.contactValue}>support@messay.com</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard}>
          <FontAwesome5 name="comments" size={32} color="#FF6B35" style={{ marginRight: 15 }} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Chat en direct</Text>
            <Text style={styles.contactValue}>Disponible 24/7</Text>
          </View>
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
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
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
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    width: '48%',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardActive: {
    borderColor: '#FF6B35',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeNom: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 120,
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 14,
    color: '#666',
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 3,
  },
});
