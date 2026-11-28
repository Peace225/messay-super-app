import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { otpAuthService } from '../services/otpAuthService';
import { useAuthStore } from '../store/authStore';

type Step = 0 | 1 | 2;
const ORANGE = '#FF7900';
const PHONE_REGEX = /^(?:0[157]\d{8})$/;

function normalizeIvoryCoastPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('225') && digits.length === 13) digits = digits.slice(3);
  return PHONE_REGEX.test(digits) ? `+225${digits}` : null;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const remote = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    const message = remote?.message ?? remote?.error;
    if (status === 404 || status === 501) return 'La vérification SMS n’est pas encore activée sur le serveur MESSAY.';
    if (status === 429) return 'Trop de tentatives. Réessayez après le délai indiqué.';
    if (status === 400 || status === 401 || status === 422) return typeof message === 'string' ? message : 'Code invalide ou expiré.';
    if (!error.response) return 'Connexion au serveur impossible. Vérifiez Internet et réessayez.';
    return typeof message === 'string' ? message : 'Le serveur MESSAY ne peut pas traiter cette demande.';
  }
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuthStore(state => state.setSession);
  const [step, setStep] = useState<Step>(0);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const inFlight = useRef(false);
  const slide = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const glowFloat = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [transitioning, setTransitioning] = useState(false);
  const changingStep = useRef(false);

  useEffect(() => {
    const logoLoop = Animated.loop(Animated.sequence([
      Animated.timing(logoScale, { toValue: 1.07, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const ambientLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowFloat, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowFloat, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    logoLoop.start();
    ambientLoop.start();
    return () => { logoLoop.stop(); ambientLoop.stop(); };
  }, [logoScale, glowFloat]);

  const goToStep = useCallback((target: Step) => {
    if (changingStep.current || target === step) return;
    changingStep.current = true;
    setTransitioning(true);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slide, { toValue: target > step ? -28 : 28, duration: 150, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) { changingStep.current = false; setTransitioning(false); return; }
      slide.setValue(target > step ? 34 : -34);
      setStep(target);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, speed: 16, bounciness: 5, useNativeDriver: true }),
        Animated.timing(progressAnimation, { toValue: target, duration: 420, useNativeDriver: false }),
      ]).start(() => { changingStep.current = false; setTransitioning(false); });
    });
  }, [opacity, progressAnimation, slide, step]);

  const requestCode = useCallback(async (resend = false) => {
    if (inFlight.current) return;
    const formatted = normalizeIvoryCoastPhone(telephone);
    if (!formatted) {
      Alert.alert('Numéro invalide', 'Saisissez un numéro mobile ivoirien valide à 10 chiffres.');
      return;
    }
    if (resend && Date.now() < resendAfter) {
      Alert.alert('Veuillez patienter', 'Un code a déjà été demandé récemment.');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      const result = await otpAuthService.requestCode(formatted);
      setVerifiedPhone(formatted);
      setCode('');
      setResendAfter(Date.now() + Math.max(30, result.retryAfterSeconds ?? 60) * 1000);
      goToStep(2);
      Alert.alert('SMS demandé', `Saisissez le code reçu au ${formatted} dès sa réception.`);
    } catch (error) {
      Alert.alert('SMS non envoyé', errorMessage(error));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [telephone, resendAfter, goToStep]);

  const verify = useCallback(async () => {
    if (inFlight.current) return;
    if (!verifiedPhone || verifiedPhone !== normalizeIvoryCoastPhone(telephone)) {
      Alert.alert('Numéro modifié', 'Demandez un nouveau code pour votre numéro.');
      goToStep(1);
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Code incomplet', 'Entrez les six chiffres reçus par SMS.');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      // Le serveur doit vérifier le code à usage unique et créer un USER,
      // sans accepter un rôle transmis depuis le téléphone.
      const result = await otpAuthService.verifyAndRegister({
        telephone: verifiedPhone,
        code,
        nom: nom.trim(),
      });
      // Le backend a confirmé l'OTP et retourné utilisateur + access/refresh tokens.
      // Enregistrer la session complète AVANT de naviguer vers l'accueil.
      await setSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setCode('');
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Vérification impossible', errorMessage(error));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [code, nom, router, telephone, verifiedPhone, goToStep, setSession]);

  const next = () => {
    if (transitioning) return;
    if (step === 0) {
      if (nom.trim().length < 2) return Alert.alert('Nom requis', 'Entrez votre nom complet.');
      goToStep(1);
    } else if (step === 1) {
      void requestCode();
    } else {
      void verify();
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0A1223', '#111D34', '#0A1223']} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[styles.orbTop, {
        transform: [{ translateY: glowFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }],
        opacity: glowFloat.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.30] }),
      }]} />
      <Animated.View pointerEvents="none" style={[styles.orbBottom, {
        transform: [{ translateY: glowFloat.interpolate({ inputRange: [0, 1], outputRange: [20, -20] }) }],
      }]} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.brandIcon, { transform: [{ scale: logoScale }] }]}><Ionicons name="flash" size={30} color="white" /></Animated.View>
          <Text style={styles.brand}>MESSAY</Text>
          <Text style={styles.slogan}>Votre mobilité commence ici</Text>
          <View style={styles.progress}>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.progressPart}>
                <Animated.View style={[styles.progressFill, {
                  width: progressAnimation.interpolate({
                    inputRange: [i - 1, i], outputRange: ['0%', '100%'], extrapolate: 'clamp',
                  }),
                }]} />
              </View>
            ))}
          </View>
          <Animated.View style={{ opacity, transform: [{ translateX: slide }] }}>
          <Text style={styles.stepLabel}>ÉTAPE {step + 1} SUR 3</Text>
          <Text style={styles.heading}>{step === 0 ? 'Comment vous appelez-vous ?' : step === 1 ? 'Votre numéro de téléphone' : 'Vérifiez votre numéro'}</Text>
          <Text style={styles.description}>{step === 0 ? 'Votre nom sera utilisé pour vos réservations.' : step === 1 ? 'Nous vous enverrons un code SMS pour sécuriser votre compte.' : `Entrez le code à 6 chiffres envoyé au ${verifiedPhone ?? ''}.`}</Text>
          <View style={styles.card}>
            {step === 0 && <View><Text style={styles.label}>Nom complet</Text><TextInput style={styles.input} placeholder="Ex. Aminata Koné" placeholderTextColor="#7D8DA9" value={nom} onChangeText={setNom} autoCapitalize="words" maxLength={100} autoCorrect={false} editable={!loading} autoFocus /></View>}
            {step === 1 && <View><Text style={styles.label}>Téléphone mobile</Text><View style={styles.phoneRow}><Text style={styles.prefix}>+225</Text><TextInput style={[styles.input, styles.phoneInput]} placeholder="07 00 00 00 00" placeholderTextColor="#7D8DA9" keyboardType="phone-pad" value={telephone} onChangeText={setTelephone} maxLength={20} editable={!loading} autoComplete="tel" /></View></View>}
            {step === 2 && <View><Text style={styles.label}>Code reçu par SMS</Text><TextInput style={[styles.input, styles.otpInput]} placeholder="000000" placeholderTextColor="#7D8DA9" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} maxLength={6} editable={!loading} />
              <TouchableOpacity disabled={loading || transitioning} onPress={() => void requestCode(true)} style={styles.resend}><Text style={styles.link}>Renvoyer le code</Text></TouchableOpacity>
            </View>}
            <TouchableOpacity disabled={loading || transitioning} onPress={next} accessibilityRole="button" style={styles.action}>
              <LinearGradient colors={['#FF8C00', '#F97316']} style={styles.actionGradient}>
                {loading ? <ActivityIndicator color="white" /> : <><Text style={styles.actionText}>{step === 0 ? 'SUIVANT' : step === 1 ? 'RECEVOIR MON CODE' : 'VALIDER MON CODE'}</Text><Ionicons name="arrow-forward" size={20} color="white" /></>}
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.bottomNav}>
              {step > 0 && <TouchableOpacity disabled={loading || transitioning} onPress={() => { goToStep(step === 2 ? 1 : 0); setCode(''); }}><Text style={styles.link}>← Retour</Text></TouchableOpacity>}
              <TouchableOpacity disabled={loading || transitioning} onPress={() => router.replace('/(auth)/login')}><Text style={styles.secondary}>Accès conducteur / admin <Text style={styles.link}>Connexion</Text></Text></TouchableOpacity>
            </View>
          </View>
          </Animated.View>
          <Text style={styles.foot}>Inscription passager • Aucun mot de passe requis</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1223' }, flex: { flex: 1 },
  orbTop: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: '#F97316', top: -150, right: -120 },
  orbBottom: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#334EA7', opacity: 0.16, bottom: -150, left: -100 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  brandIcon: { backgroundColor: '#F97316', width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  brand: { textAlign: 'center', color: '#FFFFFF', fontWeight: '900', fontSize: 32, letterSpacing: 3 },
  slogan: { textAlign: 'center', color: '#CBD5E1', marginTop: 6, marginBottom: 30 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  progressPart: { flex: 1, height: 5, borderRadius: 8, backgroundColor: '#334155', overflow: 'hidden' },
  progressFill: { backgroundColor: '#F97316', height: '100%', borderRadius: 8 },
  progressActive: { backgroundColor: '#F97316' }, stepLabel: { color: '#FDBA74', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heading: { color: 'white', fontSize: 24, fontWeight: '800', marginTop: 9, marginBottom: 7 },
  description: { color: '#94A3B8', fontSize: 14, lineHeight: 21, marginBottom: 22 },
  card: { borderRadius: 24, backgroundColor: '#14223A', borderWidth: 1, borderColor: '#283A57', padding: 22 },
  label: { fontSize: 12, fontWeight: '700', color: '#CBD5E1', marginBottom: 9 },
  input: { height: 58, borderRadius: 13, borderWidth: 1, borderColor: '#44536B', backgroundColor: '#0A1629', paddingHorizontal: 15, color: 'white', fontSize: 16 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefix: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, phoneInput: { flex: 1 },
  otpInput: { letterSpacing: 9, fontWeight: '800', textAlign: 'center', fontSize: 24 },
  resend: { alignItems: 'center', paddingVertical: 16 }, link: { color: '#FDBA74', fontSize: 13, fontWeight: '800' },
  action: { borderRadius: 14, overflow: 'hidden', marginTop: 22 },
  actionGradient: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionText: { color: 'white', fontWeight: '900', fontSize: 14 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  secondary: { color: '#CBD5E1', fontSize: 12 }, foot: { color: '#64748B', textAlign: 'center', marginTop: 25, fontSize: 12 },
});
