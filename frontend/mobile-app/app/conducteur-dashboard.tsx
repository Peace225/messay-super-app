// app/conducteur-dashboard.tsx
import ConducteurCoursesScreen from '../src/screens/ConducteurCoursesScreen';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Page() {
  const { isLoading, isAuthenticated } = useAuthStore();

  // 🛡️ TANT QUE LE STORE CHARGE, ON BLOQUE TOUT
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  // Si on n'est pas authentifié, le layout nous redirigera, on ne rend rien
  if (!isAuthenticated) return null;

  return <ConducteurCoursesScreen />;
}