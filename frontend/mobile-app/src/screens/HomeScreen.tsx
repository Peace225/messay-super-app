import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ScrollViewInstance, StyleProp, ViewStyle } from 'react-native';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';

// MESSAY • KINETIC MOTION EDITION | Expo SDK 58
// Parallax 3D-like, carrousel piloté par le geste, lumière cinétique,
// micro-interactions tactiles. Aucun module natif supplémentaire.
// Toutes les animations continues sont désactivées si Réduire les animations est actif.
const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const HERO_ITEM_WIDTH = CARD_WIDTH + 16;

const C = {
  orange: '#FF6B35',
  orangeLight: '#FF9858',
  orangeDeep: '#E95320',
  dark: '#111827',
  slate: '#64748B',
  canvas: '#F6F7FB',
  white: '#FFFFFF',
};

const SOCIAL_MESSAGES = [
  {
    id: 1,
    user: 'MESSAY',
    action: 'Conseil sécurité',
    service: 'Portez toujours votre casque',
    location: 'Tricycle',
    icon: 'shield-alt' as const,
  },
  {
    id: 2,
    user: 'MESSAY',
    action: 'Conseil voyage',
    service: 'Vérifiez votre billet avant le départ',
    location: 'Bus',
    icon: 'ticket-alt' as const,
  },
  {
    id: 3,
    user: 'MESSAY',
    action: 'Assistance',
    service: 'Retrouvez notre support dans votre profil',
    location: 'Application',
    icon: 'headset' as const,
  },
];

const SERVICES_DATA = [
  {
    id: 'tricycle',
    title: 'Tricycle',
    icon: 'shuttle-van',
    description: 'Transport urbain',
    badge: '🔥 Populaire',
    badgeColor: '#FF453A',
    image: require('../../assets/images/tricycle2.jpg'),
    path: '/(tabs)/tricycle',
  },
  {
    id: 'transport',
    title: 'Tickets Bus',
    icon: 'ticket-alt',
    description: 'Interurbain',
    badge: '⭐ Top',
    badgeColor: '#F4BD12',
    image: require('../../assets/images/bus.jpg'),
    path: '/(tabs)/tickets',
  },
] as const;

type ServiceItem = (typeof SERVICES_DATA)[number];

type RevealProps = {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

/** Entrée progressive ; respecte l'option iOS « Réduire les animations ». */
function Reveal({ children, delay = 0, distance = 24, style }: RevealProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) return;
        if (reduceMotion) {
          opacity.setValue(1);
          translateY.setValue(0);
          scale.setValue(1);
          return;
        }
        animation = Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 620,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              damping: 18,
              stiffness: 125,
              mass: 0.8,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 650,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]);
        animation.start();
      })
      .catch(() => {
        if (mounted) {
          opacity.setValue(1);
          translateY.setValue(0);
          scale.setValue(1);
        }
      });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [delay, distance, opacity, scale, translateY]);

  return (
    <Animated.View
      style={[
        style,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Feedback tactile discret sans modifier les actions existantes. */
function MotionButton({
  children,
  onPress,
  style,
  accessibilityLabel,
  onPressIn,
  onPressOut,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onPressIn?: () => void;
  onPressOut?: () => void;
}) {
  const press = useRef(new Animated.Value(0)).current;

  const animate = (toValue: number) => {
    Animated.spring(press, {
      toValue,
      stiffness: 370,
      damping: 16,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  };

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.945] });
  const rotate = press.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-0.75deg'] });

  return (
    <Animated.View style={[style, { transform: [{ scale }, { rotateZ: rotate }] }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.97}
        onPress={onPress}
        onPressIn={() => { animate(1); onPressIn?.(); }}
        onPressOut={() => { animate(0); onPressOut?.(); }}
        style={styles.motionButtonFill}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function ServiceCard({
  item,
  index,
  onPress,
}: {
  item: ServiceItem;
  index: number;
  onPress: () => void;
}) {
  const imageZoom = useRef(new Animated.Value(1)).current;
  const zoomImage = (toValue: number) => {
    Animated.spring(imageZoom, {
      toValue,
      stiffness: 210,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Reveal delay={480 + index * 130} style={styles.cardWrap} distance={46}>
      <MotionButton
        onPress={onPress}
        onPressIn={() => zoomImage(1.16)}
        onPressOut={() => zoomImage(1)}
        style={styles.cardContainer}
        accessibilityLabel={`Ouvrir ${item.title}`}
      >
        <View style={styles.cardImg}>
          <Animated.Image
            source={item.image}
            style={[styles.fillImage, { transform: [{ scale: imageZoom }] }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.04)', 'rgba(9,15,28,0.08)', 'rgba(9,15,28,0.88)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
            <Text style={styles.badgeTxt}>{item.badge}</Text>
          </View>
          <View style={styles.cardIcon}>
            <FontAwesome5 name={item.icon} size={15} color={C.dark} />
          </View>
          <View style={styles.cardBottom}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <View style={styles.cardArrow}>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </View>
          </View>
        </View>
      </MotionButton>
    </Reveal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const heroScrollRef = useRef<ScrollViewInstance>(null);
  const heroIndexRef = useRef(0);
  const popupShownRef = useRef(false);
  const socialAnim = useRef(new Animated.Value(-150)).current;
  const modalScale = useRef(new Animated.Value(0.88)).current;
  const heroPulse = useRef(new Animated.Value(1)).current;
  const heroScrollX = useRef(new Animated.Value(0)).current;
  const pageScrollY = useRef(new Animated.Value(0)).current;
  const ambientPhase = useRef(new Animated.Value(0)).current;
  const searchShine = useRef(new Animated.Value(0)).current;
  const arrowFloat = useRef(new Animated.Value(0)).current;
  const manualSwipeUntilRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [currentSocialIndex, setCurrentSocialIndex] = useState(0);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  const heroBanners = useMemo(
    () => [
      {
        id: '1',
        greeting: isAuthenticated
          ? `Salut, ${user?.prenom || user?.nom || 'Membre'} 👋`
          : 'Bienvenue sur MESSAY 👋',
        title: 'Tricycle Rapide\nPartout à Abidjan',
        subtitle: 'À partir de 500 FCFA',
        cta: 'Commander',
        path: '/(tabs)/tricycle',
        image: require('../../assets/images/tricycle2.jpg'),
        color: C.orange,
      },
      {
        id: '2',
        greeting: '🚌 Transport Interurbain',
        title: 'Tickets Bus VIP\nAbidjan - Yamoussoukro',
        subtitle: 'Dès 5 000 FCFA • Climatisé',
        cta: 'Réserver',
        path: '/(tabs)/tickets',
        image: require('../../assets/images/bus.jpg'),
        color: '#1677FF',
      },
      {
        id: '3',
        greeting: '⚡ MESSAY Express',
        title: 'Livraison en 30 min\nCourses & Colis',
        subtitle: 'Suivi GPS en temps réel',
        cta: 'Essayer',
        path: '/(tabs)/tricycle',
        image: require('../../assets/images/hero.png'),
        color: '#25B879',
      },
      {
        id: '4',
        greeting: '🎁 Offre Spéciale',
        title: '-20% sur votre\n1ère course',
        subtitle: 'Code: BIENVENUE',
        cta: 'Profiter',
        path: '/(tabs)/tricycle',
        image: require('../../assets/images/tricycle1.jpg'),
        color: '#8659F6',
      },
    ],
    [user?.prenom, user?.nom, isAuthenticated]
  );

  // Préférences système : pas de mouvement automatique si l'utilisateur le réduit.
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (active) setReduceMotion(enabled); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => { active = false; subscription.remove(); };
  }, []);

  // Mouvement ambiant des halos du header, reflet dans la recherche, flèche vivante.
  useEffect(() => {
    if (reduceMotion) {
      ambientPhase.setValue(0);
      searchShine.setValue(0);
      arrowFloat.setValue(0);
      return;
    }
    const ambient = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPhase, {
          toValue: 1, duration: 4200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(ambientPhase, {
          toValue: 0, duration: 4200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );
    const sheen = Animated.loop(
      Animated.sequence([
        Animated.delay(1700),
        Animated.timing(searchShine, {
          toValue: 1, duration: 950,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(searchShine, {
          toValue: 0, duration: 0, useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(3100),
      ])
    );
    const arrow = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowFloat, { toValue: 1, duration: 680,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          isInteraction: false }),
        Animated.timing(arrowFloat, { toValue: 0, duration: 680,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          isInteraction: false }),
        Animated.delay(950),
      ])
    );
    ambient.start();
    sheen.start();
    arrow.start();
    return () => { ambient.stop(); sheen.stop(); arrow.stop(); };
  }, [reduceMotion, ambientPhase, searchShine, arrowFloat]);

  // Pop-up existant et messages MESSAY : conservés, avec nettoyage des timers.
  useEffect(() => {
    let active = true;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let popupTimer: ReturnType<typeof setTimeout> | undefined;

    if (isAuthenticated && !popupShownRef.current) {
      popupTimer = setTimeout(() => {
        if (active) {
          popupShownRef.current = true;
          setShowPopup(true);
        }
      }, 2500);
    }

    const interval = setInterval(() => {
      Animated.spring(socialAnim, {
        toValue: 16,
        friction: 7,
        tension: 42,
        useNativeDriver: true,
      }).start();
      toastTimer = setTimeout(() => {
        Animated.timing(socialAnim, {
          toValue: -150,
          duration: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (active && finished) {
            setCurrentSocialIndex((previous) => (previous + 1) % SOCIAL_MESSAGES.length);
          }
        });
      }, 4000);
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
      if (toastTimer) clearTimeout(toastTimer);
      if (popupTimer) clearTimeout(popupTimer);
      socialAnim.stopAnimation();
    };
  }, [isAuthenticated, socialAnim]);

  // Autoplay intelligent : pause après un geste et dans les fenêtres modales.
  useEffect(() => {
    if (reduceMotion || showPopup) return;
    const autoScroll = setInterval(() => {
      if (Date.now() < manualSwipeUntilRef.current) return;
      const nextIndex = (heroIndexRef.current + 1) % heroBanners.length;
      heroIndexRef.current = nextIndex;
      heroScrollRef.current?.scrollTo({
        x: nextIndex * HERO_ITEM_WIDTH,
        animated: true,
      });
      setCurrentHeroIndex(nextIndex);
    }, 4800);
    return () => clearInterval(autoScroll);
  }, [heroBanners.length, reduceMotion, showPopup]);

  // Respiration très discrète du CTA actif (désactivée si « Réduire les animations »).
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    if (reduceMotion) {
      heroPulse.setValue(1);
      return;
    }
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(heroPulse, {
            toValue: 1.035,
            duration: 1250,
            easing: Easing.inOut(Easing.sin),
            isInteraction: false,
            useNativeDriver: true,
          }),
          Animated.timing(heroPulse, {
            toValue: 1,
            duration: 1250,
            easing: Easing.inOut(Easing.sin),
            isInteraction: false,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }).catch(() => {});
    return () => {
      active = false;
      animation?.stop();
    };
  }, [heroPulse, reduceMotion]);

  useEffect(() => {
    if (!showPopup) {
      modalScale.setValue(0.88);
      return;
    }
    const animation = Animated.spring(modalScale, {
      toValue: 1,
      damping: 16,
      stiffness: 150,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [showPopup, modalScale]);

  const handleServicePress = (path: string) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    router.push(path as any);
  };

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.orange} />
        <Text style={styles.loaderTxt}>Chargement...</Text>
      </View>
    );
  }

  const currentMsg = SOCIAL_MESSAGES[currentSocialIndex];
  const ambientX = ambientPhase.interpolate({ inputRange: [0, 1], outputRange: [-12, 17] });
  const ambientY = ambientPhase.interpolate({ inputRange: [0, 1], outputRange: [-7, 13] });
  const ambientTurn = ambientPhase.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '15deg'] });
  const pageProgress = pageScrollY.interpolate({
    inputRange: [0, 600], outputRange: [0.05, 1], extrapolate: 'clamp',
  });
  const arrowX = arrowFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
  const shineX = searchShine.interpolate({ inputRange: [0, 1], outputRange: [-100, width + 95] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Notification conseil : n'empêche jamais les interactions. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { top: Math.max(insets.top + 4, 16), transform: [{ translateY: socialAnim }] }]}
      >
        <View style={styles.toastInner}>
          <View style={styles.toastIcon}>
            <FontAwesome5 name={currentMsg.icon} size={16} color={C.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle}>
              {currentMsg.user} <Text style={styles.toastAction}>{currentMsg.action}</Text>
            </Text>
            <Text style={styles.toastSub}>
              {currentMsg.service} • {currentMsg.location}
            </Text>
          </View>
          <View style={styles.liveDot} />
        </View>
      </Animated.View>

      {/* Header orange premium + motifs subtils. */}
      <LinearGradient
        colors={[C.orangeDeep, C.orange, C.orangeLight]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.headerCircle, { transform: [
            { translateX: ambientX }, { translateY: ambientY }, { rotateZ: ambientTurn },
          ] }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.headerCircleSmall, { transform: [
            { translateX: Animated.multiply(ambientX, -0.65) },
            { translateY: Animated.multiply(ambientY, 0.7) },
          ] }]}
        />
        <SafeAreaView edges={['top']}>
          <Reveal delay={40} distance={12}>
            <View style={styles.headerRow}>
              <View style={styles.headerBrand}>
                <Text style={styles.logo}>MESSAY</Text>
                <Text style={styles.tag}>L'EXCELLENCE EN MOUVEMENT</Text>
              </View>
              <MotionButton
                style={styles.avatar}
                accessibilityLabel="Ouvrir mon profil"
                onPress={() =>
                  router.push(isAuthenticated ? '/profile' : '/(auth)/login')
                }
              >
                <View style={styles.avatarInner}>
                  {isAuthenticated ? (
                    <Text style={styles.avatarTxt}>{user?.nom?.charAt(0) || 'M'}</Text>
                  ) : (
                    <Ionicons name="person-outline" size={23} color={C.white} />
                  )}
                </View>
              </MotionButton>
            </View>
          </Reveal>
        </SafeAreaView>
        <View pointerEvents="none" style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { transform: [{ scaleX: pageProgress }] }]} />
        </View>
      </LinearGradient>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: pageScrollY } } }],
          { useNativeDriver: true }
        )}
        contentContainerStyle={{ paddingBottom: Math.max(160, insets.bottom + 145) }}
      >
        {/* Recherche avec entrée motion et bouton fonctionnel conservé. */}
        <Reveal delay={160} style={styles.searchWrap} distance={20}>
          <MotionButton
            style={styles.searchShadow}
            onPress={() => handleServicePress('/(tabs)/tricycle')}
            accessibilityLabel="Chercher un trajet"
          >
            <View style={styles.search}>
              <Animated.View
                pointerEvents="none"
                style={[styles.searchBeam, { transform: [{ translateX: shineX }, { rotateZ: '-18deg' }] }]}
              />
              <View style={styles.searchIcon}>
                <Ionicons name="search" size={22} color={C.orange} />
              </View>
              <View style={styles.searchCopy}>
                <Text style={styles.searchEyebrow}>VOTRE PROCHAIN TRAJET</Text>
                <Text style={styles.searchTxt}>Où allons-nous ?</Text>
              </View>
              <View style={styles.searchPill}>
                <Text style={styles.searchPillTxt}>Maintenant</Text>
              </View>
            </View>
          </MotionButton>
        </Reveal>

        {/* Titre court : identité de service, sans surcharger le haut de page. */}
        <Reveal delay={240} style={styles.sectionHeading} distance={16}>
          <View>
            <Text style={styles.sectionEyebrow}>LE MEILLEUR DE MESSAY</Text>
            <Text style={styles.sectionTitle}>Bougez librement<Text style={styles.orangePeriod}>.</Text></Text>
          </View>

        </Reveal>

        {/* KINETIC HERO : parallaxe, inclinaison, zoom et typographie pilotés par le swipe. */}
        <Reveal delay={290} distance={34}>
          <Animated.ScrollView
            ref={heroScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={HERO_ITEM_WIDTH}
            snapToAlignment="start"
            contentContainerStyle={styles.heroContent}
            style={styles.heroScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => { manualSwipeUntilRef.current = Date.now() + 12000; }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: heroScrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={(event) => {
              const index = Math.max(0, Math.min(
                heroBanners.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / HERO_ITEM_WIDTH)
              ));
              heroIndexRef.current = index;
              setCurrentHeroIndex(index);
            }}
          >
            {heroBanners.map((banner, index) => {
              const inputRange = [
                (index - 1) * HERO_ITEM_WIDTH,
                index * HERO_ITEM_WIDTH,
                (index + 1) * HERO_ITEM_WIDTH,
              ];
              const heroScale = reduceMotion ? 1 : heroScrollX.interpolate({
                inputRange, outputRange: [0.88, 1, 0.88], extrapolate: 'clamp',
              });
              const heroLift = reduceMotion ? 0 : heroScrollX.interpolate({
                inputRange, outputRange: [17, 0, 17], extrapolate: 'clamp',
              });
              const heroRotate = reduceMotion ? '0deg' : heroScrollX.interpolate({
                inputRange, outputRange: ['-2deg', '0deg', '2deg'], extrapolate: 'clamp',
              });
              const imageScale = reduceMotion ? 1 : heroScrollX.interpolate({
                inputRange, outputRange: [1.18, 1.045, 1.18], extrapolate: 'clamp',
              });
              const imageTranslate = reduceMotion ? 0 : heroScrollX.interpolate({
                inputRange, outputRange: [34, 0, -34], extrapolate: 'clamp',
              });
              const textOpacity = reduceMotion ? 1 : heroScrollX.interpolate({
                inputRange, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp',
              });
              const textLift = reduceMotion ? 0 : heroScrollX.interpolate({
                inputRange, outputRange: [21, 0, 21], extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={banner.id}
                  style={[styles.heroCard, { transform: [
                    { translateY: heroLift }, { scale: heroScale }, { rotateZ: heroRotate },
                  ] }]}
                >
                  <Animated.Image
                    source={banner.image}
                    resizeMode="cover"
                    style={[styles.fillImage, { transform: [
                      { translateX: imageTranslate }, { scale: imageScale },
                    ] }]}
                  />
                  <LinearGradient
                    colors={['rgba(4,10,25,0.04)', 'rgba(4,10,25,0.18)', 'rgba(4,10,25,0.94)']}
                    locations={[0, 0.38, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={styles.heroIndexPill}>
                    <Text style={styles.heroIndexText}>
                      {String(index + 1).padStart(2, '0')}
                      <Text style={styles.heroIndexFaint}> / {String(heroBanners.length).padStart(2, '0')}</Text>
                    </Text>
                  </View>
                  <Animated.View style={[styles.heroContentInner, {
                    opacity: textOpacity, transform: [{ translateY: textLift }],
                  }]}>
                    <View style={styles.heroKicker}>
                      <View style={styles.kickerDot} />
                      <Text style={styles.heroHi} numberOfLines={1}>
                        {banner.greeting}
                      </Text>
                    </View>
                    <View style={styles.heroTextWrap}>
                      <Text style={styles.heroTitle} numberOfLines={3} adjustsFontSizeToFit>
                        {banner.title}
                      </Text>
                      <Text style={styles.heroSub}>{banner.subtitle}</Text>
                      <Animated.View style={[
                        styles.heroCtaWrap,
                        index === currentHeroIndex && !reduceMotion && {
                          transform: [{ scale: heroPulse }],
                        },
                      ]}>
                        <MotionButton
                          style={[styles.heroBtn, { backgroundColor: banner.color }]}
                          onPress={() => handleServicePress(banner.path)}
                          accessibilityLabel={`${banner.cta} : ${banner.title.replace(/\n/g, ' ')}`}
                        >
                          <View style={styles.heroBtnContent}>
                            <Text style={styles.heroBtnTxt}>{banner.cta}</Text>
                            <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
                              <Ionicons name="arrow-forward" size={18} color={C.white} />
                            </Animated.View>
                          </View>
                        </MotionButton>
                      </Animated.View>
                    </View>
                  </Animated.View>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          {/* Indicateurs sans saut brusque : leur taille suit exactement le mouvement du doigt. */}
          <View style={styles.pagination}>
            {heroBanners.map((_, index) => {
              const inputRange = [
                (index - 1) * HERO_ITEM_WIDTH,
                index * HERO_ITEM_WIDTH,
                (index + 1) * HERO_ITEM_WIDTH,
              ];
              const widthScale = heroScrollX.interpolate({
                inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp',
              });
              const opacity = heroScrollX.interpolate({
                inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp',
              });
              return (
                <TouchableOpacity
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Afficher l'offre ${index + 1}`}
                  onPress={() => {
                    manualSwipeUntilRef.current = Date.now() + 10000;
                    heroScrollRef.current?.scrollTo({ x: index * HERO_ITEM_WIDTH, animated: true });
                    heroIndexRef.current = index;
                    setCurrentHeroIndex(index);
                  }}
                  hitSlop={10}
                  style={styles.paginationHit}
                >
                  <View style={styles.paginationTrack}>
                    <Animated.View style={[
                      styles.paginationBar,
                      reduceMotion
                        ? { opacity: index === currentHeroIndex ? 1 : 0.35 }
                        : { opacity, transform: [{ scaleX: widthScale }] },
                    ]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Reveal>

        {/* Services inchangés côté métier, visuellement revalorisés. */}
        <Reveal delay={380} style={styles.servicesTitleWrap} distance={18}>
          <View>
            <Text style={styles.servicesTitle}>Nos services</Text>
            <Text style={styles.servicesSub}>Tout votre transport, au même endroit</Text>
          </View>
          <Ionicons name="arrow-forward-circle-outline" size={24} color={C.orange} />
        </Reveal>
        <View style={styles.grid}>
          {SERVICES_DATA.map((service, index) => (
            <ServiceCard
              key={service.id}
              item={service}
              index={index}
              onPress={() => handleServicePress(service.path)}
            />
          ))}
        </View>
        <Reveal delay={640} style={styles.footerHint} distance={10}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.orange} />
          <Text style={styles.footerHintText}>Voyagez avec MESSAY, simplement.</Text>
        </Reveal>
      </Animated.ScrollView>

      {/* Modale Tricycle existante, animée. */}
      <Modal
        visible={showPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={styles.modalBg}>
          <TouchableOpacity
            accessibilityLabel="Fermer"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={() => setShowPopup(false)}
          />
          <Animated.View style={[styles.modalCard, { transform: [{ scale: modalScale }] }]}>
            <LinearGradient
              colors={['#FFF0E8', C.white]}
              style={styles.modalContent}
            >
              <View style={styles.modalIconWrap}>
                <FontAwesome5 name="motorcycle" size={27} color={C.orange} />
              </View>
              <Text style={styles.modalTitle}>Découvrez MESSAY Tricycle</Text>
              <Text style={styles.modalSub}>
                Consultez les tricycles disponibles près de vous
              </Text>
              <MotionButton
                style={styles.modalBtn}
                onPress={() => {
                  setShowPopup(false);
                  handleServicePress('/(tabs)/tricycle');
                }}
              >
                <Text style={styles.modalBtnTxt}>Commander</Text>
              </MotionButton>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.canvas },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas },
  loaderTxt: { marginTop: 12, color: C.slate, fontWeight: '600' },
  motionButtonFill: { flex: 1 },
  fillImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  header: {
    borderBottomLeftRadius: 31,
    borderBottomRightRadius: 31,
    overflow: 'hidden',
    paddingBottom: 20,
    zIndex: 2,
    shadowColor: C.orangeDeep,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  progressTrack: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 3, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: 3, width: '100%', backgroundColor: 'rgba(255,255,255,0.65)',
  },
  headerCircle: {
    position: 'absolute', right: -76, top: -106,
    width: 270, height: 270, borderRadius: 135,
    borderWidth: 36, borderColor: 'rgba(255,255,255,0.075)',
  },
  headerCircleSmall: {
    position: 'absolute', right: 75, bottom: -80,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingHorizontal: 22, gap: 12,
  },
  headerBrand: { flex: 1 },
  logo: { color: C.white, fontWeight: '900', fontSize: 32, letterSpacing: 2.8 },
  tag: { color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 9, letterSpacing: 1.8, marginTop: 3 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', overflow: 'hidden',
  },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.white, fontWeight: '900', fontSize: 19 },

  toast: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.98)', shadowColor: C.dark,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 18, elevation: 7,
  },
  toastIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#FFF0E9', marginRight: 11,
  },
  toastTitle: { fontWeight: '800', fontSize: 13, color: C.dark },
  toastAction: { fontWeight: '500', color: C.slate },
  toastSub: { fontWeight: '600', fontSize: 11, color: C.orangeDeep, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginLeft: 6 },

  searchWrap: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 10 },
  searchShadow: {
    height: 74, borderRadius: 23, backgroundColor: C.white,
    shadowColor: '#243248', shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.075, shadowRadius: 18, elevation: 4,
  },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, gap: 11, overflow: 'hidden', borderRadius: 23,
  },
  searchBeam: {
    position: 'absolute', top: -30, bottom: -30, left: 0, width: 68,
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  searchIcon: { width: 44, height: 44, backgroundColor: '#FFF0E9', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchCopy: { flex: 1, minWidth: 0 },
  searchEyebrow: { fontSize: 9, fontWeight: '800', color: '#9AA2AE', letterSpacing: 0.65 },
  searchTxt: { color: '#2A3446', fontSize: 16, fontWeight: '800', marginTop: 2 },
  searchPill: { backgroundColor: '#FFF1E9', borderRadius: 13, paddingVertical: 10, paddingHorizontal: 11 },
  searchPillTxt: { fontWeight: '800', color: C.orangeDeep, fontSize: 11 },

  sectionHeading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginTop: 10, marginBottom: 15,
  },
  sectionEyebrow: { color: C.orangeDeep, fontWeight: '900', letterSpacing: 1.5, fontSize: 9 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: C.dark, marginTop: 4, letterSpacing: -0.5 },
  orangePeriod: { color: C.orange },
  sectionSparkle: { backgroundColor: '#FFF0E8', width: 38, height: 38, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  heroScroll: { flexGrow: 0 },
  heroContent: { paddingHorizontal: 20 },
  heroCard: {
    width: CARD_WIDTH, height: 290, marginRight: 16, overflow: 'hidden',
    borderRadius: 29, backgroundColor: '#263347',
  },
  heroIndexPill: {
    position: 'absolute', top: 18, right: 18,
    borderRadius: 15, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(10,16,30,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)',
  },
  heroIndexText: { color: C.white, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  heroIndexFaint: { color: 'rgba(255,255,255,0.48)' },
  heroContentInner: { flex: 1, justifyContent: 'space-between', padding: 22 },
  heroKicker: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingHorizontal: 11, borderRadius: 50,
    backgroundColor: 'rgba(11,19,31,0.45)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.23)', maxWidth: '100%',
  },
  kickerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FDBA74' },
  heroHi: { color: C.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.3, flexShrink: 1 },
  heroTextWrap: { alignItems: 'flex-start' },
  heroTitle: {
    fontSize: width < 360 ? 25 : 29, lineHeight: width < 360 ? 31 : 35,
    letterSpacing: -0.7, fontWeight: '900', color: C.white, marginBottom: 7,
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowRadius: 5,
  },
  heroSub: { color: 'rgba(255,255,255,0.94)', fontSize: 13, fontWeight: '700', marginBottom: 16 },
  heroCtaWrap: { alignSelf: 'flex-start' },
  heroBtn: { borderRadius: 15, paddingHorizontal: 19, height: 47, minWidth: 132 },
  heroBtnContent: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 },
  heroBtnTxt: { fontWeight: '900', fontSize: 14, color: C.white },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 12 },
  paginationHit: { paddingHorizontal: 3, paddingVertical: 8 },
  paginationTrack: { width: 34, height: 4, borderRadius: 3, backgroundColor: '#D7DDE7', overflow: 'hidden' },
  paginationBar: { height: 4, width: '100%', borderRadius: 3, backgroundColor: C.orange },

  servicesTitleWrap: {
    paddingHorizontal: 21, marginTop: 23, marginBottom: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  servicesTitle: { color: C.dark, fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  servicesSub: { fontSize: 12, color: C.slate, marginTop: 4 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  cardWrap: { width: '48%', height: 218, marginBottom: 14 },
  cardContainer: {
    flex: 1, backgroundColor: '#E9EDF4', overflow: 'hidden', borderRadius: 23,
    shadowColor: C.dark, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12 },
  badgeTxt: { color: C.white, fontSize: 10, fontWeight: '900' },
  cardIcon: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center' },
  cardBottom: { paddingHorizontal: 13, paddingBottom: 15, paddingTop: 20 },
  cardTitle: { color: C.white, fontWeight: '900', fontSize: 18 },
  cardDesc: { color: 'rgba(255,255,255,0.82)', fontWeight: '600', fontSize: 12, marginTop: 4 },
  cardArrow: { position: 'absolute', right: 13, bottom: 15, width: 25, height: 25, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  footerHint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  footerHintText: { fontSize: 12, fontWeight: '600', color: C.slate },

  modalBg: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,13,25,0.55)', padding: 24 },
  modalCard: { width: '100%', overflow: 'hidden', borderRadius: 27, backgroundColor: C.white, shadowColor: C.dark, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.2, shadowRadius: 28, elevation: 12 },
  modalContent: { alignItems: 'center', padding: 28 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE3D3', marginBottom: 17 },
  modalTitle: { fontSize: 22, color: C.dark, fontWeight: '900', textAlign: 'center' },
  modalSub: { color: C.slate, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 26, textAlign: 'center' },
  modalBtn: { height: 52, width: '100%', borderRadius: 16, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt: { textAlign: 'center', lineHeight: 52, color: C.white, fontWeight: '900', fontSize: 16 },
});
