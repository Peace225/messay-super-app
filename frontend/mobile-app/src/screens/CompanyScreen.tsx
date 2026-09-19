import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';

const normalize = (s:string)=> (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

// Mapping par NOM normalisé - plus fiable que UUID
const COMPANY_ASSETS: Record<string, any> = {
  'UTB CI': { logo: require('../../assets/logos/utb.png'), bus: require('../../assets/images/bus_utb.jpg') },
  'UTB': { logo: require('../../assets/logos/utb.png'), bus: require('../../assets/images/bus_utb.jpg') },
  'Transports AVS': { logo: require('../../assets/logos/avs.png'), bus: require('../../assets/images/bus_avs.jpg') },
  'AVS': { logo: require('../../assets/logos/avs.png'), bus: require('../../assets/images/bus_avs.jpg') },
  'CTE Transport Express': { logo: require('../../assets/logos/cte.png'), bus: require('../../assets/images/bus_cte.jpg') },
  'CTE': { logo: require('../../assets/logos/cte.png'), bus: require('../../assets/images/bus_cte.jpg') },
  'MTK Transport': { logo: require('../../assets/logos/mtk.png'), bus: require('../../assets/images/bus_mtk.jpg') },
  'MD Transport': { logo: require('../../assets/logos/mdt.png'), bus: require('../../assets/images/bus_mdt.jpg') },
  'SBTA': { logo: require('../../assets/logos/sbta.png'), bus: require('../../assets/images/bus_sbta.jpg') },
  'STAF Transport': { logo: require('../../assets/logos/staf.png'), bus: require('../../assets/images/bus_staf.jpg') },
  'STAF': { logo: require('../../assets/logos/staf.png'), bus: require('../../assets/images/bus_staf.jpg') },
  'STL Transport': { logo: require('../../assets/logos/stl.png'), bus: require('../../assets/images/bus_stl.jpg') },
  'CA-TRANS': { logo: require('../../assets/logos/trans.png'), bus: require('../../assets/images/bus_trans.jpg') },
  'CA TRANS': { logo: require('../../assets/logos/trans.png'), bus: require('../../assets/images/bus_trans.jpg') },
  'TRANS': { logo: require('../../assets/logos/trans.png'), bus: require('../../assets/images/bus_trans.jpg') },
  'SITTI': { logo: require('../../assets/logos/sitti.png'), bus: require('../../assets/images/bus_sitti.jpg') },
  'SITTI Transport Terreste International': { logo: require('../../assets/images/bus_sitti.jpg'), bus: require('../../assets/images/bus_sitti.jpg') },
};

const FALLBACK_LOGO = require('../../assets/images/bus.jpg');
const FALLBACK_BUS = require('../../assets/images/bus.jpg');

const getAsset = (companyName: string, type: 'logo' | 'bus') => {
  if (!companyName) return type === 'logo' ? FALLBACK_LOGO : FALLBACK_BUS;
  if (COMPANY_ASSETS[companyName]?.[type]) return COMPANY_ASSETS[companyName][type];
  const norm = normalize(companyName);
  const foundKey = Object.keys(COMPANY_ASSETS).find(k => {
    const nk = normalize(k);
    return nk === norm || norm.includes(nk) || nk.includes(norm);
  });
  return foundKey ? COMPANY_ASSETS[foundKey][type] : (type === 'logo' ? FALLBACK_LOGO : FALLBACK_BUS);
};

export default function CompanyScreen() {
  const router = useRouter();
  const { name, color, id } = useLocalSearchParams();
  const { user, logout } = useAuthStore();
  const [companyData, setCompanyData] = useState<any>(null);
  const [garesCount, setGaresCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const companyId = (id as string) || '';
  const paramName = (name as string) || 'Compagnie';
  const paramColor = (color as string) || '#7C3AED';

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        if (companyId) {
          const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).single();
          if (!error && data) {
            setCompanyData(data);
            // compte des gares
            const { count } = await supabase.from('gares').select('id', { count: 'exact', head: true }).eq('company_id', data.id);
            setGaresCount(count || 0);
          } else {
            // fallback: cherche par nom
            const { data: byName } = await supabase.from('companies').select('*').ilike('name', `%${paramName}%`).limit(1).single();
            if (byName) {
              setCompanyData(byName);
              const { count } = await supabase.from('gares').select('id', { count: 'exact', head: true }).eq('company_id', byName.id);
              setGaresCount(count || 0);
            }
          }
        }
      } catch (e) {
        console.log('fetch company error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [companyId, paramName]);

  const companyName = companyData?.name || paramName;
  const companyColor = companyData?.color || companyData?.couleur || paramColor;
  const gareName = garesCount > 0 ? `${garesCount} gares` : companyData?.gare_name || 'PREMIUM';

  const userData = {
    name: user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur' : 'Invité',
    phone: user?.telephone || 'Non renseigné',
    email: user?.email || '',
  };

  const menuItems = [
    { icon: 'ticket', label: 'Achat tickets', desc: 'Réservez votre place en 2 min', color: '#FF6B35', lib: 'FontAwesome5' },
    { icon: 'people', label: 'Achat pour un tiers', desc: 'Offrez un billet à un proche', color: '#3B82F6', lib: 'Ionicons' },
    { icon: 'ticket-alt', label: 'Mes tickets', desc: 'Vos billets achetés et à venir', color: '#F59E0B', lib: 'FontAwesome5' },
    { icon: 'person', label: 'Mon profil', desc: 'Gérez vos informations', color: '#8B5CF6', lib: 'Ionicons' },
    { icon: 'wallet', label: 'Mon compte', desc: 'Solde et moyens de paiement', color: '#EF4444', lib: 'Ionicons' },
    { icon: 'chatbubbles', label: 'Retours client', desc: 'Donnez votre avis', color: '#10B981', lib: 'Ionicons' },
    { icon: 'call', label: "Centre d'appel", desc: 'Assistance 24/7', color: '#EC4899', lib: 'Ionicons' },
    { icon: 'document-text', label: 'Termes et conditions', desc: 'Règles et remboursements', color: '#6366F1', lib: 'Ionicons' },
    { icon: 'information-circle', label: 'A propos', desc: `À propos de ${companyName}`, color: '#14B8A6', lib: 'Ionicons' },
    { icon: 'share-social', label: "Partager l'application", desc: 'Parrainez vos amis', color: '#0EA5E9', lib: 'Ionicons' },
    { icon: 'log-out', label: 'Déconnexion', desc: 'Quitter votre compte', color: '#DC2626', lib: 'Ionicons' },
  ];

  const handlePress = (item: any) => {
    const realId = companyData?.id || companyId;
    switch(item.label) {
      case 'Achat tickets':
        router.push(`/buy-ticket?company=${encodeURIComponent(companyName)}&color=${encodeURIComponent(companyColor)}&id=${realId}` as any);
        break;
      case 'Achat pour un tiers':
        router.push(`/buy-ticket?company=${encodeURIComponent(companyName)}&color=${encodeURIComponent(companyColor)}&tier=true&id=${realId}` as any);
        break;
      case 'Mes tickets': router.push('/mes-tickets' as any); break;
      case 'Mon profil': router.push('/(tabs)/profile' as any); break;
      case 'Mon compte': router.push('/mon-compte' as any); break;
      case 'Déconnexion':
        Alert.alert('Déconnexion', `Au revoir ${userData.name.split(' ')[0]}!`, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Oui', onPress: async () => { await logout(); router.dismissAll(); setTimeout(() => router.replace('/(auth)/login' as any), 100); }, style: 'destructive' }
        ]);
        break;
      default: Alert.alert(item.label, item.desc);
    }
  };

  if (loading) {
    return <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}><ActivityIndicator size="large" color={companyColor} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={companyColor} />
      <View style={styles.headerContainer}>
        <Image source={getAsset(companyName, 'bus')} style={styles.headerBackgroundImage} resizeMode="cover" />
        <LinearGradient colors={[`${companyColor}E6`, `${companyColor}CC`, `${companyColor}99`]} style={styles.headerGradient}>
          <View style={styles.glassOverlay} />
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>{companyName}</Text>
                <View style={styles.premiumBadge}>
                  <Ionicons name="diamond" size={10} color="#FFF" />
                  <Text style={styles.premiumText}>{gareName}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={()=> Alert.alert('Appel', companyData?.telephone || 'Contact non disponible')}>
                <Ionicons name="call-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.brandBox}>
              <View style={styles.logoContainer}>
                <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} style={styles.logoGlow}>
                  <View style={styles.logoWrapper}>
                    <Image source={getAsset(companyName, 'logo')} style={styles.companyLogo} resizeMode="contain" />
                  </View>
                </LinearGradient>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.welcome}>Bienvenue</Text>
                <Text style={styles.userName}>{userData.name}</Text>
                <View style={styles.phoneRow}>
                  <Ionicons name="call" size={12} color="rgba(255,255,0.8)" />
                  <Text style={styles.userPhone}>{userData.phone}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuList}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.menuItem} onPress={() => handlePress(item)} activeOpacity={0.7}>
              <LinearGradient colors={[`${item.color}20`, `${item.color}10`]} style={styles.iconBox}>
                {item.lib === 'FontAwesome5'? <FontAwesome5 name={item.icon as any} size={20} color={item.color} /> : <Ionicons name={item.icon as any} size={22} color={item.color} />}
              </LinearGradient>
              <View style={styles.textBox}><Text style={styles.label}>{item.label}</Text><Text style={styles.desc}>{item.desc}</Text></View>
              <View style={styles.chevronBox}><Ionicons name="chevron-forward" size={18} color="#D1D5DB" /></View>
            </TouchableOpacity>
          ))}
        </View>
        <LinearGradient colors={['#FFFBEB', '#FEF3C7']} style={styles.tip}>
          <View style={styles.tipIcon}><MaterialIcons name="lightbulb" size={20} color="#F59E0B" /></View>
          <Text style={styles.tipText}>Réservez 24h à l'avance pour garantir votre place avec {companyName}</Text>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerContainer: { paddingBottom: 35, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', height: 240 },
  headerBackgroundImage: { position: 'absolute', width: '100%', height: '100%', opacity: 0.85 },
  headerGradient: { flex: 1, paddingBottom: 35 },
  glassOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, marginBottom: 24 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  callBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  premiumText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  brandBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 16 },
  logoContainer: { position: 'relative' },
  logoGlow: { width: 88, height: 88, borderRadius: 24, justifyContent: 'center', alignItems: 'center', padding: 3 },
  logoWrapper: { width: 82, height: 82, borderRadius: 21, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 8, padding: 10 },
  companyLogo: { width: '100%', height: '100%' },
  userInfo: { flex: 1 },
  welcome: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: '900', color: '#FFF', textTransform: 'capitalize', marginBottom: 6 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userPhone: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  content: { flex: 1, marginTop: -20 },
  menuList: { paddingTop: 24, paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 18, marginBottom: 12, elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  iconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textBox: { flex: 1 },
  label: { fontSize: 16, fontWeight: '800', color: '#1D1D1F', marginBottom: 3 },
  desc: { fontSize: 13, color: '#86868B' },
  chevronBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, marginBottom: 40, padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: '#FDE68A' },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center' },
  tipText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '700', lineHeight: 19 },
});