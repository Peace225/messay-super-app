import { Tabs } from 'expo-router';
import { Image, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

const TRICYCLE_ICON = require('../../assets/images/tricycle.png');

function AnimatedTabIcon({ focused, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused? 1.2 : 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.spring(translateY, {
        toValue: focused? -8 : 0,
        useNativeDriver: true,
        friction: 5,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateY }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {focused && (
        <View
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

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#9CA3AF',
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          paddingBottom: 0,
          paddingTop: 8,
        },
      }}
    >
      {/* 1. HOME */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons name={focused? 'grid' : 'grid-outline'} size={26} color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* 2. TRICYCLE */}
      <Tabs.Screen
        name="tricycle"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Image
                source={TRICYCLE_ICON}
                style={{
                  width: 32,
                  height: 32,
                  opacity: focused? 1 : 0.5,
                  tintColor: focused? undefined : '#9CA3AF',
                }}
                resizeMode="contain"
              />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* 3. TICKETS */}
      <Tabs.Screen
        name="tickets"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons name={focused? 'bus' : 'bus-outline'} size={26} color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* 4. PROFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons name={focused? 'person' : 'person-outline'} size={26} color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />

      {/* CACHE */}
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="btp" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="conducteur-courses" options={{ href: null }} />
      <Tabs.Screen name="chauffeur-livraisons" options={{ href: null }} />
    </Tabs>
  );
}