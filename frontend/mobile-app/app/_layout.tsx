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

  useEffect(() => {
    loadAuthData();
  }, []);

  useEffect(() => {
    const isNavReady = navigationState?.key;
    if (isLoading ||!isNavReady) return;

    const rootSegment = segments[0];
    const inAuthGroup = rootSegment === '(auth)';
    const inTabsGroup = rootSegment === '(tabs)';
    const inDashboard = rootSegment === 'conducteur-dashboard' ||
                       rootSegment === 'chauffeur-dashboard';

    // 🛡 CAS 1 : UTILISATEUR NON CONNECTÉ
    if (!isAuthenticated) {
      // ✅ AUTORISE l'accès à l'accueil et aux services
      // ❌ BLOQUE seulement les dashboards
      if (inDashboard) {
        console.log("🔒 Dashboard protégé -> Redirection Login");
        router.replace('/login');
      }
      // Plus de redirection forcée! Laisse l'utilisateur naviguer
      return;
    }

    // 🛡 CAS 2 : UTILISATEUR CONNECTÉ
    if (isAuthenticated && user) {
      const role = user.role;

      // Si connecté et sur login/register → redirige vers home
      if (inAuthGroup) {
        console.log(`✅ Déjà connecté [${role}] -> Home`);
        router.replace('/(tabs)/home');
        return;
      }

      // Aiguillage par rôle pour les dashboards
      if (role === 'CONDUCTEUR' && rootSegment!== 'conducteur-dashboard') {
        if (inTabsGroup) { // Évite boucle si déjà sur dashboard
          router.replace('/conducteur-dashboard');
        }
      }
      else if (role === 'CHAUFFEUR' && rootSegment!== 'chauffeur-dashboard') {
        if (inTabsGroup) {
          router.replace('/chauffeur-dashboard');
        }
      }
    }
  }, [isAuthenticated, user, segments, isLoading, navigationState?.key]);

  if (isLoading ||!navigationState?.key) {
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
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conducteur-dashboard" options={{ gestureEnabled: false }} />
        <Stack.Screen name="chauffeur-dashboard" options={{ gestureEnabled: false }} />
        
      </Stack>
    </QueryClientProvider>
  );
}