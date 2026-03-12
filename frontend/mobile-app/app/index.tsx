import { useEffect } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const router = useRouter();
  // On récupère l'état de la navigation
  const rootNavigationState = useRootNavigationState();
  const { isLoading } = useAuthStore();

  useEffect(() => {
    // 1. Si la navigation n'est pas encore montée, on s'arrête ici et on attend
    if (!rootNavigationState?.key) return;

    // 2. Si la navigation est prête ET que le store a fini de charger
    if (!isLoading) {
      // Toujours rediriger vers l'accueil, authentifié ou non
      router.replace('/(tabs)/home');
    }
  }, [isLoading, rootNavigationState?.key]); // On écoute ces deux variables

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5' }}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );
}