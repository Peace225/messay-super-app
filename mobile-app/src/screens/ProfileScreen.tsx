import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  // Déterminer les accès selon le rôle
  const userRole = user?.role || 'USER';
  const isUser = userRole === 'USER';
  const isConducteur = userRole === 'CONDUCTEUR';
  const isChauffeur = userRole === 'CHAUFFEUR';
  const isAdmin = userRole === 'ADMIN';

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(tabs)/home');
          },
        },
      ]
    );
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.guestContainer}>
          <FontAwesome5 name="user-circle" size={80} color="#ccc" />
          <Text style={styles.guestTitle}>Mode Invité</Text>
          <Text style={styles.guestText}>
            Connectez-vous pour accéder à toutes les fonctionnalités
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerButtonText}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>
            {user.nom.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>
          {user.prenom} {user.nom}
        </Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Text style={styles.userPhone}>{user.telephone}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon compte</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/edit-profile' as any)}
        >
          <FontAwesome5 name="edit" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
          <Text style={styles.menuText}>Modifier le profil</Text>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        {/* Mes courses - Accessible uniquement pour USER et CONDUCTEUR */}
        {(isUser || isConducteur) && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/courses-historique' as any)}
          >
            <FontAwesome5 name="car" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
            <Text style={styles.menuText}>Mes courses</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        )}

        {/* Moyens de paiement - Accessible pour tous */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/paiement' as any)}
        >
          <FontAwesome5 name="credit-card" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
          <Text style={styles.menuText}>Moyens de paiement</Text>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        {/* Mes tickets - Uniquement pour USER */}
        {isUser ? (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/tickets-historique' as any)}
          >
            <FontAwesome5 name="ticket-alt" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
            <Text style={styles.menuText}>Mes tickets</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.menuItem, styles.menuItemDisabled]}>
            <FontAwesome5 name="ticket-alt" size={20} color="#ccc" style={{ marginRight: 15 }} />
            <Text style={[styles.menuText, styles.menuTextDisabled]}>Mes tickets</Text>
            <FontAwesome5 name="lock" size={16} color="#ccc" />
          </View>
        )}

        {/* Mes commandes BTP - Uniquement pour USER et CHAUFFEUR */}
        {isUser ? (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/btp-historique' as any)}
          >
            <FontAwesome5 name="truck" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
            <Text style={styles.menuText}>Mes commandes BTP</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        ) : isChauffeur ? (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/chauffeur-livraisons' as any)}
          >
            <FontAwesome5 name="truck" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
            <Text style={styles.menuText}>Mes livraisons BTP</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.menuItem, styles.menuItemDisabled]}>
            <FontAwesome5 name="truck" size={20} color="#ccc" style={{ marginRight: 15 }} />
            <Text style={[styles.menuText, styles.menuTextDisabled]}>Mes commandes BTP</Text>
            <FontAwesome5 name="lock" size={16} color="#ccc" />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres</Text>

        <TouchableOpacity style={styles.menuItem}>
          <FontAwesome5 name="bell" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
          <Text style={styles.menuText}>Notifications</Text>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <FontAwesome5 name="globe" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
          <Text style={styles.menuText}>Langue</Text>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/support' as any)}
        >
          <FontAwesome5 name="question-circle" size={20} color="#FF6B35" style={{ marginRight: 15 }} />
          <Text style={styles.menuText}>Aide & Support</Text>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Déconnexion</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
        <Text style={styles.footerText}>MESSAY © 2026</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  guestText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  registerButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#fff',
    padding: 30,
    paddingTop: 50,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarLargeText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  menuItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#f9f9f9',
  },
  menuTextDisabled: {
    color: '#999',
  },
  logoutButton: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  logoutButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
});
