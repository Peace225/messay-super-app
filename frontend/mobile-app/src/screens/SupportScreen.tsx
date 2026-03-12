import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const TYPES_DEMANDE = [
  { id: 'TECHNIQUE', nom: 'Problème technique', icon: 'wrench' },
  { id: 'OBJET_PERDU', nom: 'Objet perdu', icon: 'search' },
  { id: 'LITIGE', nom: 'Litige Course', icon: 'balance-scale' },
  { id: 'QUESTION', nom: 'Question Générale', icon: 'question-circle' },
  { id: 'RECLAMATION', nom: 'Réclamation', icon: 'exclamation-triangle' },
  { id: 'AUTRE', nom: 'Autre demande', icon: 'comments' },
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
      Alert.alert('Accès restreint', 'Connectez-vous pour ouvrir un ticket de conciergerie.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Connexion', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (!selectedType || !sujet.trim() || !description.trim()) {
      Alert.alert('Information manquante', 'Veuillez détailler votre demande pour un traitement rapide.');
      return;
    }

    setLoading(true);

    try {
      // Simulation d'appel API
      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Demande Envoyée ✨',
          'Notre équipe Élite a reçu votre ticket et vous répondra sous peu.',
          [
            {
              text: 'Compris',
              onPress: () => {
                setSelectedType(null);
                setSujet('');
                setDescription('');
                router.back();
              },
            },
          ]
        );
      }, 1500);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Erreur', 'Impossible d\'envoyer le ticket actuellement.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* HEADER ELITE CONCIERGERIE */}
        <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.headerPro}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtnDark}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitlePro}>Conciergerie</Text>
              <View style={{ width: 45 }} />
            </View>
            <View style={styles.headerTextContainer}>
              <MaterialCommunityIcons name="headset" size={48} color="#FF6B35" style={{ marginBottom: 15 }} />
              <Text style={styles.headerMainText}>Comment pouvons-nous vous assister aujourd{"'"}hui ?</Text>
              <Text style={styles.headerSubText}>Une équipe dédiée disponible 24/7 pour nos membres Élite.</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          
          {/* SÉLECTION DU TYPE DE DEMANDE */}
          <View style={styles.sectionPro}>
            <Text style={styles.sectionLabelPro}>Nature de la demande</Text>
            <View style={styles.gridContainer}>
              {TYPES_DEMANDE.map((type) => {
                const isActive = selectedType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedType(type.id)}
                    style={[styles.tileCard, isActive && styles.tileCardActive]}
                  >
                    <View style={[styles.iconCircle, isActive && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <FontAwesome5 name={type.icon} size={18} color={isActive ? 'white' : '#FF6B35'} />
                    </View>
                    <Text style={[styles.tileText, isActive && { color: 'white' }]}>{type.nom}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* FORMULAIRE DE DÉTAILS (CORRIGÉ AVEC TERNAIRE STRICT) */}
          {selectedType !== null ? (
            <View style={styles.formSection}>
              <Text style={styles.sectionLabelPro}>Détails de l{"'"}incident</Text>
              
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Sujet principal</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Objet oublié dans le tricycle"
                  placeholderTextColor="#94a3b8"
                  value={sujet}
                  onChangeText={setSujet}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Explication détaillée</Text>
                <TextInput
                  style={[styles.inputField, styles.textAreaField]}
                  placeholder="Décrivez précisément votre situation pour que nous puissions agir vite..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtnContainer}
                onPress={handleSubmit}
                disabled={loading}
              >
                <LinearGradient 
                  colors={['#FF6B35', '#FF8E64']} 
                  start={{x:0, y:0}} end={{x:1, y:0}}
                  style={styles.submitGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Text style={styles.submitBtnText}>Soumettre le ticket</Text>
                      <Ionicons name="paper-plane" size={18} color="white" style={{ marginLeft: 10 }} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* CONTACTS RAPIDES URGENCE */}
          <View style={styles.contactSection}>
            <Text style={styles.sectionLabelPro}>Contacts directs</Text>
            
            <TouchableOpacity style={styles.quickContactCard} activeOpacity={0.8}>
              <View style={styles.quickContactIcon}>
                <Ionicons name="call" size={22} color="#FF6B35" />
              </View>
              <View style={styles.quickContactTextInfo}>
                <Text style={styles.quickContactTitle}>Ligne d{"'"}Urgence</Text>
                <Text style={styles.quickContactValue}>+225 07 00 00 00 00</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickContactCard} activeOpacity={0.8}>
              <View style={[styles.quickContactIcon, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="mail" size={22} color="#0EA5E9" />
              </View>
              <View style={styles.quickContactTextInfo}>
                <Text style={styles.quickContactTitle}>Support par Email</Text>
                <Text style={styles.quickContactValue}>concierge@messay.ci</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>

          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerPro: { paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, elevation: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtnDark: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitlePro: { fontSize: 18, fontWeight: '900', color: 'white', letterSpacing: 0.5 },
  headerTextContainer: { paddingHorizontal: 30, marginTop: 30, alignItems: 'center' },
  headerMainText: { fontSize: 24, fontWeight: '900', color: 'white', textAlign: 'center', lineHeight: 32 },
  headerSubText: { fontSize: 14, color: '#cbd5e1', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  content: { padding: 20, marginTop: 10 },
  sectionPro: { marginBottom: 30 },
  sectionLabelPro: { fontSize: 13, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 15, marginLeft: 5 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tileCard: { width: '48%', backgroundColor: 'white', borderRadius: 20, padding: 18, marginBottom: 15, alignItems: 'flex-start', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  tileCardActive: { backgroundColor: '#FF6B35', elevation: 10, shadowColor: '#FF6B35' },
  iconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF5F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  tileText: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  formSection: { backgroundColor: 'white', padding: 25, borderRadius: 30, marginBottom: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 5 },
  inputField: { backgroundColor: '#F8FAFC', borderRadius: 18, paddingHorizontal: 20, height: 60, fontSize: 15, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  textAreaField: { height: 130, paddingTop: 20 },
  submitBtnContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 10, elevation: 8, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10 },
  submitGradient: { height: 65, justifyContent: 'center', alignItems: 'center' },
  btnContentRow: { flexDirection: 'row', alignItems: 'center' },
  submitBtnText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  contactSection: { marginBottom: 20 },
  quickContactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03 },
  quickContactIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFF5F2', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  quickContactTextInfo: { flex: 1 },
  quickContactTitle: { fontSize: 12, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  quickContactValue: { fontSize: 16, fontWeight: '900', color: '#1e293b' }
});