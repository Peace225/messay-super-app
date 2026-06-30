import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator, Text } from 'react-native';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { loadAuthData, isLoading, isAuthenticated, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // 1. Chargement initial des données de session au démarrage
  useEffect(() => {
    loadAuthData();
  }, []);

  // 2. Gardien de la navigation (Logique de redirection)
  useEffect(() => {
    // On attend que le moteur de navigation et les données soient prêts
    const isNavReady = navigationState?.key;
    if (isLoading || !isNavReady) return;

    const rootSegment = segments[0];
    const inAuthGroup = rootSegment === '(auth)';
    const inTabsGroup = rootSegment === '(tabs)';

    // 🛡️ CAS 1 : UTILISATEUR NON CONNECTÉ
    if (!isAuthenticated) {
      if (!inAuthGroup) {
        console.log("🔒 Accès refusé -> Redirection Login");
        router.replace('/login');
      }
      return; 
    }

    // 🛡️ CAS 2 : UTILISATEUR CONNECTÉ (Aiguillage par rôle)
    if (isAuthenticated && user) {
      const role = user.role;
      console.log(`👤 Utilisateur connecté [${role}] sur le segment : /${rootSegment || ''}`);

      // Logique pour CONDUCTEUR (Moussa)
      if (role === 'CONDUCTEUR') {
        if (rootSegment !== 'conducteur-dashboard') {
          console.log("🛺 Redirection -> Dashboard Conducteur");
          router.replace('/conducteur-dashboard');
        }
      } 
      // Logique pour CHAUFFEUR (Ibrahim)
      else if (role === 'CHAUFFEUR') {
        if (rootSegment !== 'chauffeur-dashboard') {
          console.log("🚚 Redirection -> Dashboard Chauffeur");
          router.replace('/chauffeur-dashboard');
        }
      } 
      // Logique pour USER / CLIENT (Le rôle par défaut dans Supabase)
      else if (role === 'USER' || role === 'CLIENT') {
        if (inAuthGroup || rootSegment === undefined || rootSegment === 'index') {
          console.log("📱 Redirection -> Home Client (Tabs)");
          router.replace('/home');
        }
      }
    }
  }, [isAuthenticated, user, segments, isLoading, navigationState?.key]);

  // Écran de Splash Screen Premium
  if (isLoading || !navigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050810' }}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={{ color: '#94a3b8', marginTop: 20, fontWeight: '700', letterSpacing: 1 }}>
          MESSAY LOGISTICS
        </Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conducteur-dashboard" options={{ gestureEnabled: false }} />
        <Stack.Screen name="chauffeur-dashboard" options={{ gestureEnabled: false }} />
      </Stack>
    </QueryClientProvider>
  );
}