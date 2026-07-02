import { Redirect } from 'expo-router';

export default function Index() {
  // 👈 Redirige direct vers l'app, pas de login
  return <Redirect href="/(tabs)/home" />;
}