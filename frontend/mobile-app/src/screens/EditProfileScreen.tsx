import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const DEFAULT_PROFILE = "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?q=80&w=500&auto=format&fit=crop";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { user, setUser, logout } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(user?.photo || null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'MESSAY a besoin d\'accéder à vos photos.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
    }
  };

  const handleUpdate = async () => {
    if (!formData.nom || !formData.prenom || !formData.email || !formData.telephone) {
      Alert.alert('Attention', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.newPassword) {
      if (!formData.currentPassword) {
        Alert.alert('Sécurité', 'Veuillez entrer votre mot de passe actuel.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas.');
        return;
      }
      if (formData.newPassword.length < 6) {
        Alert.alert('Sécurité', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
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

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await api.put(`/users/${user?.id}`, updateData); 
      
      if (response.data && response.data.user) {
         setUser({ ...response.data.user, photo: selectedImage || response.data.user.photo });
      } else {
         setUser({ ...user, ...updateData, photo: selectedImage } as any);
      }

      Alert.alert('Excellence', 'Vos informations ont été mises à jour avec succès.', [
        { 
          text: 'Continuer', 
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/home'); 
            }
          } 
        },
      ]);
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Souhaitez-vous vraiment fermer votre session MESSAY ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout(); 
            router.replace('/(tabs)/home'); 
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Zone Rouge',
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte MESSAY ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${user?.id}`);
              await logout();
              router.replace('/(tabs)/home');
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de supprimer le compte.');
            }
          },
        },
      ]
    );
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <View style={styles.backIconWrapper}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Édition du Profil</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* SECTION PHOTO ICI (Elle manquait !) */}
            <View style={styles.photoSection}>
              <TouchableOpacity activeOpacity={0.8} onPress={handlePickImage} style={styles.avatarContainer}>
                <View style={styles.avatarBorder}>
                  {imageLoading ? (
                     <ActivityIndicator color="#FF6B35" />
                  ) : (
                     <Image 
                        source={{ uri: selectedImage || DEFAULT_PROFILE }} 
                        style={styles.profilePhoto} 
                     />
                  )}
                </View>
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHintText}>Appuyez pour modifier</Text>
            </View>

            <View style={styles.cardSection}>
              <Text style={styles.sectionBadge}>IDENTITÉ & CONTACT</Text>
              <CustomInput icon="person-outline" label="Nom de famille" value={formData.nom} onChangeText={(t: string) => setFormData({...formData, nom: t})} />
              <CustomInput icon="person" label="Prénom(s)" value={formData.prenom} onChangeText={(t: string) => setFormData({...formData, prenom: t})} />
              <CustomInput icon="call-outline" label="Mobile" value={formData.telephone} onChangeText={(t: string) => setFormData({...formData, telephone: t})} keyboardType="phone-pad" />
              <CustomInput icon="mail-outline" label="Adresse Email" value={formData.email} onChangeText={(t: string) => setFormData({...formData, email: t})} keyboardType="email-address" autoCapitalize="none" editable={false} />
            </View>

            <View style={styles.cardSection}>
              <Text style={styles.sectionBadge}>SÉCURITÉ DU COMPTE</Text>
              <Text style={styles.securityHint}>Laissez vide si vous souhaitez conserver votre mot de passe actuel.</Text>
              <CustomInput icon="lock-closed-outline" label="Mot de passe actuel" value={formData.currentPassword} onChangeText={(t: string) => setFormData({...formData, currentPassword: t})} secureTextEntry={!showPassword} />
              <CustomInput icon="key-outline" label="Nouveau mot de passe" value={formData.newPassword} onChangeText={(t: string) => setFormData({...formData, newPassword: t})} secureTextEntry={!showPassword} />
              <CustomInput icon="checkmark-circle-outline" label="Confirmer nouveau mot de passe" value={formData.confirmPassword} onChangeText={(t: string) => setFormData({...formData, confirmPassword: t})} secureTextEntry={!showPassword} />
              
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeBtnText}>{showPassword ? "Cacher les mots de passe" : "Afficher les mots de passe"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.8} onPress={handleUpdate} disabled={loading} style={{ marginTop: 10 }}>
              <LinearGradient colors={loading ? ['#cbd5e1', '#94a3b8'] : ['#FF6B35', '#FF8E64']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.saveButtonGradient}>
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.saveButtonText}>Enregistrer l'excellence</Text>
                    <Ionicons name="checkmark-done" size={20} color="white" style={{marginLeft: 8}} />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerNote}>Vos données sont protégées par le système de sécurité MESSAY.</Text>

            {/* BOUTON DÉCONNEXION */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#475569" />
              <Text style={styles.logoutButtonText}>Me déconnecter</Text>
            </TouchableOpacity>

            <View style={styles.dangerZone}>
              <View style={styles.dangerHeader}>
                <Ionicons name="warning" size={20} color="#EF4444" />
                <Text style={styles.dangerTitle}>Zone de suppression</Text>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                <Text style={styles.deleteButtonText}>Supprimer définitivement le compte</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const CustomInput = ({ icon, label, value, onChangeText, editable = true, secureTextEntry = false, ...props }: any) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.inputContainer, !editable && styles.inputDisabled]}>
      <Ionicons name={icon} size={20} color={editable ? "#FF6B35" : "#94a3b8"} style={styles.inputIcon} />
      <TextInput
        style={[styles.inputField, !editable && {color: '#94a3b8'}]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#cbd5e1"
        {...props}
      />
      {!editable && <Ionicons name="lock-closed" size={16} color="#e2e8f0" style={{marginRight: 15}} />}
    </View>
  </View>
);

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backButton: { padding: 5 },
  backIconWrapper: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  
  photoSection: { alignItems: 'center', marginBottom: 25, marginTop: 10 },
  avatarContainer: { position: 'relative' },
  avatarBorder: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  profilePhoto: { width: '100%', height: '100%' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF6B35', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' },
  photoHintText: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 12 },

  cardSection: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 25, shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  sectionBadge: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 20 },
  securityHint: { fontSize: 13, color: '#64748b', marginBottom: 20, fontStyle: 'italic', marginTop: -10 },
  inputWrapper: { marginBottom: 18 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  inputDisabled: { backgroundColor: '#f1f5f9', opacity: 0.7 },
  inputIcon: { paddingLeft: 15, paddingRight: 10 },
  inputField: { flex: 1, paddingVertical: 16, paddingRight: 15, fontSize: 15, fontWeight: '600', color: '#1e293b' },
  eyeBtn: { alignSelf: 'flex-end', marginTop: -5, padding: 5 },
  eyeBtnText: { color: '#FF6B35', fontSize: 13, fontWeight: '600' },
  
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
  footerNote: { textAlign: 'center', fontSize: 12, color: '#cbd5e1', marginTop: 15, marginBottom: 35 },
  
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: '#f1f5f9', borderRadius: 16, marginBottom: 20 },
  logoutButtonText: { color: '#475569', fontSize: 15, fontWeight: '700', marginLeft: 8 },

  dangerZone: { backgroundColor: '#FEF2F2', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#FECACA' },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: '#EF4444', marginLeft: 8 },
  deleteButton: { backgroundColor: 'white', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  deleteButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '700' }
});