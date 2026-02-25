import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';

export default function TabsLayout() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'USER';

  // Navigation pour les conducteurs
  if (userRole === 'CONDUCTEUR') {
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
          name="conducteur-courses"
          options={{
            title: 'Mes Courses',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🛺</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
          }}
        />
        <Tabs.Screen name="tricycle" options={{ href: null }} />
        <Tabs.Screen name="tickets" options={{ href: null }} />
        <Tabs.Screen name="btp" options={{ href: null }} />
        <Tabs.Screen name="chauffeur-livraisons" options={{ href: null }} />
      </Tabs>
    );
  }

  // Navigation pour les chauffeurs
  if (userRole === 'CHAUFFEUR') {
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
          name="chauffeur-livraisons"
          options={{
            title: 'Mes Livraisons',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🚚</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
          }}
        />
        <Tabs.Screen name="tricycle" options={{ href: null }} />
        <Tabs.Screen name="tickets" options={{ href: null }} />
        <Tabs.Screen name="btp" options={{ href: null }} />
        <Tabs.Screen name="conducteur-courses" options={{ href: null }} />
      </Tabs>
    );
  }

  // Navigation par défaut pour les utilisateurs normaux
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
          title: 'Transport',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🚌</Text>,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Événements',
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
          href: null,
        }}
      />
      <Tabs.Screen name="conducteur-courses" options={{ href: null }} />
      <Tabs.Screen name="chauffeur-livraisons" options={{ href: null }} />
    </Tabs>
  );
}

