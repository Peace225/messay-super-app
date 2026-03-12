import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// --- CONFIGURATION DES MOYENS DE PAIEMENT ---
const MOYENS_PAIEMENT = [
  { id: 'ORANGE_MONEY', nom: 'Orange Money', logo: require('../../assets/images/payment/orange.png'), color: '#FF7900', desc: 'Paiement instantané' },
  { id: 'MTN_MOMO', nom: 'MTN MoMo', logo: require('../../assets/images/payment/mtn.png'), color: '#FFCC00', desc: 'Simple et rapide' },
  { id: 'WAVE', nom: 'Wave Mobile', logo: require('../../assets/images/payment/wave.png'), color: '#2196F3', desc: 'Frais minimes' },
  { id: 'MOOV', nom: 'Moov Africa', logo: require('../../assets/images/payment/moov.png'), color: '#005CAB', desc: 'Réseau fiable' },
  { id: 'ESPECES', nom: 'Espèces', icon: 'payments', color: '#4CAF50', desc: 'Directement au chauffeur' },
];

export default function PaiementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const montant = params.montant ? parseFloat(params.montant as string) : 0;
  const type = (params.type as string) || 'Service MESSAY';
  
  const [selectedMoyen, setSelectedMoyen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Correction : Déclaration de useRef pour l'animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 800, 
      useNativeDriver: true 
    }).start();
  }, []);

  const handlePaiement = async () => {
    if (!selectedMoyen) return;
    setLoading(true);

    // Simulation de traitement Elite
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Opération Réussie ✨',
        `Votre règlement de ${montant.toLocaleString()} FCFA a été traité avec succès.`,
        [{ text: 'Terminer', onPress: () => router.back() }]
      );
    }, 2500);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* HEADER ZÉNITH 7D */}
        <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.navBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.glassBack}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.navTitle}>Paiement Sécurisé</Text>
              <View style={{ width: 45 }} />
            </View>

            <Animated.View style={[styles.summaryContainer, { opacity: fadeAnim }]}>
              <Text style={styles.summarySub}>{type}</Text>
              <View style={styles.amountContainer}>
                 <Text style={styles.amountValue}>{montant.toLocaleString()}</Text>
                 <Text style={styles.currency}>FCFA</Text>
              </View>
              <View style={styles.secureBadge}>
                 <Ionicons name="shield-checkmark" size={14} color="#22C55E" />
                 <Text style={styles.secureBadgeText}>PROTECTION MESSAY PAY ACTIVÉE</Text>
              </View>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Moyens de paiement</Text>
          
          {MOYENS_PAIEMENT.map((moyen) => (
            <TouchableOpacity
              key={moyen.id}
              activeOpacity={0.7}
              onPress={() => setSelectedMoyen(moyen.id)}
              style={[
                styles.methodCard,
                selectedMoyen === moyen.id && { borderColor: moyen.color, backgroundColor: 'white', elevation: 8, shadowColor: moyen.color }
              ]}
            >
              <View style={styles.methodMain}>
                <View style={[styles.iconContainer, { backgroundColor: selectedMoyen === moyen.id ? `${moyen.color}15` : '#F1F5F9' }]}>
                   {moyen.logo ? (
                     <Image source={moyen.logo} style={styles.methodLogo} resizeMode="contain" />
                   ) : (
                     <MaterialIcons name={moyen.icon as any} size={24} color={moyen.color} />
                   )}
                </View>
                <View style={styles.methodTexts}>
                    <Text style={[styles.methodName, selectedMoyen === moyen.id && { color: '#0f172a' }]}>{moyen.nom}</Text>
                    <Text style={styles.methodDesc}>{moyen.desc}</Text>
                </View>
              </View>
              
              <View style={[
                styles.radioCircle,
                selectedMoyen === moyen.id && { borderColor: moyen.color, backgroundColor: moyen.color }
              ]}>
                {selectedMoyen === moyen.id && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* FOOTER GLASSMORPHISM FIXE */}
      <View style={styles.footer}>
        <LinearGradient 
          colors={['rgba(255,255,255,0.95)', 'white']} 
          style={styles.footerGradient}
        >
          <TouchableOpacity
            style={[styles.payBtn, !selectedMoyen && styles.payBtnDisabled]}
            onPress={handlePaiement}
            disabled={!selectedMoyen || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <LinearGradient 
                colors={selectedMoyen ? ['#FF6B35', '#FF8E64'] : ['#cbd5e1', '#cbd5e1']}
                start={{x:0, y:0}} end={{x:1, y:0}}
                style={styles.payBtnGradient}
              >
                <Text style={styles.payBtnText}>Confirmer le règlement</Text>
                <Ionicons name="lock-closed" size={18} color="white" style={{marginLeft: 10}} />
              </LinearGradient>
            )}
          </TouchableOpacity>
          <Text style={styles.secureText}>Garantie de sécurité MESSAY Group</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 45, borderBottomLeftRadius: 45, borderBottomRightRadius: 45, elevation: 15 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  glassBack: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  navTitle: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  
  summaryContainer: { alignItems: 'center', marginTop: 35 },
  summarySub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  amountContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  amountValue: { color: 'white', fontSize: 52, fontWeight: '900' },
  currency: { color: '#FF6B35', fontSize: 20, fontWeight: '900', marginLeft: 8, marginBottom: 12 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, marginTop: 25 },
  secureBadgeText: { color: '#22C55E', fontSize: 10, fontWeight: '900', marginLeft: 8, letterSpacing: 1.2 },

  content: { padding: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  methodMain: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  methodLogo: { width: 42, height: 42 },
  methodTexts: { marginLeft: 16 },
  methodName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  methodDesc: { fontSize: 12, color: '#94a3b8', marginTop: 3, fontWeight: '600' },
  radioCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerGradient: { padding: 25, paddingBottom: 40, borderTopLeftRadius: 40, borderTopRightRadius: 40, elevation: 25 },
  payBtn: { height: 68, borderRadius: 22, overflow: 'hidden' },
  payBtnDisabled: { opacity: 0.6 },
  payBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  payBtnText: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  secureText: { textAlign: 'center', marginTop: 15, color: '#cbd5e1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }
});