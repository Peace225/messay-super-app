import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="tricycle"
        options={{
          title: 'Tricycle',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🛺</Text>,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🎟️</Text>,
        }}
      />
      <Tabs.Screen
        name="btp"
        options={{
          title: 'Lacarrière',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🚜</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Cache le profil de la navigation
        }}
      />
    </Tabs>
  );
}
