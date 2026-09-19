import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import ProfileScreen from '../../src/screens/ProfileScreen';

export default function ProfileTab() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, user]);

  // NE REND PAS ProfileScreen si pas connecté
  if (!isAuthenticated || !user) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#F0F2F5'}}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return <ProfileScreen />;
}