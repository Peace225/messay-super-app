import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator } from 'react-native';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { loadAuthData, isLoading, isAuthenticated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // 1. Charger les données d'auth au démarrage
  useEffect(() => {
    loadAuthData();
  }, []);

  // 2. Gérer la navigation protégée
  useEffect(() => {
    if (isLoading) return; // On ne fait rien tant que ça charge

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Si l'utilisateur n'est pas connecté et n'est pas sur les pages de login/register
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Si l'utilisateur est connecté mais se trouve encore sur le login
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, segments, isLoading]);

  // Écran de chargement Premium pendant la vérification du token
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* On définit les groupes de routes */}
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
    </QueryClientProvider>
  );
}