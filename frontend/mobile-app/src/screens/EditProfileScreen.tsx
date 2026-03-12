import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleUpdate = async () => {
    if (!formData.nom || !formData.prenom || !formData.email || !formData.telephone) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validation du mot de passe si changement demandé
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
        return;
      }
      if (formData.newPassword.length < 6) {
        Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
    }

    setLoading(true);
    try {
      const updateData: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        telephone: formData.telephone,
      };

      // Ajouter les mots de passe si changement demandé
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await api.put(`/users/${user?.id}`, updateData);
      
      // Mettre à jour l'utilisateur dans le store
      setUser(response.data.user);

      Alert.alert('Succès', 'Profil mis à jour avec succès', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.error || 'Erreur lors de la mise à jour du profil'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${user?.id}`);
              Alert.alert('Compte supprimé', 'Votre compte a été supprimé avec succès');
              await useAuthStore.getState().logout();
              router.replace('/(tabs)/home');
            } catch (error: any) {
              Alert.alert(
                'Erreur',
                error.response?.data?.error || 'Erreur lors de la suppression du compte'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Modifier le profil</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          <Text style={styles.label}>Nom *</Text>
          <TextInput
            style={styles.input}
            value={formData.nom}
            onChangeText={(text) => setFormData({ ...formData, nom: text })}
            placeholder="Votre nom"
          />

          <Text style={styles.label}>Prénom *</Text>
          <TextInput
            style={styles.input}
            value={formData.prenom}
            onChangeText={(text) => setFormData({ ...formData, prenom: text })}
            placeholder="Votre prénom"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="votre@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Téléphone *</Text>
          <TextInput
            style={styles.input}
            value={formData.telephone}
            onChangeText={(text) => setFormData({ ...formData, telephone: text })}
            placeholder="+225 XX XX XX XX XX"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changer le mot de passe</Text>
          <Text style={styles.sectionSubtitle}>
            Laissez vide si vous ne souhaitez pas changer votre mot de passe
          </Text>

          <Text style={styles.label}>Mot de passe actuel</Text>
          <TextInput
            style={styles.input}
            value={formData.currentPassword}
            onChangeText={(text) => setFormData({ ...formData, currentPassword: text })}
            placeholder="Mot de passe actuel"
            secureTextEntry
          />

          <Text style={styles.label}>Nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            value={formData.newPassword}
            onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
            placeholder="Nouveau mot de passe"
            secureTextEntry
          />

          <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
            placeholder="Confirmer le mot de passe"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.updateButtonText}>Mettre à jour</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Zone dangereuse</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  updateButton: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerZone: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#ffebee',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
