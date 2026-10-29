import { Tabs, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * MESSAY — KINETIC ISLAND
 * Expo Router / SDK 58 / React Native 0.88
 *
 * Une capsule orange se déplace réellement entre les onglets.
 * Le dock est autonome : pas d'import runtime depuis @react-navigation/*.
 * Pas de nouvelle dépendance native. L'ancien routage reste intact.
 */

const TRICYCLE_ICON = require('../../assets/images/tricycle.png');

const VISIBLE_TABS = [
  { name: 'home', label: 'Accueil', icon: 'grid', outline: 'grid-outline' },
  { name: 'tricycle', label: 'Tricycle', icon: 'car-sport', outline: 'car-sport-outline' },
  { name: 'tickets', label: 'Billets', icon: 'bus', outline: 'bus-outline' },
  { name: 'profile', label: 'Profil', icon: 'person', outline: 'person-outline' },
] as const;

type VisibleTab = (typeof VISIBLE_TABS)[number];
type KineticTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

function useMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function KineticIcon({
  tab,
  focused,
  reduceMotion,
}: {
  tab: VisibleTab;
  focused: boolean;
  reduceMotion: boolean;
}) {
  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    focus.stopAnimation();
    bounce.stopAnimation();

    if (reduceMotion) {
      focus.setValue(focused ? 1 : 0);
      bounce.setValue(1);
      return;
    }

    const focusSpring = Animated.spring(focus, {
      toValue: focused ? 1 : 0,
      stiffness: 225,
      damping: 19,
      mass: 0.65,
      useNativeDriver: true,
    });

    let bounceSequence: Animated.CompositeAnimation | undefined;

    if (focused) {
      bounce.setValue(0.82);
      bounceSequence = Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1.18,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(bounce, {
          toValue: 1,
          stiffness: 350,
          damping: 14,
          mass: 0.5,
          useNativeDriver: true,
        }),
      ]);
      bounceSequence.start();
    } else {
      bounce.setValue(1);
    }

    focusSpring.start();
    return () => {
      focusSpring.stop();
      bounceSequence?.stop();
    };
  }, [focused, reduceMotion, focus, bounce]);

  const lift = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const rotation = focus.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-5deg'],
  });
  const labelOpacity = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [0.58, 1],
  });
  const labelTranslate = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });

  return (
    <View pointerEvents="none" style={styles.tabContents}>
      <Animated.View
        style={{
          transform: [{ translateY: lift }, { rotate: rotation }, { scale: bounce }],
        }}
      >
        {tab.name === 'tricycle' ? (
          <Image
            source={TRICYCLE_ICON}
            resizeMode="contain"
            style={[
              styles.tricycleImage,
              { tintColor: focused ? '#FFFFFF' : '#99A7BA' },
            ]}
          />
        ) : (
          <Ionicons
            name={focused ? tab.icon : tab.outline}
            size={25}
            color={focused ? '#FFFFFF' : '#99A7BA'}
          />
        )}
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          {
            color: focused ? '#FFFFFF' : '#AAB5C6',
            opacity: labelOpacity,
            transform: [{ translateY: labelTranslate }],
          },
        ]}
      >
        {tab.label}
      </Animated.Text>
    </View>
  );
}

function KineticTabBar({ state, descriptors }: KineticTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const [width, setWidth] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const sliderX = useRef(new Animated.Value(0)).current;
  const sliderStretch = useRef(new Animated.Value(1)).current;
  const dockEntrance = useRef(new Animated.Value(0)).current;

  const activeRoute = state.routes[state.index];
  const activeIndex = VISIBLE_TABS.findIndex((tab) => tab.name === activeRoute?.name);
  const showDock = activeIndex !== -1 && !keyboardVisible;
  const cellWidth = width > 0 ? (width - 16) / VISIBLE_TABS.length : 0;

  // Ne pas recouvrir les formulaires avec le clavier.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Entrée du dock, uniquement au premier affichage.
  useEffect(() => {
    if (reduceMotion) {
      dockEntrance.setValue(1);
      return;
    }
    const animation = Animated.spring(dockEntrance, {
      toValue: 1,
      stiffness: 115,
      damping: 18,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [dockEntrance, reduceMotion]);

  // Le vrai mouvement partagé de la capsule : une seule position pour 4 onglets.
  useEffect(() => {
    if (cellWidth <= 0 || activeIndex < 0) return;
    sliderX.stopAnimation();
    sliderStretch.stopAnimation();

    if (reduceMotion) {
      sliderX.setValue(activeIndex * cellWidth);
      sliderStretch.setValue(1);
      return;
    }

    sliderStretch.setValue(1);
    const motion = Animated.parallel([
      Animated.spring(sliderX, {
        toValue: activeIndex * cellWidth,
        stiffness: 235,
        damping: 21,
        mass: 0.78,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(sliderStretch, {
          toValue: 1.12,
          duration: 135,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sliderStretch, {
          toValue: 1,
          stiffness: 285,
          damping: 18,
          useNativeDriver: true,
        }),
      ]),
    ]);
    motion.start();
    return () => motion.stop();
  }, [activeIndex, cellWidth, reduceMotion, sliderX, sliderStretch]);

  if (!showDock) return null;

  return (
    <Animated.View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
      style={[
        styles.dockOuter,
        {
          bottom: Math.max(insets.bottom, 12),
          opacity: dockEntrance,
          transform: [
            {
              translateY: dockEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [105, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#111A2B', '#202B43', '#111A2B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dockSurface}
      >
        <View pointerEvents="none" style={styles.dockTopGlint} />

        {cellWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.movingIsland,
              {
                left: 8,
                width: cellWidth,
                transform: [
                  { translateX: sliderX },
                  { scaleX: sliderStretch },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#FFA15B', '#FF6B35', '#EA451D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.islandGradient}
            >
              <View style={styles.islandShine} />
            </LinearGradient>
          </Animated.View>
        )}

        <View style={styles.tabRow}>
          {VISIBLE_TABS.map((tab) => {
            const route = state.routes.find((item) => item.name === tab.name);
            const focused = tab.name === activeRoute.name;
            if (!route) return null;

            const options = descriptors[route.key]?.options;
            const onPress = () => {
              if (!focused) {
                router.navigate(`/(tabs)/${tab.name}` as Href);
              }
            };

            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options?.tabBarAccessibilityLabel ?? tab.label}
                onPress={onPress}
                style={styles.tabButton}
              >
                <KineticIcon
                  tab={tab}
                  focused={focused}
                  reduceMotion={reduceMotion}
                />
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <KineticTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#AAB5C6',
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Accueil', tabBarAccessibilityLabel: 'Accueil MESSAY' }} />
      <Tabs.Screen name="tricycle" options={{ title: 'Tricycle', tabBarAccessibilityLabel: 'Transport par tricycle' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Billets', tabBarAccessibilityLabel: 'Billets de bus' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarAccessibilityLabel: 'Profil utilisateur' }} />

      {/* Écrans existants conservés, non affichés dans le dock. */}
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="conducteur-courses" options={{ href: null }} />
      <Tabs.Screen name="chauffeur-livraisons" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dockOuter: {
    position: 'absolute',
    left: 15,
    right: 15,
    height: 76,
    borderRadius: 30,
    backgroundColor: '#10192A',
    shadowColor: '#0A1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 18,
  },
  dockSurface: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  dockTopGlint: {
    position: 'absolute',
    top: 0,
    left: 35,
    right: 35,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  movingIsland: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    borderRadius: 24,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.52,
    shadowRadius: 12,
    elevation: 8,
  },
  islandGradient: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  islandShine: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 2,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  tabContents: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  tricycleImage: {
    width: 27,
    height: 27,
  },
});
