import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Dimensions,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const TRICYCLE_ICON = require('../../assets/images/map/tricycle-icon.png');
const DEFAULT_PROFILE = "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?q=80&w=500&auto=format&fit=crop";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout, setUser } = useAuthStore();
  const [loadingImage, setLoadingImage] = useState(false);
  
  const shineAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Apparition en fondu de l'écran
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const startShine = () => {
      shineAnim.setValue(-width);
      Animated.timing(shineAnim, {
        toValue: width,
        duration: 2500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(startShine, 4000);
      });
    };
    if (isAuthenticated) startShine();
  }, [isAuthenticated]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Privilège Requis', 'L\'accès aux photos est nécessaire pour personnaliser votre profil MESSAY.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setLoadingImage(true);
      // Simulation d'upload
      setTimeout(() => {
        setUser({ ...user, photo: result.assets[0].uri });
        setLoadingImage(false);
        Alert.alert('Élite', 'Votre identité visuelle a été mise à jour. ✨');
      }, 1200);
    }
  };

  const handleLogout = () => {
    Alert.alert('Session', 'Souhaitez-vous fermer votre accès sécurisé ?', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await logout(); router.replace('/(tabs)/home'); } },
    ]);
  };

  if (!isAuthenticated || !user) return null;
  const userRole = user?.role || 'USER';

  return (
    <Animated.View style={[styles.mainWrapper, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* HEADER PRO 7D */}
        <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.headerPremium}>
          <View style={styles.headerOverlay}>
            
            <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={pickImage} 
                style={styles.avatarContainer}
            >
              <LinearGradient colors={['#FF6B35', '#FF8E64']} style={styles.avatarHalo}>
                <View style={styles.avatarBorder}>
                  {loadingImage ? (
                    <View style={styles.loaderFull}>
                      <ActivityIndicator color="white" />
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: user.photo || DEFAULT_PROFILE }} 
                      style={styles.profilePhoto} 
                    />
                  )}
                </View>
              </LinearGradient>
              <View style={styles.cameraBadgePro}>
                  <Ionicons name="camera" size={12} color="white" />
              </View>
              <View style={styles.activePulse} />
            </TouchableOpacity>
            
            <Text style={styles.userNamePro}>{user.prenom} {user.nom}</Text>
            
            <View style={styles.pillBadgePro}>
              <LinearGradient 
                colors={['rgba(255,107,53,0.2)', 'rgba(255,142,100,0.1)']} 
                style={styles.pillGradient}
              >
                <Ionicons name="shield-checkmark" size={14} color="#FF8E64" style={{marginRight: 6}} />
                <Text style={styles.pillBadgeTextPro}>{userRole}</Text>
              </LinearGradient>
            </View>

            <View style={styles.contactRowPro}>
               <Ionicons name="mail-outline" size={12} color="rgba(255,255,255,0.5)" />
               <Text style={styles.contactTextPro}>{user.email}</Text>
               <View style={styles.dotSeparatorPro} />
               <Ionicons name="call-outline" size={12} color="rgba(255,255,255,0.5)" />
               <Text style={styles.contactTextPro}>{user.telephone}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* BANNIÈRE PARTENAIRE ELITE */}
          {userRole === 'USER' && (
            <Pressable style={({pressed}) => [styles.promoCard, pressed && {transform: [{scale: 0.98}]}]} onPress={() => router.push('/support')}>
              <LinearGradient colors={['#FF6B35', '#FF8E64']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.promoGradient}>
                <Animated.View style={[styles.shineContainer, { transform: [{ translateX: shineAnim }] }]}>
                  <LinearGradient colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shineGradient} />
                </Animated.View>
                <View style={styles.promoInfo}>
                  <Text style={styles.promoTitlePro}>Devenez Partenaire</Text>
                  <Text style={styles.promoSubPro}>Activez votre tricycle et encaissez des revenus.</Text>
                </View>
                <View style={styles.promoIconBoxPro}>
                    <Image source={TRICYCLE_ICON} style={styles.promoTricycleIcon} resizeMode="contain" />
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* SECTIONS ACTIONS */}
          <View style={styles.glassSection}>
            <Text style={styles.sectionTitlePro}>Privilèges Compte</Text>
            <MenuOptionPro icon="user-edit" title="Modifier le profil" sub="Nom, prénom, téléphone" onPress={() => router.push('/edit-profile')} />
            <MenuOptionPro icon="wallet" title="MESSAY Wallet" sub="Gérer vos crédits et paiements" onPress={() => router.push('/paiement')} />
            <MenuOptionPro icon="headset" title="Conciergerie 24/7" sub="Assistance et support technique" onPress={() => router.push('/support')} />
          </View>

          <TouchableOpacity style={styles.logoutBtnPro} onPress={handleLogout}>
             <Ionicons name="power" size={20} color="#EF4444" />
             <Text style={styles.logoutBtnTextPro}>Fermer la session</Text>
          </TouchableOpacity>

          <View style={styles.footerPro}>
             <Text style={styles.versionTextPro}>MESSAY PLATINUM v1.0.1</Text>
             <Text style={styles.copyrightTextPro}>© 2026 MESSAY GROUP CI</Text>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const MenuOptionPro = ({ icon, title, sub, onPress }: any) => (
  <TouchableOpacity style={styles.menuRowPro} onPress={onPress} activeOpacity={0.6}>
    <View style={styles.iconCirclePro}>
        <FontAwesome5 name={icon} size={14} color="#FF6B35" />
    </View>
    <View style={{flex: 1}}>
        <Text style={styles.menuTitlePro}>{title}</Text>
        <Text style={styles.menuSubTitlePro}>{sub}</Text>
    </View>
    <Ionicons name="chevron-forward-outline" size={18} color="#cbd5e1" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#F0F2F5' },
  container: { flex: 1 },
  headerPremium: { paddingTop: 80, paddingBottom: 60, borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  headerOverlay: { alignItems: 'center' },
  
  // AVATAR 7D
  avatarContainer: { position: 'relative' },
  avatarHalo: { width: 116, height: 116, borderRadius: 58, justifyContent: 'center', alignItems: 'center', padding: 3 },
  avatarBorder: { width: 106, height: 106, borderRadius: 53, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  profilePhoto: { width: '100%', height: '100%' },
  loaderFull: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraBadgePro: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#FF6B35', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0f172a' },
  activePulse: { position: 'absolute', top: 5, left: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#0f172a' },
  
  userNamePro: { fontSize: 28, fontWeight: '900', color: 'white', marginTop: 15, letterSpacing: -0.5 },
  pillBadgePro: { marginTop: 12, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
  pillGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  pillBadgeTextPro: { color: '#FF8E64', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  
  contactRowPro: { flexDirection: 'row', alignItems: 'center', marginTop: 18, opacity: 0.8 },
  contactTextPro: { color: 'white', fontSize: 13, marginLeft: 5 },
  dotSeparatorPro: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  content: { padding: 20, marginTop: -40 },
  
  // CARTE PROMO PRO
  promoCard: { borderRadius: 28, overflow: 'hidden', elevation: 15, shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 15, marginBottom: 25 },
  promoGradient: { flexDirection: 'row', alignItems: 'center', padding: 24, position: 'relative' },
  promoInfo: { flex: 1 },
  promoTitlePro: { color: 'white', fontSize: 20, fontWeight: '900' },
  promoSubPro: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 18 },
  promoIconBoxPro: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  promoTricycleIcon: { width: 45, height: 45 },
  shineContainer: { position: 'absolute', top: 0, bottom: 0, width: 150 },
  shineGradient: { flex: 1, width: '100%' },

  // SECTIONS GLASS
  glassSection: { backgroundColor: 'white', borderRadius: 32, padding: 10, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  sectionTitlePro: { fontSize: 14, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, paddingLeft: 20, paddingTop: 20, marginBottom: 10 },
  menuRowPro: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24 },
  iconCirclePro: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFF5F2', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuTitlePro: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  menuSubTitlePro: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  logoutBtnPro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 22, marginTop: 5, borderRadius: 24, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  logoutBtnTextPro: { color: '#EF4444', fontSize: 16, fontWeight: '900', marginLeft: 12 },
  
  footerPro: { paddingVertical: 40, alignItems: 'center' },
  versionTextPro: { fontSize: 11, fontWeight: '900', color: '#cbd5e1', letterSpacing: 3 },
  copyrightTextPro: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginTop: 6 }
});