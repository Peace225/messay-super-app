import { Tabs } from 'expo-router';
import { View, Platform, StyleSheet, Image, Animated, Text } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';

// --- TON ICONE TRICYCLE ---
const TRICYCLE_ICON = require('../../assets/images/map/tricycle-icon.png');

function TabIcon({ icon, focused, isMain, routeName }: any) {
  // Animation de montée pour l'effet flottant
  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(moveAnim, {
      toValue: focused ? -25 : 0, // Monte plus haut quand c'est sélectionné
      useNativeDriver: true,
      friction: 7,
      tension: 50
    }).start();
  }, [focused]);

  // Si c'est l'onglet HOME, on garde un design simple et fixe
  if (routeName === 'home') {
    return (
      <View style={styles.homeIconWrapper}>
        <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={focused ? '#FF6B35' : '#A0AEC0'} />
      </View>
    );
  }

  // Pour TOUS les autres onglets quand ils sont "focused", ils deviennent le bouton rond orange
  return (
    <Animated.View style={[
      styles.iconWrapper,
      focused ? styles.activeCircleWrapper : styles.inactiveWrapper,
      { transform: [{ translateY: moveAnim }] }
    ]}>
      {routeName === 'tricycle' && focused ? (
        <Image source={TRICYCLE_ICON} style={styles.mainIconImage} resizeMode="contain" />
      ) : (
        <Ionicons 
          name={focused ? (icon as any) : `${icon}-outline` as any} 
          size={focused ? 28 : 24} 
          color={focused ? '#FFF' : '#A0AEC0'} 
        />
      )}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'USER';

  const getTabConfig = () => {
    // On définit les icônes de base
    if (userRole === 'CONDUCTEUR') {
      return [
        { name: 'home', icon: 'grid' },
        { name: 'conducteur-courses', icon: 'bicycle' },
        { name: 'profile', icon: 'person' },
      ];
    }
    return [
      { name: 'home', icon: 'grid' },
      { name: 'tickets', icon: 'bus' },
      { name: 'tricycle', icon: 'bicycle' },
      { name: 'events', icon: 'ticket' },
      { name: 'btp', icon: 'construct' },
    ];
  };

  const tabs = getTabConfig();
  const allRoutes = ['home', 'conducteur-courses', 'chauffeur-livraisons', 'profile', 'tricycle', 'tickets', 'events', 'btp'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      {allRoutes.map((routeName) => {
        const tab = tabs.find((t) => t.name === routeName);
        
        return (
          <Tabs.Screen
            key={routeName}
            name={routeName}
            options={{
              href: tab ? undefined : null,
              tabBarIcon: (props) => (
                <TabIcon 
                  {...props} 
                  icon={tab?.icon} 
                  routeName={routeName}
                />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: '#1A1A1A',
    borderRadius: 35,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  homeIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveWrapper: {
    width: 50,
    height: 50,
  },
  activeCircleWrapper: {
    backgroundColor: '#FF6B35',
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 5,
    borderColor: '#1A1A1A',
    // Ombre 7D sur le cercle actif
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  mainIconImage: {
    width: 40,
    height: 40,
  },
});