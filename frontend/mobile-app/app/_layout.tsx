import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';
import PushRegistrationBridge from '../src/components/PushRegistrationBridge';
import { View, ActivityIndicator, Text } from 'react-native';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { loadAuthData, isLoading, isAuthenticated, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    void loadAuthData();
  }, [loadAuthData]);

  useEffect(() => {
    const isNavReady = navigationState?.key;
    if (isLoading || !isNavReady) return;

    const rootSegment = segments[0];
    const inAuthGroup = rootSegment === '(auth)';
    const inTabsGroup = rootSegment === '(tabs)';
    const inDashboard = rootSegment === 'conducteur-dashboard' ||
                       rootSegment === 'chauffeur-dashboard';

    // Non connecté : préserver l'accès public ; protéger les dashboards.
    if (!isAuthenticated) {
      if (inDashboard) {
        console.log('🔒 Dashboard protégé -> Redirection Login');
        router.replace('/login');
      }
      return;
    }

    if (user) {
      const role = user.role;
      if (inAuthGroup) {
        console.log(`✅ Déjà connecté [${role}] -> Home`);
        router.replace('/(tabs)/home');
        return;
      }
      if (role === 'CONDUCTEUR' && rootSegment !== 'conducteur-dashboard') {
        if (inTabsGroup) router.replace('/conducteur-dashboard');
      } else if (role === 'CHAUFFEUR' && rootSegment !== 'chauffeur-dashboard') {
        if (inTabsGroup) router.replace('/chauffeur-dashboard');
      }
    }
  }, [isAuthenticated, user, segments, isLoading, navigationState?.key, router]);

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
      <PushRegistrationBridge />
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
