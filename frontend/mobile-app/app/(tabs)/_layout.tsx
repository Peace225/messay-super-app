
import { Tabs } from 'expo-router';
import { Image, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';

// ============================================================
// MESSAY MOBILE - NAVIGATION PAR ONGLETS
// ============================================================

const TRICYCLE_ICON = require('../../assets/images/tricycle.png');

// ============================================================
// TYPES
// ============================================================

interface AnimatedTabIconProps {
  focused: boolean;
  children: ReactNode;
}

// ============================================================
// COMPOSANT - ICÔNE ANIMÉE
// ============================================================

function AnimatedTabIcon({
  focused,
  children,
}: AnimatedTabIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.2 : 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }),
      Animated.spring(translateY, {
        toValue: focused ? -8 : 0,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [focused, scale, translateY]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale },
          { translateY },
        ],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Cercle lumineux de l'onglet actif */}
      {focused && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: '#FF6B35',
            opacity: 0.15,
          }}
        />
      )}

      {children}
    </Animated.View>
  );
}

// ============================================================
// NAVIGATION PRINCIPALE
// ============================================================

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarShowLabel: false,

        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#9CA3AF',

        // Masquer la barre lors de la saisie au clavier
        tabBarHideOnKeyboard: true,

        // Barre flottante premium
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: 16,
          height: 72,
          backgroundColor: '#FFFFFF',
          borderRadius: 36,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          paddingBottom: 0,
          paddingTop: 8,
        },
      }}
    >
      {/* ====================================================
          1. ACCUEIL
      ==================================================== */}

      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={26}
                color={typeof color === 'string' ? color : '#64748b'}
              />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* ====================================================
          2. TRANSPORT PAR TRICYCLE
      ==================================================== */}

      <Tabs.Screen
        name="tricycle"
        options={{
          title: 'Tricycle',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Image
                source={TRICYCLE_ICON}
                style={{
                  width: 32,
                  height: 32,
                  opacity: focused ? 1 : 0.5,
                  tintColor: focused
                    ? undefined
                    : '#9CA3AF',
                }}
                resizeMode="contain"
                accessibilityLabel="Transport par tricycle"
              />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* ====================================================
          3. BILLETS INTERURBAINS
      ==================================================== */}

      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Billets de bus',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? 'bus' : 'bus-outline'}
                size={26}
                color={typeof color === 'string' ? color : '#64748b'}
              />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* ====================================================
          4. PROFIL UTILISATEUR
      ==================================================== */}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={26}
                color={typeof color === 'string' ? color : '#64748b'}
              />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* ====================================================
          PAGES MASQUÉES DE LA BARRE DE NAVIGATION
      ==================================================== */}

      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="btp"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="conducteur-courses"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="chauffeur-livraisons"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
