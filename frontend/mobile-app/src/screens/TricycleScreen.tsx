import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions,
  Animated, StatusBar, Platform, KeyboardAvoidingView, Image,
  Alert, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location'; // ✅ AJOUT
import { tricycleService } from '../services/tricycleService';

const { width } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyCsHs_23j3tUjHDvBzNLf0DFh-FtRTFP6U';
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

export default function TricyclePremium() {
  const mapRef = useRef<MapView>(null);
  const destRef = useRef<TextInput>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [state, setState] = useState<AppState>('saisie');
  const [service, setService] = useState<ServiceType>('course');
  const [taille, setTaille] = useState('petit');
  const [pay, setPay] = useState<PaymentType>('cash');
  const [op, setOp] = useState('orange');
  const [pickup, setPickup] = useState('Ma position');
  const [dest, setDest] = useState('');
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null); // ✅ NOUVEAU
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null); // ✅ MODIFIÉ
  const [eta, setEta] = useState(180);
  const [distance, setDistance] = useState(1.2);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [mapError, setMapError] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(true); // ✅ NOUVEAU

  const slideUp = useRef(new Animated.Value(100)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const shineX = useRef(new Animated.Value(-100)).current;

  const prix = service === 'course'
  ? 500
    : taille === 'petit'? 500 : taille === 'moyen'? 1500 : 3000;

  // ✅ NOUVEAU : Initialisation GPS
  useEffect(() => {
    initGPS();

    Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true })
    ])).start();
    Animated.loop(Animated.timing(shineX, { toValue: width, duration: 3000, useNativeDriver: true })).start();

    tricycleService.connect();

    return () => {
      tricycleService.disconnect();
      locationSubscription.current?.remove();
    };
  }, []);

  // ✅ NOUVEAU : Fonction GPS corrigée
  const initGPS = async () => {
    try {
      setGpsLoading(true);

      // 1. Demande permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status!== 'granted') {
        Alert.alert('GPS requis', 'Activez la localisation pour utiliser l\'app');
        setGpsLoading(false);
        return;
      }

      // 2. Position actuelle
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      setPickupCoords(coords);

      // 3. Adresse
      const [address] = await Location.reverseGeocodeAsync(coords);
      if (address) {
        const addr = `${address.street || ''} ${address.district || address.city || 'Abidjan'}`.trim();
        setPickup(addr || 'Ma position');
      }

      // 4. Centre carte
      mapRef.current?.animateToRegion({
       ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);

      // 5. Suivi en temps réel
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          const newCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(newCoords);
          if (state === 'saisie') {
            setPickupCoords(newCoords);
          }
        }
      );

      setGpsLoading(false);
    } catch (error) {
      console.error('GPS Error:', error);
      setGpsLoading(false);
      // Fallback Abidjan
      const fallback = { latitude: 5.3590, longitude: -4.0083 };
      setUserLocation(fallback);
      setPickupCoords(fallback);
    }
  };

  const commander = async () => {
    try {
      Keyboard.dismiss();
      if (!pickup.trim() ||!dest.trim() ||!pickupCoords) {
        Alert.alert('Trajet requis', 'Activez le GPS et indiquez la destination');
        return;
      }

      setState('recherche');
      setMapError(false);

      await tricycleService.createRide({
        pickup,
        dest,
        pickupCoords, // ✅ Envoie vraies coordonnées
        service,
        prix,
        pay,
        op
      });

      const cleanupLocation = tricycleService.onDriverLocation((data) => {
        const newPos = { latitude: data.lat, longitude: data.lng };
        setPos(newPos);
        mapRef.current?.animateCamera({ center: newPos, zoom: 16 }, { duration: 1000 });
      });

      const cleanupAccepted = tricycleService.onRideAccepted((data) => {
        setDriverInfo(data.driver);
        setState('accepte');
        // ✅ Position initiale réaliste (800m autour)
        if (userLocation) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 0.008;
          setPos({
            latitude: userLocation.latitude + Math.cos(angle) * dist,
            longitude: userLocation.longitude + Math.sin(angle) * dist,
          });
        }
      });

      return () => {
        cleanupLocation?.();
        cleanupAccepted?.();
      };
    } catch (error) {
      console.error('Erreur commande:', error);
      Alert.alert('Erreur', 'Impossible de commander');
      setState('saisie');
    }
  };

  const annuler = () => {
    Alert.alert('Annuler?', 'Le chauffeur sera notifié', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: () => {
        setState('saisie');
        setPos(null);
        setDriverInfo(null);
        setDest('');
        tricycleService.disconnect();
        tricycleService.connect();
      }}
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // ✅ Attend GPS
  if (gpsLoading ||!userLocation) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="location" size={48} color="#FF6B35" />
        <Text style={{ color: 'white', marginTop: 16, fontSize: 16, fontWeight: '700' }}>
          Localisation GPS...
        </Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={s.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
           ...userLocation,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          customMapStyle={darkMap}
        >
          {state === 'accepte' && pos && pickupCoords && (
            <>
              {!mapError? (
                <MapViewDirections
                  origin={pos}
                  destination={pickupCoords}
                  apikey={GOOGLE_MAPS_APIKEY}
                  strokeWidth={5}
                  strokeColor="#FF6B35"
                  mode="DRIVING"
                  onReady={(result) => {
                    setDistance(result.distance);
                    setEta(Math.round(result.duration * 60));
                    mapRef.current?.fitToCoordinates(result.coordinates, {
                      edgePadding: { top: 120, right: 40, bottom: 340, left: 40 },
                      animated: true,
                    });
                  }}
                  onError={() => setMapError(true)}
                />
              ) : (
                <Polyline coordinates={[pos, pickupCoords]} strokeWidth={5} strokeColor="#FF6B35" />
              )}

              <Marker coordinate={pickupCoords} title="Vous">
                <View style={s.clientPin}><View style={s.clientDot} /></View>
              </Marker>

              <Marker coordinate={pos} anchor={{ x: 0.5, y: 0.5 }} flat>
                <Animated.View style={[s.triWrap, { transform: [{ scale: pulse }] }]}>
                  <Image source={TRICYCLE_ICON} style={s.tri} />
                  <View style={s.pulseRing} />
                </Animated.View>
              </Marker>
            </>
          )}
        </MapView>

        {state === 'accepte' && (
          <View style={s.hud} pointerEvents="none">
            <BlurView intensity={85} tint="dark" style={s.hudCard}>
              <View style={s.hudRow}>
                <View><Text style={s.hudLab}>ARRIVÉE</Text><Text style={s.hudVal}>{formatTime(eta)}</Text></View>
                <View style={s.hudSep} />
                <View><Text style={s.hudLab}>DISTANCE</Text><Text style={s.hudVal}>{distance.toFixed(1)} km</Text></View>
                <View style={s.hudLive}><View style={s.liveDot} /><Text style={s.liveTxt}>LIVE</Text></View>
              </View>
            </BlurView>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios'? 'padding' : 'height'} keyboardVerticalOffset={90} style={s.kb}>
          <Animated.View style={[s.bottom, state === 'accepte' && s.bottomRaised, { transform: [{ translateY: slideUp }] }]}>
            <BlurView intensity={95} tint="dark" style={[s.card, state === 'accepte' && s.cardCompact]}>
              {state === 'saisie' && (
                <>
                  <View style={s.tabs}>
                    {[{ id: 'course', icon: 'account', label: 'Passager' }, { id: 'colis', icon: 'cube', label: 'Colis' }].map(t => (
                      <TouchableOpacity key={t.id} onPress={() => setService(t.id as ServiceType)} style={[s.tab, service === t.id && s.tabOn]} activeOpacity={0.7}>
                        <MaterialCommunityIcons name={t.icon as any} size={18} color={service === t.id? '#FF6B35' : '#64748b'} />
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
                      <TextInput style={s.inp} placeholder="Lieu de départ" placeholderTextColor="#475569" value={pickup} onChangeText={setPickup} returnKeyType="next" onSubmitEditing={() => destRef.current?.focus()} />
                    </View>
                    <View style={s.line} />
                    <View style={s.inpRow}>
                      <Ionicons name="location" size={16} color="#FF6B35" />
                      <TextInput ref={destRef} style={s.inp} placeholder="Où allez-vous?" placeholderTextColor="#475569" value={dest} onChangeText={setDest} returnKeyType="done" onSubmitEditing={commander} />
                    </View>
                  </View>

                  <View style={s.payWrap}>
                    <TouchableOpacity onPress={() => setPay('cash')} style={[s.pay, pay === 'cash' && s.payOn]} activeOpacity={0.7}>
                      <MaterialIcons name="payments" size={18} color={pay === 'cash'? '#22c55e' : '#64748b'} />
                      <Text style={[s.payTxt, pay === 'cash' && { color: '#22c55e' }]}>Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPay('momo')} style={[s.pay, pay === 'momo' && s.payOn]} activeOpacity={0.7}>
                      <MaterialIcons name="phone-iphone" size={18} color={pay === 'momo'? '#0ea5e9' : '#64748b'} />
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

                  <TouchableOpacity onPress={commander} activeOpacity={0.9}>
                    <LinearGradient colors={['#FF6B35', '#FF8E53', '#ea580c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                      <Animated.View style={[s.shine, { transform: [{ translateX: shineX }] }]} />
                      <Text style={s.ctaTxt}>Commander • {prix.toLocaleString()} FCFA</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {state === 'recherche' && (
                <View style={s.search}>
                  <View style={s.searchIcon}><Ionicons name="search" size={28} color="#FF6B35" /></View>
                  <Text style={s.searchT}>Recherche chauffeur...</Text>
                  <Text style={s.searchSub}>GPS actif • {pickup}</Text>
                </View>
              )}

              {state === 'accepte' && driverInfo && (
                <>
                  <View style={s.rideHeadCompact}>
                    <View><Text style={s.rideLab}>CHAUFFEUR EN ROUTE</Text><Text style={s.rideTimeSmall}>{Math.ceil(eta / 60)} min</Text></View>
                    <View style={[s.dotStat, { backgroundColor: '#22c55e' }]} />
                  </View>
                  <View style={s.driverCompact}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=200' }} style={s.avaSmall} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.dNameSmall}>{driverInfo.name}</Text>
                      <Text style={s.dInfoSmall}>{driverInfo.vehicle} • {driverInfo.plate} • ⭐ {driverInfo.rating}</Text>
                    </View>
                    <TouchableOpacity style={s.callSmall} activeOpacity={0.7}><Ionicons name="call" size={18} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity style={[s.callSmall, { backgroundColor: '#0ea5e9', marginLeft: 8 }]} activeOpacity={0.7}><Ionicons name="chatbubble" size={16} color="#fff" /></TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={annuler} style={s.cancelFull} activeOpacity={0.7}>
                    <Ionicons name="close-circle-outline" size={18} color="#fca5a5" />
                    <Text style={s.cancelFullTxt}>Annuler la course</Text>
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

const darkMap = [ { elementType: 'geometry', stylers: [{ color: '#0f172a' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] }, { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c4a6e' }] }, ];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  kb: { flex: 1, justifyContent: 'flex-end' },
  bottom: { marginHorizontal: 16, marginBottom: Platform.OS === 'ios'? 100 : 90, shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 25, shadowOffset: { width: 0, height: 10 }, elevation: 30 },
  bottomRaised: { marginBottom: Platform.OS === 'ios'? 140 : 130 },
  card: { borderRadius: 28, padding: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.96)', overflow: 'hidden' },
  cardCompact: { padding: 16, borderRadius: 24 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, padding: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabOn: { backgroundColor: 'rgba(255,107,53,0.22)' },
  tabTxt: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  tabTxtOn: { color: '#FF6B35' },
  sizes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  size: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  sizeOn: { backgroundColor: 'rgba(255,107,53,0.22)', borderColor: '#FF6B35' },
  sizeTxt: { color: '#64748b', fontWeight: '800', fontSize: 12 },
  sizeTxtOn: { color: '#FF6B35' },
  inputs: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  inpRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: '#0f172a' },
  inp: { flex: 1, color: 'white', fontSize: 15, fontWeight: '600', height: 42, paddingVertical: 0 },
  line: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8, marginLeft: 22 },
  payWrap: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  pay: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent' },
  payOn: { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)' },
  payTxt: { color: '#64748b', fontWeight: '700' },
  ops: { flexDirection: 'row', gap: 10, marginBottom: 12, justifyContent: 'center' },
  op: { width: 56, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  opOn: { borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.22)' },
  opImg: { width: 26, height: 26, resizeMode: 'contain' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8, overflow: 'hidden' },
  ctaTxt: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  shine: { position: 'absolute', left: 0, top: 0, width: 40, height: '100%', backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ skewX: '-20deg' }] },
  search: { alignItems: 'center', paddingVertical: 24 },
  searchIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,107,53,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  searchT: { color: 'white', fontSize: 17, fontWeight: '800' },
  searchSub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  hud: { position: 'absolute', top: 55, left: 16, right: 16, zIndex: 10 },
  hudCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  hudRow: { flexDirection: 'row', alignItems: 'center' },
  hudLab: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  hudVal: { color: 'white', fontSize: 22, fontWeight: '900', marginTop: 2 },
  hudSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 16 },
  hudLive: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveTxt: { color: '#86efac', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  rideHeadCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rideLab: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  rideTimeSmall: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 2 },
  dotStat: { width: 10, height: 10, borderRadius: 5 },
  driverCompact: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  avaSmall: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FF6B35' },
  dNameSmall: { color: 'white', fontWeight: '800', fontSize: 15 },
  dInfoSmall: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  callSmall: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center' },
  cancelFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  cancelFullTxt: { color: '#fca5a5', fontWeight: '800', fontSize: 14 },
  clientPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(14,165,233,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0ea5e9' },
  clientDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0ea5e9' },
  triWrap: { padding: 8, backgroundColor: 'white', borderRadius: 20, elevation: 10, shadowColor: '#FF6B35', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  tri: { width: 36, height: 36 },
  pulseRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,107,53,0.4)' },
});