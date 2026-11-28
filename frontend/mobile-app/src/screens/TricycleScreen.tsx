import React, { useEffect, useRef, useState } from 'react';

import {

  Alert,

  Animated,

  Dimensions,

  Easing,

  Image,

  Keyboard,

  KeyboardAvoidingView,

  Linking,

  Platform,

  StatusBar,

  StyleSheet,

  Text,

  TextInput,

  TouchableOpacity,

  TouchableWithoutFeedback,

  View,

} from 'react-native';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { BlurView } from 'expo-blur';

import * as Location from 'expo-location';

import { tricycleService } from '../services/tricycleService';

import { useAuthStore } from '../store/authStore';

// iOS : Apple Maps natif. Android : Google Maps, clé injectée par app.config.js.

// Aucune clé Google ne doit être inscrite dans ce composant.

const { width } = Dimensions.get('window');

const ABIDJAN = { latitude: 5.359952, longitude: -4.008256 };

const TRICYCLE_ICON = require('../../assets/images/tricycle.png');

const OPERATEURS = [

  { id: 'orange', logo: require('../../assets/images/payment/orange.png') },

  { id: 'mtn', logo: require('../../assets/images/payment/mtn.png') },

  { id: 'moov', logo: require('../../assets/images/payment/moov.png') },

  { id: 'wave', logo: require('../../assets/images/payment/wave.png') },

];

type AppState = 'saisie' | 'recherche' | 'accepte';

type ServiceType = 'course' | 'colis';

type PaymentType = 'cash' | 'momo';

type Coords = { latitude: number; longitude: number };

type RoadRoute = {

  coordinates: Coords[];

  distanceMeters: number;

  durationSeconds: number;

};

type RouteStatus = 'idle' | 'loading' | 'ready' | 'error';

type DriverInfo = { id?: string; name?: string; phone?: string; telephone?: string; vehicle?: string; plate?: string; rating?: number };

type RideSignal = { rideId?: string | number; ride?: { id?: string | number }; driver?: DriverInfo; lat?: number; lng?: number };

const extractRideId = (v: unknown): string | null => {

  if (!v || typeof v !== 'object') return null;

  const d = v as { id?: string | number; rideId?: string | number; ride?: { id?: string | number }; data?: { id?: string | number; rideId?: string | number; ride?: { id?: string | number } } };

  const id = d.rideId ?? d.ride?.id ?? d.id ?? d.data?.rideId ?? d.data?.ride?.id ?? d.data?.id;

  return id === undefined || id === null || String(id).trim() === '' ? null : String(id);

};

const sameRide = (event: RideSignal, activeId: string | null): boolean =>

  !!activeId && (event.rideId !== undefined || event.ride?.id !== undefined) &&

  String(event.rideId ?? event.ride?.id) === activeId;

// Même backend que src/services/api.ts ; aucun secret Google embarqué sur mobile.

const API_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() ||

  'https://messay-api.onrender.com/api').replace(/\/+$/, '');

async function fetchRoadRoute(from: Coords, to: Coords, signal: AbortSignal): Promise<RoadRoute> {

  // Endpoint HTTPS authentifié du backend MESSAY, qui appelle openrouteservice.

  const token = useAuthStore.getState().accessToken;

  if (!token) throw new Error('Connectez-vous pour calculer un itinéraire.');

  const response = await fetch(`${API_URL}/itineraires/route`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

      Authorization: `Bearer ${token}`,

    },

    body: JSON.stringify({ origin: from, destination: to }),

    signal,

  });

  if (!response.ok) {

    throw new Error(response.status === 404 ? 'Endpoint itinéraire non déployé.' :

      response.status === 401 ? 'Connexion MESSAY requise.' : `Service itinéraire indisponible (${response.status}).`);

  }

  const data = await response.json() as RoadRoute;

  if (!Array.isArray(data.coordinates) || data.coordinates.length < 2 ||

      !Number.isFinite(data.distanceMeters) || !Number.isFinite(data.durationSeconds) ||

      data.coordinates.some(c => !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude))) {

    throw new Error('Réponse itinéraire invalide.');

  }

  return data;

}

// CONTRAT BACKEND À AJOUTER/CONFIRMER : PATCH /courses/:id/annuler

// Refuser toute confirmation sans statut ANNULEE persistant.

async function cancelTricycleRide(id: string): Promise<void> {

  const token = useAuthStore.getState().accessToken;

  if (!token) throw new Error('Session expirée. Reconnectez-vous pour annuler.');

  const response = await fetch(`${API_URL}/courses/${encodeURIComponent(id)}/annuler`, {

    method: 'PATCH',

    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

  });

  if (!response.ok) {

    throw new Error(response.status === 404 ? 'Route /courses/:id/annuler absente du backend : implémentez-la.' :

      response.status === 401 ? 'Session expirée.' :

      response.status === 409 ? 'Cette course ne peut plus être annulée.' :

      `Annulation refusée par le serveur (${response.status}).`);

  }

  // 202 / demande seulement en attente ne signifie pas annulation confirmée.

  if (response.status === 202) throw new Error('Annulation en cours de traitement : vérifiez le statut de la course.');

  const body = await response.json().catch(() => null);

  const status = body?.course?.statut ?? body?.statut ?? body?.data?.course?.statut;

  if (status !== 'CANCELLED' && status !== 'cancelled' && status !== 'ANNULEE') {

    throw new Error('Le serveur n’a pas confirmé le statut annulé. Vérifiez votre course active.');

  }

}

function formatMinutes(seconds: number): string {

  return `${Math.max(1, Math.ceil(seconds / 60))} min`;

}

// Distance géométrique, pas la distance routière et pas une estimation de durée.

function directDistanceKm(a: Coords, b: Coords): number {

  const rad = (deg: number) => (deg * Math.PI) / 180;

  const lat = rad(b.latitude - a.latitude);

  const lon = rad(b.longitude - a.longitude);

  const h = Math.sin(lat / 2) ** 2 +

    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(lon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

}

export default function TricyclePremium() {

  const mapRef = useRef<MapView>(null);

  const destRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const rideListenersRef = useRef<Array<() => void>>([]);

  const mountedRef = useRef(false);

  const gpsRequestRef = useRef(false);

  const centeredRef = useRef(false);

  const submittingRef = useRef(false);

  const routeGenerationRef = useRef(0);

  const stateRef = useRef<AppState>('saisie');

  const [state, setState] = useState<AppState>('saisie');

  const [service, setService] = useState<ServiceType>('course');

  const [taille, setTaille] = useState('petit');

  const [pay, setPay] = useState<PaymentType>('cash');

  const [op, setOp] = useState('orange');

  const [pickup, setPickup] = useState('Ma position');

  const [dest, setDest] = useState('');

  const [destCoords, setDestCoords] = useState<Coords | null>(null);

  const [pos, setPos] = useState<Coords | null>(null);

  const [userLocation, setUserLocation] = useState<Coords | null>(null);

  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);

  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);

  const [rideId, setRideId] = useState<string | null>(null);

  const rideIdRef = useRef<string | null>(null);

  const cancelPendingRef = useRef(false);

  const [cancelPending, setCancelPending] = useState(false);

  const authToken = useAuthStore(s => s.accessToken);

  const [gpsLoading, setGpsLoading] = useState(true);

  const [gpsError, setGpsError] = useState<string | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);

  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle');

  const [routeError, setRouteError] = useState<string | null>(null);

  // Animations 100 % React Native : pas de nouvelle dépendance.

  const slideUp = useRef(new Animated.Value(90)).current;

  const cardFade = useRef(new Animated.Value(0)).current;

  const pulse = useRef(new Animated.Value(1)).current;

  const searchPulse = useRef(new Animated.Value(0.94)).current;

  const shineX = useRef(new Animated.Value(-100)).current;

  const liveOpacity = useRef(new Animated.Value(0.45)).current;

  // Montant client non fixé : le backend calcule et valide le tarif.
  const prix = 0;

  const driverDistance = state === 'accepte' ? roadRoute?.distanceMeters ?? null : null;

  const clearRideListeners = () => {

    rideListenersRef.current.forEach((unsubscribe) => {

      try { unsubscribe(); } catch (e) { console.warn('Nettoyage socket', e); }

    });

    rideListenersRef.current = [];

  };

  useEffect(() => {

    stateRef.current = state;

    slideUp.setValue(32);

    cardFade.setValue(0);

    Animated.parallel([

      Animated.spring(slideUp, { toValue: 0, damping: 19, stiffness: 150, mass: 0.8, useNativeDriver: true }),

      Animated.timing(cardFade, { toValue: 1, duration: 320, useNativeDriver: true }),

    ]).start();

  }, [state]);

  useEffect(() => {

    mountedRef.current = true;

    void initGPS();

    const markerLoop = Animated.loop(Animated.sequence([

      Animated.timing(pulse, { toValue: 1.07, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),

      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),

    ]));

    const shineLoop = Animated.loop(Animated.sequence([

      Animated.timing(shineX, { toValue: width + 80, duration: 1900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),

      Animated.timing(shineX, { toValue: -100, duration: 0, useNativeDriver: true }),

      Animated.delay(1700),

    ]));

    const liveLoop = Animated.loop(Animated.sequence([

      Animated.timing(liveOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),

      Animated.timing(liveOpacity, { toValue: 0.45, duration: 1000, useNativeDriver: true }),

    ]));

    markerLoop.start();

    shineLoop.start();

    liveLoop.start();

    // Socket activé après vérification de la session et démarrage de la commande.

    return () => {

      mountedRef.current = false;

      markerLoop.stop();

      shineLoop.stop();

      liveLoop.stop();

      locationSubscription.current?.remove();

      clearRideListeners();

      tricycleService.disconnect();

    };

  }, []);

  useEffect(() => {

    if (state !== 'recherche') return;

    const radar = Animated.loop(Animated.sequence([

      Animated.timing(searchPulse, { toValue: 1.14, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),

      Animated.timing(searchPulse, { toValue: 0.94, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),

    ]));

    radar.start();

    return () => { radar.stop(); searchPulse.setValue(0.94); };

  }, [state]);

  useEffect(() => {

    if (!mapReady || !userLocation || centeredRef.current) return;

    centeredRef.current = true;

    mapRef.current?.animateToRegion({

      ...userLocation, latitudeDelta: 0.014, longitudeDelta: 0.014,

    }, 850);

  }, [mapReady, userLocation]);

  // La carte reste visible même sans autorisation GPS : pas de faux point GPS sur Abidjan.

  async function initGPS() {

    if (gpsRequestRef.current) return;

    gpsRequestRef.current = true;

    if (mountedRef.current) {

      setGpsLoading(true);

      setGpsError(null);

    }

    try {

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {

        if (mountedRef.current) {

          setUserLocation(null);

          if (stateRef.current === 'saisie') setPickupCoords(null);

          setGpsError('Autorisez votre position pour commander une course.');

        }

        return;

      }

      const location = await Location.getCurrentPositionAsync({

        accuracy: Location.Accuracy.Balanced,

      });

      if (!mountedRef.current) return;

      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };

      setUserLocation(coords);

      if (stateRef.current === 'saisie') setPickupCoords(coords);

      // Un échec du géocodage ne doit jamais bloquer l'affichage du GPS.

      try {

        const [address] = await Location.reverseGeocodeAsync(coords);

        if (address && mountedRef.current) {

          const label = [address.street, address.district || address.city].filter(Boolean).join(', ');

          if (label) setPickup(label);

        }

      } catch (e) {

        console.warn('Adresse GPS indisponible', e);

      }

      if (!mountedRef.current) return;

      locationSubscription.current?.remove();

      locationSubscription.current = await Location.watchPositionAsync(

        { accuracy: Location.Accuracy.Balanced, timeInterval: 3500, distanceInterval: 10 },

        (loc) => {

          if (!mountedRef.current) return;

          const updated = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

          setUserLocation(updated);

          // Garder le point de départ choisi stable pendant le calcul du trajet.

          if (stateRef.current === 'saisie') setPickupCoords(current => current ?? updated);

        },

        (message) => { if (mountedRef.current) console.warn('Suivi GPS :', message); },

      );

    } catch (error) {

      console.warn('GPS indisponible :', error);

      if (mountedRef.current) setGpsError('Position indisponible. Réessayez ou activez le GPS.');

    } finally {

      gpsRequestRef.current = false;

      if (mountedRef.current) setGpsLoading(false);

    }

  }

  const recenter = async () => {

    if (!userLocation) {

      try {

        const permission = await Location.getForegroundPermissionsAsync();

        if (permission.status === 'granted' || permission.canAskAgain) {

          void initGPS();

          return;

        }

      } catch (e) {

        console.warn('Permission GPS :', e);

      }

      Alert.alert('Activer la localisation', 'Autorisez MESSAY dans les réglages de votre téléphone.', [

        { text: 'Plus tard', style: 'cancel' },

        { text: 'Réglages', onPress: () => { void Linking.openSettings(); } },

      ]);

      return;

    }

    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 750);

  };

  // Optionnel : marqueur approximatif de destination, sans service Directions payant.

  const previewDestination = async () => {

    const label = dest.trim();

    if (label.length < 4) { setDestCoords(null); return; }

    try {

      const query = /abidjan|côte d.ivoire|cote d.ivoire/i.test(label) ? label : `${label}, Abidjan, Côte d'Ivoire`;

      const results = await Location.geocodeAsync(query);

      if (mountedRef.current && results.length) {

        const candidate = { latitude: results[0].latitude, longitude: results[0].longitude };

        if (pickupCoords && directDistanceKm(pickupCoords, candidate) > 120) {

          Alert.alert('Destination imprécise', 'Précisez un quartier ou une adresse à Abidjan.');

          setDestCoords(null);

          return;

        }

        setDestCoords(candidate);

      } else if (mountedRef.current) {

        Alert.alert('Destination introuvable', 'Essayez une adresse plus précise à Abidjan.');

      }

    } catch (e) {

      console.warn('Destination non géocodée :', e);

    }

  };

  // Calcul d'itinéraire SUR LES RUES via notre backend (openrouteservice, données OSM).

  // En précommande : départ -> destination. Après attribution : chauffeur -> passager.

  useEffect(() => {

    const from = authToken && state === 'saisie' ? pickupCoords : authToken && state === 'accepte' ? pos : null;

    const to = authToken && state === 'saisie' ? destCoords : authToken && state === 'accepte' ? pickupCoords : null;

    if (!from || !to) {

      if (state === 'saisie' || state === 'accepte') {

        setRoadRoute(null);

        setRouteStatus('idle');

        setRouteError(null);

      }

      return;

    }

    // La position du chauffeur est quantifiée dans les dépendances ci-dessous

    // pour éviter une nouvelle requête à chaque événement GPS.

    const controller = new AbortController();

    let active = true;

    const currentRequest = ++routeGenerationRef.current;

    setRouteStatus('loading');

    setRouteError(null);

    setRoadRoute(null);

    const timeout = setTimeout(() => controller.abort(), 12000);

    void fetchRoadRoute(from, to, controller.signal)

      .then(result => {

        if (!active || !mountedRef.current || routeGenerationRef.current !== currentRequest) return;

        setRoadRoute(result);

        setRouteStatus('ready');

      })

      .catch(error => {

        if (!active || !mountedRef.current || routeGenerationRef.current !== currentRequest) return;

        console.warn('[MESSAY] Itinéraire routier :', error);

        setRouteStatus('error');

        setRouteError(controller.signal.aborted ? 'Le service d’itinéraire met trop de temps à répondre.' :

          error instanceof Error ? error.message : 'Route indisponible.');

      })

      .finally(() => clearTimeout(timeout));

    return () => { active = false; controller.abort(); clearTimeout(timeout); };

  }, [

    state, authToken,

    pickupCoords?.latitude, pickupCoords?.longitude,

    destCoords?.latitude, destCoords?.longitude,

    // Grille ~250 m ; pas de recalcul à chaque mouvement du chauffeur.

    pos ? Math.round(pos.latitude * 400) : null,

    pos ? Math.round(pos.longitude * 400) : null,

  ]);

  useEffect(() => {

    if (!mapReady || !roadRoute || (state !== 'saisie' && state !== 'accepte')) return;

    mapRef.current?.fitToCoordinates(roadRoute.coordinates, {

      edgePadding: { top: 165, right: 35, bottom: 390, left: 35 }, animated: true,

    });

  }, [mapReady, roadRoute, state]);

  const resetRideView = () => {
    routeGenerationRef.current += 1;
    clearRideListeners();
    tricycleService.setCurrentRideId(null);

    rideIdRef.current = null;

    setRideId(null);

    stateRef.current = 'saisie';

    setState('saisie');

    setPos(null);

    setDriverInfo(null);

    setRoadRoute(null);

    setRouteStatus('idle');

    setRouteError(null);

  };

  const commander = async () => {

    if (submittingRef.current || stateRef.current !== 'saisie') return;

    Keyboard.dismiss();

    if (!useAuthStore.getState().accessToken) {

      Alert.alert('Connexion requise', 'Connectez-vous à MESSAY avant de commander une course.');

      return;

    }

    if (!pickupCoords || !userLocation) {

      Alert.alert('Position GPS nécessaire', 'Activez la localisation puis touchez le bouton GPS sur la carte.');

      return;

    }

    if (!dest.trim() || !destCoords) {

      Alert.alert('Destination nécessaire', 'Indiquez une destination valide et attendez sa géolocalisation.');

      destRef.current?.focus();

      return;

    }

    submittingRef.current = true;

    stateRef.current = 'recherche';

    setState('recherche');

    setPos(null);

    setDriverInfo(null);

    setRideId(null);

    rideIdRef.current = null;

    clearRideListeners();

    try {

      tricycleService.connect();

      let bufferedAcceptance: RideSignal | null = null;

      const applyAcceptance = (event: RideSignal) => {

        if (!mountedRef.current || !sameRide(event, rideIdRef.current)) return;

        // Ne jamais inventer un chauffeur lorsqu'il manque dans la réponse.

        if (!event.driver || typeof event.driver !== 'object' || !event.driver.id) {

          console.warn('[MESSAY] Attribution sans chauffeur identifié :', event);

          return;

        }

        setDriverInfo(event.driver);

        setPos(null);

        setRoadRoute(null);

        setRouteStatus('idle');

        stateRef.current = 'accepte';

        setState('accepte');

      };

      const offAccepted = tricycleService.onRideAccepted((event: RideSignal) => {

        if (!rideIdRef.current) { bufferedAcceptance = event; return; }

        applyAcceptance(event);

      });

      const offLocation = tricycleService.onDriverLocation((event: RideSignal) => {

        if (!mountedRef.current || stateRef.current !== 'accepte' ||

            !sameRide(event, rideIdRef.current) ||

            !Number.isFinite(event.lat) || !Number.isFinite(event.lng)) return;

        setPos({ latitude: event.lat!, longitude: event.lng! });

      });

      const offCancelled = tricycleService.onRideCancelled((event) => {
      if (!mountedRef.current || !sameRide(event, rideIdRef.current)) return;
      const terminated = event.status === 'TERMINEE';
      resetRideView();
      Alert.alert(
        terminated ? 'Course terminée' : 'Course annulée',
        terminated ? 'Votre trajet est terminé.' : 'La course a été annulée sur le serveur.',
      );
    });

    if (typeof offAccepted === 'function') rideListenersRef.current.push(offAccepted);

      if (typeof offLocation === 'function') rideListenersRef.current.push(offLocation);
    rideListenersRef.current.push(offCancelled);

      const response: unknown = await tricycleService.createRide({

        pickup: pickup.trim(), dest: dest.trim(), pickupCoords, destCoords,

        service, prix, pay, op,

      });

      const id = extractRideId(response);

      if (!id) throw new Error('Le serveur n’a pas retourné l’identifiant de la course. Vérifier createRide().');

      rideIdRef.current = id;

      if (mountedRef.current) setRideId(id);

      if (bufferedAcceptance) applyAcceptance(bufferedAcceptance);

    } catch (error) {

      console.warn('Commande tricycle :', error);

      // Une réponse mal formée peut cacher une course déjà créée : ne pas confirmer son annulation.

      if (mountedRef.current) {

        resetRideView();

        Alert.alert('Commande non confirmée', error instanceof Error ? error.message : 'Vérifiez votre connexion et vos courses actives avant de réessayer.');

      }

    } finally {

      submittingRef.current = false;

    }

  };

  const annulerCourse = () => {

    const id = rideIdRef.current;

    if (!id || cancelPendingRef.current) {

      Alert.alert('Annulation indisponible', 'Aucune course identifiée. Consultez vos courses actives.');

      return;

    }

    Alert.alert('Annuler la course ?', 'Votre demande sera envoyée au serveur. L’annulation doit être confirmée avant de fermer le suivi.', [

      { text: 'Conserver la course', style: 'cancel' },

      { text: 'Confirmer l’annulation', style: 'destructive', onPress: async () => {

        if (cancelPendingRef.current) return;

        cancelPendingRef.current = true;

        setCancelPending(true);

        try {

          await cancelTricycleRide(id);

          if (!mountedRef.current) return;

          resetRideView();

          Alert.alert('Course annulée', 'L’annulation a été confirmée par le serveur.');

        } catch (error) {

          Alert.alert('Annulation non confirmée', error instanceof Error ? error.message : 'Réessayez ou contactez le support.');

        } finally {

          cancelPendingRef.current = false;

          if (mountedRef.current) setCancelPending(false);

        }

      } },

    ]);

  };

  const quitterSuivi = () => {

    Alert.alert('Quitter le suivi ?', 'La course reste active. Vous pourrez la retrouver depuis vos courses en cours, si cette fonctionnalité est disponible.', [

      { text: 'Rester', style: 'cancel' },

      { text: 'Quitter sans annuler', onPress: resetRideView },

    ]);

  };

  const contacterChauffeur = async (method: 'tel' | 'sms') => {

    const raw = String(driverInfo?.phone ?? driverInfo?.telephone ?? '');

    const phone = raw.replace(/[^+\d]/g, '');

    if (!phone) { Alert.alert('Contact indisponible', 'Le numéro du chauffeur n’a pas été transmis.'); return; }

    try {

      await Linking.openURL(`${method}:${phone}`);

    } catch {

      Alert.alert('Impossible d’ouvrir le téléphone', 'Vérifiez les applications installées.');

    }

  };

  return (

    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

      <View style={s.container}>

        <StatusBar barStyle="dark-content" />

        <MapView

          ref={mapRef}

          style={StyleSheet.absoluteFill}

          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}

          mapType="standard"

          userInterfaceStyle="light"

          initialRegion={{ ...ABIDJAN, latitudeDelta: 0.06, longitudeDelta: 0.06 }}

          showsUserLocation={!!userLocation}

          showsMyLocationButton={false}

          showsCompass

          rotateEnabled

          onMapReady={() => setMapReady(true)}

          onMapLoaded={() => setMapReady(true)}

        >

          {pickupCoords && (

            <Marker coordinate={pickupCoords} title="Votre départ" description={pickup}>

              <View style={s.clientPin}><View style={s.clientDot} /></View>

            </Marker>

          )}

          {destCoords && state === 'saisie' && (

            <Marker coordinate={destCoords} pinColor="#FF6B35" title="Destination indicative" description={dest} />

          )}

          {roadRoute && (state === 'saisie' || state === 'accepte') && (

            <Polyline coordinates={roadRoute.coordinates} strokeWidth={6}

              strokeColor="#F97316" lineCap="round" lineJoin="round" />

          )}

          {state === 'accepte' && pos && (

            <Marker coordinate={pos} title="Chauffeur (position reçue)" anchor={{ x: 0.5, y: 0.5 }}>

              <Animated.View style={[s.triWrap, { transform: [{ scale: pulse }] }]}>

                <Image source={TRICYCLE_ICON} style={s.tri} resizeMode="contain" />

                <View style={s.pulseRing} />

              </Animated.View>

            </Marker>

          )}

        </MapView>

        {/* Informations GPS au-dessus de la carte, mais hors du formulaire. */}

        <View style={s.mapTopBar} pointerEvents="box-none">

          <BlurView intensity={10} tint="light" style={s.gpsBadge}>

            <Animated.View style={[s.gpsIndicator, {

              opacity: userLocation ? liveOpacity : 1,

              backgroundColor: userLocation ? '#22c55e' : gpsLoading ? '#FFB020' : '#fb7185',

            }]} />

            <Text style={s.gpsBadgeTxt} numberOfLines={1}>

              {userLocation ? 'Position GPS active' : gpsLoading ? 'Recherche GPS...' : 'GPS indisponible'}

            </Text>

          </BlurView>

          <TouchableOpacity onPress={recenter} activeOpacity={0.75} style={[s.locateButton, state === 'accepte' && s.locateOnRide]}>

            <Ionicons name="locate" size={22} color="#FF6B35" />

          </TouchableOpacity>

        </View>

        {gpsError && !userLocation && (

          <TouchableOpacity style={s.gpsNotice} onPress={recenter} activeOpacity={0.82}>

            <Ionicons name="warning-outline" size={16} color="#FFCC83" />

            <Text style={s.gpsNoticeText}>{gpsError}  •  Appuyer ici</Text>

          </TouchableOpacity>

        )}

        {destCoords && pickupCoords && state === 'saisie' && (

          <View pointerEvents="none" style={s.routeNotice}>

            <Ionicons name="navigate-circle" size={17} color="#F97316" />

            <View style={{ flex: 1 }}>

              <Text style={s.routeNoticeText}>

                {routeStatus === 'ready' && roadRoute

                  ? `${(roadRoute.distanceMeters / 1000).toFixed(1)} km • ${formatMinutes(roadRoute.durationSeconds)} par les rues`

                  : routeStatus === 'loading' ? 'Calcul de l’itinéraire sur les rues...'

                  : routeStatus === 'error' ? (routeError ?? 'Itinéraire indisponible')

                  : !authToken ? 'Connectez-vous pour calculer l’itinéraire' : 'Saisissez une destination pour voir le trajet'}

              </Text>

              {routeStatus === 'ready' && <Text style={s.routeAttribution}>

                © openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors

              </Text>}

            </View>

          </View>

        )}

        {state === 'accepte' && (

          <View style={s.hud} pointerEvents="none">

            <BlurView intensity={10} tint="light" style={s.hudCard}>

              <View style={s.hudRow}>

                <View><Text style={s.hudLab}>TEMPS ESTIMÉ</Text><Text style={s.hudVal}>{roadRoute ? formatMinutes(roadRoute.durationSeconds) : '—'}</Text></View>

                <View style={s.hudSep} />

                <View><Text style={s.hudLab}>PAR LES RUES</Text><Text style={s.hudVal}>

                  {driverDistance === null ? '—' : `${(driverDistance / 1000).toFixed(1)} km`}

                </Text></View>

                <View style={s.hudLive}><Animated.View style={[s.liveDot, { opacity: liveOpacity }]} /><Text style={s.liveTxt}>GPS</Text></View>

              </View>

              <Text style={s.hudHint}>

                {!authToken ? 'Connectez-vous à MESSAY pour calculer l’itinéraire' : routeStatus === 'ready' ? 'Itinéraire routier estimé • pas une navigation GPS' : routeStatus === 'loading' ? 'Calcul du trajet sur les rues...' : routeStatus === 'error' ? (routeError ?? 'Itinéraire routier indisponible') : 'En attente de la position du chauffeur'}

              </Text>

              {routeStatus === 'ready' && <Text style={s.routeAttribution}>

                © openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors

              </Text>}

            </BlurView>

          </View>

        )}

        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios'? 'padding' : 'height'} keyboardVerticalOffset={90} style={s.kb}>

          <Animated.View style={[s.bottom, state === 'accepte' && s.bottomRaised, { opacity: cardFade, transform: [{ translateY: slideUp }] }]}>

            <BlurView intensity={10} tint="light" style={[s.card, state === 'accepte' && s.cardCompact]}>

              {state === 'saisie' && (

                <>

                  <View style={s.tabs}>

                    {[{ id: 'course', icon: 'account', label: 'Passager' }, { id: 'colis', icon: 'cube', label: 'Colis' }].map(t => (

                      <TouchableOpacity key={t.id} onPress={() => {
                      if (t.id === 'colis') { Alert.alert('Service indisponible', 'Le transport de colis n’est pas encore activé.'); return; }
                      setService('course');
                    }} style={[s.tab, service === t.id && s.tabOn]} activeOpacity={0.7}>

                        <MaterialCommunityIcons name={t.icon as any} size={18} color={service === t.id? '#F97316' : '#64748B'} />

                        <Text style={[s.tabTxt, service === t.id && s.tabTxtOn]}>{t.label}</Text>

                      </TouchableOpacity>

                    ))}

                  </View>

                  {service === 'colis' && (

                    <View style={s.sizes}>

                      {['petit', 'moyen', 'grand'].map(sz => (

                        <TouchableOpacity key={sz} onPress={() => setTaille(sz)} style={[s.size, taille === sz && s.sizeOn]} activeOpacity={0.7}>

                          <Text style={[s.sizeTxt, taille === sz && s.sizeTxtOn]}>{sz.toUpperCase()}</Text>

                        </TouchableOpacity>

                      ))}

                    </View>

                  )}

                  <View style={s.inputs}>

                    <View style={s.inpRow}>

                      <View style={s.dot} />

                      <TextInput style={s.inp} placeholder="Activez votre position" placeholderTextColor="#94A3B8" value={pickupCoords ? pickup : ''} editable={false} />

                    </View>

                    <View style={s.line} />

                    <View style={s.inpRow}>

                      <Ionicons name="location" size={16} color="#FF6B35" />

                      <TextInput ref={destRef} style={s.inp} placeholder="Où allez-vous?" placeholderTextColor="#94A3B8" value={dest} onChangeText={(v) => { setDest(v); setDestCoords(null); }} onEndEditing={() => { void previewDestination(); }} returnKeyType="done" onSubmitEditing={() => { void previewDestination(); }} />

                    </View>

                  </View>

                  <View style={s.payWrap}>

                    <TouchableOpacity onPress={() => setPay('cash')} style={[s.pay, pay === 'cash' && s.payOn]} activeOpacity={0.7}>

                      <MaterialIcons name="payments" size={18} color={pay === 'cash'? '#16A34A' : '#64748B'} />

                      <Text style={[s.payTxt, pay === 'cash' && { color: '#22c55e' }]}>Cash</Text>

                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setPay('momo')} style={[s.pay, pay === 'momo' && s.payOn]} activeOpacity={0.7}>

                      <MaterialIcons name="phone-iphone" size={18} color={pay === 'momo'? '#0284C7' : '#64748B'} />

                      <Text style={[s.payTxt, pay === 'momo' && { color: '#0ea5e9' }]}>Mobile</Text>

                    </TouchableOpacity>

                  </View>

                  {pay === 'momo' && (

                    <View style={s.ops}>

                      {OPERATEURS.map(o => (

                        <TouchableOpacity key={o.id} onPress={() => setOp(o.id)} style={[s.op, op === o.id && s.opOn]} activeOpacity={0.7}>

                          <Image source={o.logo} style={s.opImg} />

                        </TouchableOpacity>

                      ))}

                    </View>

                  )}

                  {!userLocation && (

                    <TouchableOpacity style={s.inlineGpsHint} onPress={recenter}>

                      <Ionicons name="location-outline" size={14} color="#FFB020" />

                      <Text style={s.inlineGpsHintText}>Activez le GPS pour pouvoir commander</Text>

                    </TouchableOpacity>

                  )}

                  <TouchableOpacity onPress={commander} activeOpacity={0.9}>

                    <LinearGradient colors={['#FF6B35', '#FF8E53', '#ea580c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>

                      <Animated.View style={[s.shine, { transform: [{ translateX: shineX }] }]} />

                      <Text style={s.ctaTxt}>Commander </Text>

                      <Ionicons name="arrow-forward" size={20} color="#fff" />

                    </LinearGradient>

                  </TouchableOpacity>

                </>

              )}

              {state === 'recherche' && (

                <View style={s.search}>

                  <Animated.View style={[s.searchIcon, { transform: [{ scale: searchPulse }] }]}><Ionicons name="navigate" size={28} color="#FF6B35" /></Animated.View>

                  <Text style={s.searchT}>Recherche chauffeur...</Text>

                  <Text style={s.searchSub}>Recherche en cours • {pickup}</Text>

                  <View style={s.searchDots}><View style={s.searchDot} /><View style={s.searchDot} /><View style={s.searchDot} /></View>

                  <TouchableOpacity onPress={annulerCourse} disabled={!rideId || cancelPending} style={s.cancelFull}>

                    <Text style={s.cancelFullTxt}>{cancelPending ? 'Annulation...' : 'Annuler la course'}</Text>

                  </TouchableOpacity>

                  <TouchableOpacity onPress={quitterSuivi} style={s.searchExit}><Text style={s.searchExitTxt}>Quitter le suivi</Text></TouchableOpacity>

                </View>

              )}

              {state === 'accepte' && (

                <>

                  <View style={s.rideHeadCompact}>

                    <View>

                      <Text style={s.rideLab}>CHAUFFEUR ATTRIBUÉ</Text>

                      <Text style={s.rideTimeSmall}>{pos ? 'Position reçue' : 'Position en attente'}</Text>

                    </View>

                    <Animated.View style={[s.dotStat, { backgroundColor: '#22c55e', opacity: liveOpacity }]} />

                  </View>

                  <View style={s.driverCompact}>

                    <View style={[s.avaSmall, s.avatarFallback]}>

                      <Ionicons name="person" color="#FF6B35" size={23} />

                    </View>

                    <View style={{ flex: 1 }}>

                      <Text style={s.dNameSmall}>{driverInfo?.name || 'Nom du chauffeur non transmis'}</Text>

                      <Text style={s.dInfoSmall} numberOfLines={2}>

                        {[driverInfo?.vehicle, driverInfo?.plate, driverInfo?.rating ? `★ ${driverInfo.rating}` : null]

                          .filter(Boolean).join(' • ') || 'Informations à confirmer'}

                      </Text>

                    </View>

                    <TouchableOpacity onPress={() => { void contacterChauffeur('tel'); }}

                      style={s.callSmall} activeOpacity={0.7} accessibilityLabel="Appeler le chauffeur">

                      <Ionicons name="call" size={18} color="#fff" />

                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { void contacterChauffeur('sms'); }}

                      style={[s.callSmall, { backgroundColor: '#0ea5e9', marginLeft: 8 }]}

                      activeOpacity={0.7} accessibilityLabel="Envoyer un SMS au chauffeur">

                      <Ionicons name="chatbubble" size={16} color="#fff" />

                    </TouchableOpacity>

                  </View>

                  <TouchableOpacity onPress={annulerCourse} disabled={cancelPending || !rideId}

                  style={[s.cancelFull, { marginBottom: 9, opacity: cancelPending ? 0.55 : 1 }]} activeOpacity={0.7}>

                  <Ionicons name="close-circle" size={18} color="#BE123C" />

                  <Text style={s.cancelFullTxt}>{cancelPending ? 'Annulation en cours...' : 'Annuler la course'}</Text>

                </TouchableOpacity>

                <TouchableOpacity onPress={quitterSuivi} style={s.exitFull} activeOpacity={0.7}>

                    <Ionicons name="close-circle-outline" size={18} color="#BE123C" />

                    <Text style={s.exitFullTxt}>Quitter le suivi (sans annuler la course)</Text>

                  </TouchableOpacity>

                </>

              )}

            </BlurView>

          </Animated.View>

        </KeyboardAvoidingView>

      </View>

    </TouchableWithoutFeedback>

  );

}

const s = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F1F6FA' },

  kb: { flex: 1, justifyContent: 'flex-end' },

  bottom: { marginHorizontal: 16, marginBottom: Platform.OS === 'ios' ? 100 : 90, shadowColor: '#334155', shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: 10 }, elevation: 15 },

  bottomRaised: { marginBottom: Platform.OS === 'ios'? 140 : 130 },

  card: { borderRadius: 28, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.98)', overflow: 'hidden' },

  cardCompact: { padding: 16, borderRadius: 24 },

  tabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 12 },

  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },

  tabOn: { backgroundColor: '#FFEEE5' },

  tabTxt: { color: '#64748B', fontWeight: '700', fontSize: 13 },

  tabTxtOn: { color: '#E85D22' },

  sizes: { flexDirection: 'row', gap: 8, marginBottom: 12 },

  size: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  sizeOn: { backgroundColor: '#FFEEE5', borderColor: '#F97316' },

  sizeTxt: { color: '#64748B', fontWeight: '800', fontSize: 12 },

  sizeTxtOn: { color: '#FF6B35' },

  inputs: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },

  inpRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#DBEAFE' },

  inp: { flex: 1, color: '#172033', fontSize: 15, fontWeight: '600', height: 42, paddingVertical: 0 },

  line: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8, marginLeft: 22 },

  payWrap: { flexDirection: 'row', gap: 10, marginBottom: 10 },

  pay: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },

  payOn: { borderColor: '#FDAE85', backgroundColor: '#FFF4ED' },

  payTxt: { color: '#526078', fontWeight: '700' },

  ops: { flexDirection: 'row', gap: 10, marginBottom: 12, justifyContent: 'center' },

  op: { width: 56, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  opOn: { borderColor: '#F97316', backgroundColor: '#FFF4ED' },

  opImg: { width: 26, height: 26, resizeMode: 'contain' },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8, overflow: 'hidden' },

  ctaTxt: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  shine: { position: 'absolute', left: 0, top: 0, width: 40, height: '100%', backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ skewX: '-20deg' }] },

  search: { alignItems: 'center', paddingVertical: 24 },

  searchIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF0E7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },

  searchT: { color: '#172033', fontSize: 17, fontWeight: '800' },

  searchSub: { color: '#64748B', fontSize: 13, marginTop: 4 },

  hud: { position: 'absolute', top: Platform.OS === 'ios' ? 125 : 112, left: 16, right: 16, zIndex: 8 },

  hudCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.96)', overflow: 'hidden', shadowColor: '#334155', shadowOpacity: 0.1, shadowRadius: 12 },

  hudRow: { flexDirection: 'row', alignItems: 'center' },

  hudLab: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  hudVal: { color: '#172033', fontSize: 22, fontWeight: '900', marginTop: 2 },

  hudSep: { width: 1, height: 36, backgroundColor: '#E2E8F0', marginHorizontal: 16 },

  hudLive: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DCFCE7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#86EFAC' },

  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },

  liveTxt: { color: '#86efac', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  rideHeadCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  rideLab: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  rideTimeSmall: { color: '#172033', fontSize: 24, fontWeight: '900', marginTop: 2 },

  dotStat: { width: 10, height: 10, borderRadius: 5 },

  driverCompact: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },

  avaSmall: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FF6B35' },

  dNameSmall: { color: '#172033', fontWeight: '800', fontSize: 15 },

  dInfoSmall: { color: '#64748B', fontSize: 12, marginTop: 2 },

  callSmall: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center' },

  cancelFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#FFF1F2', borderRadius: 12, borderWidth: 1, borderColor: '#FDA4AF' },

  cancelFullTxt: { color: '#BE123C', fontWeight: '800', fontSize: 14 },

  exitFull: { alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1' },

  exitFullTxt: { color: '#475569', fontWeight: '700', fontSize: 12 },

  clientPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(14,165,233,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0ea5e9' },

  clientDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0ea5e9' },

  triWrap: { padding: 8, backgroundColor: 'white', borderRadius: 20, elevation: 10, shadowColor: '#FF6B35', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  tri: { width: 36, height: 36 },

  pulseRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,107,53,0.4)' },

  mapTopBar: { position: 'absolute', top: Platform.OS === 'ios' ? 62 : 48, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 7 },

  gpsBadge: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 24, paddingHorizontal: 13, paddingVertical: 10, maxWidth: '75%', backgroundColor: 'rgba(255,255,255,0.97)', shadowColor: '#334155', shadowOpacity: 0.08, shadowRadius: 10 },

  gpsIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },

  gpsBadgeTxt: { fontSize: 12, fontWeight: '800', color: '#172033' },

  locateButton: { marginTop: 85, width: 45, height: 45, borderRadius: 23, borderColor: '#E2E8F0', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.98)', alignItems: 'center', justifyContent: 'center', shadowColor: '#334155', shadowOpacity: 0.14, shadowRadius: 10 },

  locateOnRide: { marginTop: 175 },

  gpsNotice: { position: 'absolute', top: Platform.OS === 'ios' ? 119 : 104, left: 16, right: 16, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', zIndex: 6, borderColor: '#FBBF24', borderWidth: 1 },

  gpsNoticeText: { flex: 1, color: '#92400E', fontSize: 12, fontWeight: '700' },

  routeNotice: { position: 'absolute', top: Platform.OS === 'ios' ? 120 : 105, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#FED7AA' },

  routeNoticeText: { color: '#172033', fontSize: 11, fontWeight: '700' },

  routeAttribution: { color: '#64748B', fontSize: 9, marginTop: 3 },

  hudHint: { color: '#64748B', fontSize: 10, marginTop: 9, fontWeight: '600' },

  inlineGpsHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7 },

  inlineGpsHintText: { color: '#FFB020', fontSize: 12, fontWeight: '700' },

  searchDots: { flexDirection: 'row', gap: 7, marginTop: 13 },

  searchDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B35', opacity: 0.65 },

  searchExit: { marginTop: 13, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E1' },

  searchExitTxt: { color: '#475569', fontWeight: '700', fontSize: 12 },

  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E7' },

});
