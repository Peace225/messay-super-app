import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  AccessibilityInfo,

  ActivityIndicator,

  Alert,

  Animated,

  ImageBackground,

  Keyboard,

  Modal,

  Platform,

  Pressable,

  ScrollView,

  StatusBar,

  StyleSheet,

  Text,

  TextInput,

  View,

  type TextInputInstance,

} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { supabase } from '../services/supabase';

const DEFAULT_COLOR = '#F97316';

const HERO_IMAGE = require('../../assets/images/bus.jpg');

interface CompanyRow {

  id: string | number;

  name: string;

  color?: string | null;

  couleur?: string | null;

  is_active?: boolean | null;

  is_verified?: boolean | null;

}

interface GareRow {

  id: string | number;

  nom?: string | null;

  ville: string | null;

  adresse?: string | null;

}

interface ScheduleRow {

  id: string | number;

  heure_depart?: string | null;

  destination_id?: string | number | null;

}

interface DestinationRow {

  id: string | number;

  ville: string | null;

  prix?: number | string | null;

  duree?: string | null;

  gare_depart_id?: string | number | null;

  gare_arrivee_id?: string | number | null;

  gare_id?: string | number | null; // champ legacy, rôle à confirmer

  ville_depart?: string | null;

  horaires?: ScheduleRow[] | null;

}

type TravelHour = {

  key: string;

  routeId: string;

  scheduleId: string;

  depart: string;

  arrivee: string | null;

  destination: string;

  arrivalStationId: string | null;

};

type FieldName = 'depart' | 'destination';

const getParam = (value: string | string[] | undefined): string =>

  (Array.isArray(value) ? value[0] : value)?.trim() || '';

const validHex = (value: unknown): string =>

  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

    ? value.toUpperCase()

    : DEFAULT_COLOR;

const normalize = (value: string): string =>

  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const cityList = (rows: GareRow[]): string[] => {

  const unique = new Map<string, string>();

  rows.forEach((gare) => {

    const name = gare.ville?.trim();

    if (name && !unique.has(normalize(name))) unique.set(normalize(name), name);

  });

  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'fr'));

};

// Conserver les choix du passager lorsqu'il change de compagnie depuis les résultats.

// Le format JJ/MM/AAAA provient de /search-results ; YYYY-MM-DD est aussi accepté.

const parseSharedDate = (raw: string): Date | null => {

  const value = raw.trim();

  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!fr && !iso) return null;

  const day = Number(fr?.[1] ?? iso?.[3]);

  const month = Number(fr?.[2] ?? iso?.[2]);

  const year = Number(fr?.[3] ?? iso?.[1]);

  const chosen = new Date(year, month - 1, day, 12, 0, 0);

  if (chosen.getFullYear() !== year || chosen.getMonth() !== month - 1 || chosen.getDate() !== day) return null;

  return chosen;

};

// Minuit local évite de bloquer aujourd'hui dans les calendriers natifs.

const todayStart = (): Date => {

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;

};

/**
 * Le calendrier doit toujours démarrer sur une date aujourd'hui ou future.
 * Les anciennes dates d'un lien partagé ne doivent pas repositionner
 * le sélecteur iOS en 2023/2024/2025.
 */
const clampDepartureDate = (input: Date | null | undefined): Date => {
  const minimum = todayStart();
  if (!input || !Number.isFinite(input.getTime()) || input.getTime() < minimum.getTime()) {
    return new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate(), 12);
  }
  return new Date(input);
};

/**
 * Calendrier iOS entièrement contrôlé par MESSAY.
 * Il ne dépend pas de l'ancienne roulette iOS dont les années
 * et le contraste peuvent être incorrects selon le thème système.
 * Aucun plafond d'année n'est imposé.
 */
const monthIndex = (value: Date): number => value.getFullYear() * 12 + value.getMonth();

const firstOfMonth = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), 1, 12);

const monthDays = (visibleMonth: Date): Array<Date | null> => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const weekdayOffset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const cells: Array<Date | null> = Array(weekdayOffset).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day, 12));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const dateLabel = (value: Date): string =>

  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);

// Les résultats de recherche existants attendent le format JJ/MM/AAAA.

const legacyDate = (value: Date): string =>

  [String(value.getDate()).padStart(2, '0'), String(value.getMonth() + 1).padStart(2, '0'), value.getFullYear()].join('/');

const isoLocalDate = (value: Date): string =>

  [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');

const priceLabel = (value: DestinationRow['prix']): string | null => {

  if (value === null || value === undefined || value === '') return null;

  const amount = Number(value);

  return Number.isFinite(amount) && amount > 0

    ? `${Math.round(amount).toLocaleString('fr-FR')} F CFA`

    : null;

};

// Calcule uniquement à partir des horaires et durées publiés, sans données fictives.

function validHour(value: string | null | undefined): string | null {

  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));

  if (!match) return null;

  const hh = Number(match[1]);

  const mm = Number(match[2]);

  return hh < 24 && mm < 60

    ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : null;

}

function durationMinutes(value: string | null | undefined): number | null {

  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  const match = /^(\d{1,2})(?:h|:)(\d{1,2})?$/.exec(normalized);

  if (!match || Number(match[2] || 0) >= 60) return null;

  return Number(match[1]) * 60 + Number(match[2] || 0);

}

function publishedArrival(horaire: ScheduleRow, duration: string | null | undefined): string | null {

  // La table horaires ne contient PAS de colonne heure_arrivee.

  const departure = validHour(horaire.heure_depart);

  const minutes = durationMinutes(duration);

  if (!departure || minutes === null) return null;

  const [hh, mm] = departure.split(':').map(Number);

  const total = hh * 60 + mm + minutes;

  const time = total % 1440;

  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}${total >= 1440 ? ' (+1 j)' : ''}`;

}

function AnimatedAction({

  onPress,

  disabled,

  color,

  label,

  reducedMotion,

}: {

  onPress: () => void;

  disabled: boolean;

  color: string;

  label: string;

  reducedMotion: boolean;

}) {

  const scale = useRef(new Animated.Value(1)).current;

  const press = (next: number) => {

    if (reducedMotion || disabled) return;

    Animated.spring(scale, {

      toValue: next,

      useNativeDriver: true,

      speed: 28,

      bounciness: 4,

    }).start();

  };

  return (

    <Animated.View style={{ transform: [{ scale }] }}>

      <Pressable

        testID="search-interurban-trips"

        disabled={disabled}

        accessibilityRole="button"

        accessibilityLabel={label}

        accessibilityState={{ disabled }}

        onPress={onPress}

        onPressIn={() => press(0.975)}

        onPressOut={() => press(1)}

        style={[styles.submitOuter, disabled && styles.submitDisabled]}

      >

        <LinearGradient

          colors={disabled ? ['#CBD5E1', '#94A3B8'] : [color, '#EA580C']}

          start={{ x: 0, y: 0 }}

          end={{ x: 1, y: 1 }}

          style={styles.submitGradient}

        >

          <Ionicons name="search" color="#FFFFFF" size={19} />

          <Text style={styles.submitText} numberOfLines={1}>{label}</Text>

          <Ionicons name="arrow-forward" color="#FFFFFF" size={19} />

        </LinearGradient>

      </Pressable>

    </Animated.View>

  );

}

export default function BuyTicketScreen() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams();

  const companyId = getParam(params.id as string | string[] | undefined);

  const routeCompanyName = getParam(params.company as string | string[] | undefined);

  const routeColor = validHex(getParam(params.color as string | string[] | undefined));

  const forThirdParty = getParam(params.tier as string | string[] | undefined) === 'true';

  const passedDepart = getParam(params.depart as string | string[] | undefined);

  const passedDestination = getParam(params.destination as string | string[] | undefined);

  const passedDate = getParam(params.date as string | string[] | undefined);

  const isLegacyRoute = getParam(params.review as string | string[] | undefined) === 'true';

  const [company, setCompany] = useState<CompanyRow | null>(null);

  const [gares, setGares] = useState<GareRow[]>([]);

  const [destinations, setDestinations] = useState<DestinationRow[]>([]);

  const [departureStationId, setDepartureStationId] = useState('');

  const [arrivalStationId, setArrivalStationId] = useState('');

  const [selectedHourKey, setSelectedHourKey] = useState('');

  const [depart, setDepart] = useState(passedDepart);

  const [destination, setDestination] = useState(passedDestination);

  const [activeField, setActiveField] = useState<FieldName | null>(null);

  const [date, setDate] = useState(() => clampDepartureDate(parseSharedDate(passedDate)));

  const [draftDate, setDraftDate] = useState(() => clampDepartureDate(parseSharedDate(passedDate)));

  const [showPicker, setShowPicker] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() =>
    firstOfMonth(clampDepartureDate(parseSharedDate(passedDate))));

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  const destRef = useRef<TextInputInstance | null>(null);

  const mountedRef = useRef(true);

  const requestRef = useRef(0);

  const headerReveal = useRef(new Animated.Value(0)).current;

  const cardReveal = useRef(new Animated.Value(0)).current;

  const dateReveal = useRef(new Animated.Value(0)).current;

  const footerReveal = useRef(new Animated.Value(0)).current;

  const swapScale = useRef(new Animated.Value(1)).current;

  // Changement de compagnie depuis les résultats : pré-remplir les villes et

  // la date, mais vider les gares et horaires appartenant à l'ancienne compagnie.

  useEffect(() => {

    const sharedDate = clampDepartureDate(parseSharedDate(passedDate));

    setDepart(passedDepart);

    setDestination(passedDestination);

    setDate(sharedDate);

    setDraftDate(sharedDate);

    setCalendarMonth(firstOfMonth(sharedDate));

    setDepartureStationId('');

    setArrivalStationId('');

    setSelectedHourKey('');

    setActiveField(null);

  }, [companyId, passedDepart, passedDestination, passedDate]);

  const companyName = company?.name || routeCompanyName || 'Compagnie de transport';

  const companyColor = validHex(company?.color || company?.couleur || routeColor);

  const loadData = useCallback(async (refresh = false) => {

    const request = ++requestRef.current;

    if (refresh) setRefreshing(true);

    else setLoading(true);

    setError(null);

    try {

      if (!companyId) throw new Error('Aucune compagnie sélectionnée. Revenez à la liste des compagnies.');

      // Les trois ressources sont rattachées à la même compagnie.

      // Aucune ville, gare, durée ou tarification fictive n'est injectée.

      const [companyResponse, garesResponse, destinationsResponse] = await Promise.all([

        supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),

        supabase.from('gares').select('id,nom,ville,adresse').eq('company_id', companyId).order('ville'),

        supabase.from('destinations').select('*').eq('company_id', companyId).order('ville'),

      ]);

      if (companyResponse.error) throw companyResponse.error;

      if (garesResponse.error) throw garesResponse.error;

      if (destinationsResponse.error) throw destinationsResponse.error;

      const found = companyResponse.data as CompanyRow | null;

      if (!found) throw new Error('Compagnie introuvable. Revenez à la liste et réessayez.');

      if (found.is_active === false) throw new Error('Cette compagnie est actuellement indisponible.');

      // Interroger horaires explicitement : une relation PostgREST embarquée

      // ne peut pas être présumée à partir de la seule présence de destination_id.

      const rawDestinations = (destinationsResponse.data ?? []) as DestinationRow[];

      const routeIds = rawDestinations.map(row => String(row.id));

      let schedules: ScheduleRow[] = [];

      if (routeIds.length > 0) {

        const scheduleResponse = await supabase.from('horaires')

          .select('id,destination_id,heure_depart')

          .in('destination_id', routeIds)

          .limit(5000);

        if (scheduleResponse.error) throw scheduleResponse.error;

        schedules = (scheduleResponse.data ?? []) as ScheduleRow[];

      }

      const scheduleMap = new Map<string, ScheduleRow[]>();

      schedules.forEach(horaire => {

        const key = String(horaire.destination_id);

        scheduleMap.set(key, [...(scheduleMap.get(key) ?? []), horaire]);

      });

      if (!mountedRef.current || request !== requestRef.current) return;

      setCompany(found);

      setGares((garesResponse.data ?? []) as GareRow[]);

      setDestinations(rawDestinations.map(row => ({

        ...row, horaires: scheduleMap.get(String(row.id)) ?? [],

      })));

    } catch (caught: unknown) {

      if (__DEV__) console.warn('[MESSAY/BUY-TICKET]', caught);

      if (!mountedRef.current || request !== requestRef.current) return;

      setError(caught instanceof Error ? caught.message : 'Chargement des trajets impossible. Réessayez.');

      // Ne pas exposer d'anciennes destinations en cas d'échec réseau.

      setCompany(null);

      setGares([]);

      setDestinations([]);

    } finally {

      if (mountedRef.current && request === requestRef.current) {

        setLoading(false);

        setRefreshing(false);

      }

    }

  }, [companyId]);

  useEffect(() => {

    mountedRef.current = true;

    void loadData();

    void AccessibilityInfo.isReduceMotionEnabled()

      .then((value) => { if (mountedRef.current) setReducedMotion(value); })

      .catch(() => undefined);

    return () => {

      mountedRef.current = false;

      requestRef.current += 1;

    };

  }, [loadData]);

  useEffect(() => {

    if (loading) return;

    const values = [headerReveal, cardReveal, dateReveal, footerReveal];

    values.forEach((value) => { value.stopAnimation(); value.setValue(reducedMotion ? 1 : 0); });

    if (reducedMotion) return;

    const animation = Animated.stagger(115, values.map((value) =>

      Animated.timing(value, { toValue: 1, duration: 540, useNativeDriver: true })

    ));

    animation.start();

    return () => animation.stop();

  }, [loading, reducedMotion, headerReveal, cardReveal, dateReveal, footerReveal]);

  const cities = useMemo(() => cityList(gares), [gares]);

  const destinationsByCity = useMemo(() => {

    const map = new Map<string, DestinationRow>();

    destinations.forEach((row) => {

      const name = row.ville?.trim();

      if (name && !map.has(normalize(name))) map.set(normalize(name), row);

    });

    return [...map.values()];

  }, [destinations]);

  const departureSuggestions = useMemo(() => cities.filter((city) => normalize(city).includes(normalize(depart))).slice(0, 8), [cities, depart]);

  const destinationSuggestions = useMemo(() => destinationsByCity

    .filter((row) => row.ville && normalize(row.ville) !== normalize(depart))

    .filter((row) => normalize(row.ville || '').includes(normalize(destination)))

    .slice(0, 8), [destinationsByCity, depart, destination]);

  // Les gares visibles appartiennent strictement à la compagnie choisie.

  // La saisie libre reste possible pour interroger les autres compagnies.

  const departureStations = useMemo(() => gares.filter(

    (gare) => normalize(gare.ville || '') === normalize(depart) && Boolean(gare.nom)

  ), [gares, depart]);

  const arrivalStations = useMemo(() => gares.filter(

    (gare) => normalize(gare.ville || '') === normalize(destination) && Boolean(gare.nom)

  ), [gares, destination]);

  const stationById = useMemo(() => new Map(gares.map(gare => [String(gare.id), gare])), [gares]);

  // Seuls les horaires rattachés à une VRAIE gare de départ sont proposés.

  const hours = useMemo((): TravelHour[] => {

    if (!departureStationId) return [];

    const output: TravelHour[] = [];

    for (const route of destinations) {

      if (!route.gare_depart_id ||

          String(route.gare_depart_id) !== departureStationId) continue;

      const arrivalStation = route.gare_arrivee_id ? stationById.get(String(route.gare_arrivee_id)) : null;

      const arrivalCity = arrivalStation?.ville || route.ville || '';

      if (destination.trim() && normalize(arrivalCity) !== normalize(destination) &&

          normalize(route.ville || '') !== normalize(destination)) continue;

      if (arrivalStationId && String(route.gare_arrivee_id ?? '') !== arrivalStationId) continue;

      for (const schedule of (Array.isArray(route.horaires) ? route.horaires : [])) {

        const departureHour = validHour(schedule.heure_depart);

        if (!departureHour) continue;

        // Pas de date de circulation dans le schéma fourni : horaire publié,

        // mais la disponibilité à la date sélectionnée doit être confirmée par l'API.

        output.push({

          key: `${route.id}:${schedule.id}`,

          routeId: String(route.id),

          scheduleId: String(schedule.id),

          depart: departureHour,

          arrivee: publishedArrival(schedule, route.duree),

          destination: arrivalCity,

          arrivalStationId: route.gare_arrivee_id ? String(route.gare_arrivee_id) : null,

        });

      }

    }

    return output.sort((a, b) => a.depart.localeCompare(b.depart));

  }, [departureStationId, arrivalStationId, destinations, stationById, destination]);

  const selectedHour = hours.find(hour => hour.key === selectedHourKey) || null;

  const departureStation = departureStations.find(g => String(g.id) === departureStationId) || null;

  const arrivalStation = arrivalStations.find(g => String(g.id) === arrivalStationId) || null;

  const selectedDestination = destinationsByCity.find((row) => normalize(row.ville || '') === normalize(destination));

  const selectedPrice = priceLabel(selectedDestination?.prix);

  const dateIsValid = isoLocalDate(date) >= isoLocalDate(new Date());

  // Les champs restent saisissables même lorsque le dashboard entreprise n'a

  // encore publié ni gares ni destinations. La recherche ne vaut pas réservation.

  const departureText = depart.trim();

  const destinationText = destination.trim();

  // Si la compagnie dispose de gares dans la ville choisie, le passager DOIT

  // choisir lui-même sa gare. Jamais de présélection de la première gare.

  // Si elle n'en a aucune, on conserve la recherche libre pour découvrir les

  // éventuelles alternatives, sans prétendre qu'un trajet existe.

  const departureStationChoiceRequired = departureStations.length > 0;

  const departureStationChoiceValid = !departureStationChoiceRequired || departureStation !== null;

  const canSearch = Boolean(company && !error && departureText && destinationText &&

    normalize(departureText) !== normalize(destinationText) && dateIsValid && departureStationChoiceValid);

  const selectDeparture = (city: string) => {

    setDepart(city);

    setDepartureStationId('');

    setSelectedHourKey('');

    if (normalize(city) === normalize(destination)) { setDestination(''); setArrivalStationId(''); }

    setActiveField('destination');

    destRef.current?.focus();

  };

  const swapCities = () => {

    if (!departureText || !destinationText) {

      Alert.alert('Deux villes nécessaires', 'Saisissez le départ et la destination avant de les inverser.');

      return;

    }

    // L'inversion ne crée pas un trajet ; les résultats contrôlent la disponibilité.

    setDepart(destinationText);

    setDestination(departureText);

    setDepartureStationId('');

    setArrivalStationId('');

    setSelectedHourKey('');

    setActiveField(null);

    Keyboard.dismiss();

    if (!reducedMotion) {

      Animated.sequence([

        Animated.spring(swapScale, { toValue: 0.85, useNativeDriver: true }),

        Animated.spring(swapScale, { toValue: 1, useNativeDriver: true }),

      ]).start();

    }

  };

  const visibleCalendarDays = useMemo(() => monthDays(calendarMonth), [calendarMonth]);
  const earliestMonth = monthIndex(todayStart());
  const canGoBackOneMonth = monthIndex(calendarMonth) > earliestMonth;
  const canGoBackOneYear = monthIndex(calendarMonth) - 12 >= earliestMonth;

  const changeCalendarMonth = (delta: number) => {
    setCalendarMonth((current) => {
      const target = new Date(current.getFullYear(), current.getMonth() + delta, 1, 12);
      return monthIndex(target) >= monthIndex(todayStart()) ? target : current;
    });
  };

  const confirmDate = () => {
    const nextDate = clampDepartureDate(draftDate);
    setDate(nextDate);
    setSelectedHourKey('');
    setShowPicker(false);
  };

  const openDatePicker = () => {
    setActiveField(null);
    Keyboard.dismiss();
    const safeDate = clampDepartureDate(date);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: safeDate,
        minimumDate: todayStart(),
        mode: 'date',
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            setDate(clampDepartureDate(selectedDate));
            setSelectedHourKey('');
          }
        },
      });
      return;
    }
    setDraftDate(safeDate);
    setCalendarMonth(firstOfMonth(safeDate));
    setShowPicker(true);
  };

  const goToResults = () => {

    if (departureStationChoiceRequired && !departureStation) {

      Alert.alert('Choisissez votre gare de départ',

        'Plusieurs gares peuvent être disponibles dans cette ville. Sélectionnez celle qui vous convient en fonction de son adresse.');

      return;

    }

    if (!canSearch) {

      Alert.alert('Vérifiez votre recherche', 'Saisissez deux villes différentes et choisissez une date valide.');

      return;

    }

    Keyboard.dismiss();

    setActiveField(null);

    // Ceci ne réserve ni ne paie un billet. Le serveur de réservation doit

    // confirmer le trajet, le prix, les places et le statut de vérification.

    router.push({

      pathname: '/search-results',

      params: {

        depart: departureText,

        destination: destinationText,

        date: legacyDate(date),

        company: companyName,

        color: companyColor,

        id: companyId,

        ...(departureStation ? { gare_depart_id: String(departureStation.id), gare_depart: departureStation.nom || '' } : {}),

        ...(arrivalStation ? { gare_arrivee_id: String(arrivalStation.id), gare_arrivee: arrivalStation.nom || '' } : {}),

        ...(selectedHour ? {

          heure_depart: selectedHour.depart, horaireId: selectedHour.scheduleId,

          destinationId: selectedHour.routeId,

          ...(selectedHour.arrivee ? { heure_arrivee: selectedHour.arrivee } : {}),

        } : {}),

        ...(forThirdParty ? { tier: 'true' } : {}),

      },

    } as Href);

  };

  const revealStyle = (value: Animated.Value, offset = 16) => ({

    opacity: value,

    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],

  });

  if (loading) {

    return (

      <SafeAreaView style={styles.center}>

        <ActivityIndicator size="large" color={companyColor} />

        <Text style={styles.loadingText}>Préparation de votre voyage…</Text>

      </SafeAreaView>

    );

  }

  return (

    <View style={styles.container}>

      <StatusBar barStyle="light-content" />

      <ScrollView

        showsVerticalScrollIndicator={false}

        keyboardShouldPersistTaps="handled"

        keyboardDismissMode="on-drag"

        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 38 }}

        onScrollBeginDrag={() => setActiveField(null)}

      >

        <Animated.View style={revealStyle(headerReveal, -16)}>

          <ImageBackground source={HERO_IMAGE} style={styles.hero} resizeMode="cover">

            <LinearGradient colors={['rgba(10,22,42,0.78)', `${companyColor}DB`, 'rgba(10,22,42,0.95)']} style={styles.heroTint}>

              <SafeAreaView edges={['top']}>

                <View style={styles.navigation}>

                  <Pressable style={styles.glassButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityLabel="Retour">

                    <Ionicons name="chevron-back" size={23} color="#FFFFFF" />

                  </Pressable>

                  <View style={styles.navigationCenter}>

                    <Text style={styles.navEyebrow}>MESSAY · TRANSPORT INTERURBAIN</Text>

                    <Text style={styles.navTitle} numberOfLines={1}>{companyName}</Text>

                  </View>

                  <Pressable style={styles.glassButton} onPress={() => void loadData(true)} accessibilityLabel="Actualiser les destinations">

                    {refreshing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="refresh" size={20} color="#FFFFFF" />}

                  </Pressable>

                </View>

                <View style={styles.heroCopy}>

                  <View style={styles.heroPill}>

                    <Ionicons name="bus-outline" size={13} color="#FFFFFF" />

                    <Text style={styles.heroPillText}>{forThirdParty ? 'RÉSERVER POUR UN PROCHE' : 'RÉSERVER UN VOYAGE'}</Text>

                  </View>

                  <Text style={styles.heroTitle}>Votre destination,{`\n`}votre aventure.</Text>

                  <Text style={styles.heroSubtitle}>Découvrez les départs proposés par {companyName}, au meilleur moment pour vous.</Text>

                </View>

              </SafeAreaView>

            </LinearGradient>

          </ImageBackground>

        </Animated.View>

        <View style={styles.content}>

          {!!error && (

            <View style={styles.errorPanel}>

              <Ionicons name="alert-circle-outline" color="#B42318" size={22} />

              <View style={{ flex: 1 }}>

                <Text style={styles.errorHeading}>Chargement indisponible</Text>

                <Text style={styles.errorDescription}>{error}</Text>

              </View>

              <Pressable onPress={() => void loadData(true)} accessibilityLabel="Réessayer le chargement">

                <Ionicons name="refresh" color="#B42318" size={20} />

              </Pressable>

            </View>

          )}

          {company?.is_verified !== true && !error && (

            <View style={styles.notice}>

              <Ionicons name="information-circle-outline" color="#92400E" size={18} />

              <Text style={styles.noticeText}>

                Compagnie non vérifiée ou statut de validation non configuré. Consultation et recherche possibles ; paiement réel désactivé.

              </Text>

            </View>

          )}

          {isLegacyRoute && !error && (

            <View style={styles.notice}>

              <Ionicons name="information-circle-outline" color="#92400E" size={18} />

              <Text style={styles.noticeText}>

                Cette compagnie possède une destination enregistrée, mais sa gare de départ n'est pas encore liée au trajet. Choisissez librement votre gare pour continuer la recherche. Aucun billet ne sera vendu sans liaison confirmée.

              </Text>

            </View>

          )}

          <Animated.View style={[styles.formCard, revealStyle(cardReveal)]}>

            <View style={styles.formHead}>

              <View style={[styles.formHeadIcon, { backgroundColor: `${companyColor}16` }]}>

                <Ionicons name="navigate-outline" size={22} color={companyColor} />

              </View>

              <View style={{ flex: 1 }}>

                <Text style={styles.formOverline}>ORGANISEZ VOTRE TRAJET</Text>

                <Text style={styles.formTitle}>Où souhaitez-vous aller ?</Text>

              </View>

            </View>

            <View style={styles.routePanel}>

              <View style={styles.routeRail} pointerEvents="none">

                <View style={[styles.routeRailStart, { borderColor: companyColor }]} />

                <View style={styles.routeRailLine} />

                <Ionicons name="location" color="#EA580C" size={18} />

              </View>

              <View style={styles.inputsColumn}>

                <Text style={styles.fieldLabel}>DÉPART</Text>

                <View style={[styles.inputWrapper, activeField === 'depart' && { borderColor: companyColor }]}>

                  <TextInput

                    value={depart}

                    onChangeText={(text) => { setDepart(text); setDepartureStationId(''); setSelectedHourKey(''); setActiveField('depart'); }}

                    onFocus={() => setActiveField('depart')}

                    placeholder={cities.length ? 'Départ : choisir ou saisir une ville' : 'Saisir une ville de départ'}

                    placeholderTextColor="#94A3B8"

                    style={styles.fieldInput}

                    accessibilityLabel="Ville de départ"

                    autoCorrect={false}

                  />

                  {!!depart && <Pressable accessibilityLabel="Effacer le départ" onPress={() => { setDepart(''); setDepartureStationId(''); setSelectedHourKey(''); setActiveField('depart'); }}>

                    <Ionicons name="close-circle" size={18} color="#94A3B8" />

                  </Pressable>}

                </View>

                {activeField === 'depart' && (

                  <View style={styles.suggestions}>

                    {departureSuggestions.length ? departureSuggestions.map((city) => (

                      <Pressable key={normalize(city)} style={styles.suggestionRow} onPress={() => selectDeparture(city)}>

                        <Ionicons name="location-outline" size={16} color={companyColor} />

                        <Text style={styles.suggestionText} numberOfLines={1}>{city}</Text>

                        <Ionicons name="chevron-forward" color="#CBD5E1" size={16} />

                      </Pressable>

                    )) : <Text style={styles.noSuggestion}>Aucune suggestion. Vous pouvez saisir la ville manuellement.</Text>}

                  </View>

                )}

                {depart.trim().length > 0 && (

                  <View style={styles.stationSection}>

                    <Text style={styles.subFieldTitle}>1 · Choisissez votre gare de départ ({departureStations.length})</Text>

                    {departureStations.length > 0 && (

                      <Text style={styles.stationChoiceGuide}>

                        {departureStations.length === 1

                          ? 'Cette gare est disponible. Touchez-la pour confirmer votre point de départ.'

                          : `${departureStations.length} gares sont disponibles dans cette ville. Consultez leurs adresses et choisissez celle qui est la plus pratique pour vous.`}

                      </Text>

                    )}

                    {departureStations.length ? (

                      <View style={styles.stationList}>

                        {departureStations.map(gare => {

                          const active = String(gare.id) === departureStationId;

                          return (

                            <Pressable key={String(gare.id)} accessibilityRole="radio"

                              accessibilityLabel={`${gare.nom || 'Gare sans nom'}${gare.adresse ? `, ${gare.adresse}` : ''}`}

                              accessibilityState={{ checked: active }}

                              onPress={() => { setDepartureStationId(String(gare.id)); setSelectedHourKey(''); setActiveField(null); Keyboard.dismiss(); }}

                              style={[styles.stationChoice, active && { borderColor: companyColor, backgroundColor: `${companyColor}09` }]}>

                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={19} color={active ? companyColor : '#A8B2C3'} />

                              <View style={{ flex: 1 }}>

                                <Text style={styles.stationChoiceName}>{gare.nom || 'Gare sans nom'}</Text>

                                {!!gare.adresse && <Text style={styles.stationChoiceAddress}>{gare.adresse}</Text>}

                              </View>

                              {active && <Ionicons name="checkmark-circle" size={19} color={companyColor} />}

                            </Pressable>

                          );

                        })}

                      </View>

                    ) : <Text style={styles.stationEmpty}>Aucune gare enregistrée pour cette ville. Vous pouvez rechercher les compagnies alternatives, sans réservation directe.</Text>}

                    {departureStation && (

                      <View style={styles.selectedStationNotice}>

                        <Ionicons name="checkmark-circle" color="#047857" size={17} />

                        <Text style={styles.selectedStationText}>

                          Gare sélectionnée : {departureStation.nom}

                        </Text>

                      </View>

                    )}

                    <Text style={[styles.subFieldTitle, { marginTop: 15 }]}>2 · Heure de départ</Text>

                    {!departureStationId ? (

                      <Text style={styles.stationEmpty}>Sélectionnez d’abord une gare de départ.</Text>

                    ) : hours.length ? (

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.hoursRow}>

                        {hours.slice(0, 24).map(item => {

                          const active = item.key === selectedHourKey;

                          return <Pressable key={item.key} accessibilityRole="button"

                            accessibilityLabel={`Départ à ${item.depart}, destination ${item.destination}`}

                            onPress={() => {

                              setSelectedHourKey(item.key);

                              // Si le trajet est déjà renseigné par cet horaire, renseigner

                              // aussi la ville et la gare d'arrivée sans inventer de données.

                              if (!destination.trim() && item.destination) {

                                setDestination(item.destination);

                                if (item.arrivalStationId) setArrivalStationId(item.arrivalStationId);

                              }

                            }}

                            style={[styles.hourChip, active && { borderColor: companyColor, backgroundColor: `${companyColor}13` }]}>

                            <Ionicons name="time-outline" size={16} color={active ? companyColor : '#667085'} />

                            <Text style={[styles.hourChipTime, active && { color: companyColor }]}>{item.depart}</Text>

                            {!destination.trim() && <Text style={styles.hourChipCity} numberOfLines={1}>{item.destination}</Text>}

                          </Pressable>;

                        })}

                      </ScrollView>

                    ) : (

                      <Text style={styles.stationEmpty}>Aucun horaire publié pour cette gare et ce trajet. La recherche reste possible.</Text>

                    )}

                  </View>

                )}

                <View style={styles.swapLine}>

                  <View style={styles.separator} />

                  <Animated.View style={{ transform: [{ scale: swapScale }] }}>

                    <Pressable onPress={swapCities} style={[styles.swapButton, { borderColor: `${companyColor}55` }]} accessibilityLabel="Inverser départ et destination">

                      <Ionicons name="swap-vertical" size={20} color={companyColor} />

                    </Pressable>

                  </Animated.View>

                  <View style={styles.separator} />

                </View>

                <Text style={styles.fieldLabel}>DESTINATION</Text>

                <View style={[styles.inputWrapper, activeField === 'destination' && { borderColor: companyColor }]}>

                  <TextInput

                    ref={destRef}

                    value={destination}

                    onChangeText={(text) => { setDestination(text); setArrivalStationId(''); setSelectedHourKey(''); setActiveField('destination'); }}

                    onFocus={() => setActiveField('destination')}

                    placeholder={destinationsByCity.length ? 'Destination : choisir ou saisir' : 'Saisir une destination'}

                    placeholderTextColor="#94A3B8"

                    style={styles.fieldInput}

                    accessibilityLabel="Ville de destination"

                    autoCorrect={false}

                  />

                  {!!destination && <Pressable accessibilityLabel="Effacer la destination" onPress={() => { setDestination(''); setArrivalStationId(''); setSelectedHourKey(''); setActiveField('destination'); }}>

                    <Ionicons name="close-circle" size={18} color="#94A3B8" />

                  </Pressable>}

                </View>

                {activeField === 'destination' && (

                  <View style={styles.suggestions}>

                    {destinationSuggestions.length ? destinationSuggestions.map((option) => (

                      <Pressable key={String(option.id)} onPress={() => { setDestination(option.ville || ''); setArrivalStationId(''); setSelectedHourKey(''); setActiveField(null); Keyboard.dismiss(); }} style={styles.suggestionRow}>

                        <Ionicons name="bus-outline" size={16} color={companyColor} />

                        <View style={{ flex: 1 }}>

                          <Text style={styles.suggestionText} numberOfLines={1}>{option.ville}</Text>

                          {!!option.duree && <Text style={styles.suggestionSub}>Durée indicative : {option.duree}</Text>}

                        </View>

                        {priceLabel(option.prix) && <Text style={styles.suggestionPrice}>{priceLabel(option.prix)}</Text>}

                      </Pressable>

                    )) : <Text style={styles.noSuggestion}>Aucune suggestion publiée. Saisissez la ville pour rechercher les trajets.</Text>}

                  </View>

                )}

                {destination.trim().length > 0 && (

                  <View style={styles.stationSection}>

                    <Text style={styles.subFieldTitle}>3 · Choisissez votre gare d’arrivée</Text>

                    {arrivalStations.length ? (

                      <View style={styles.stationList}>

                        {arrivalStations.map(gare => {

                          const active = String(gare.id) === arrivalStationId;

                          return (

                            <Pressable key={String(gare.id)} accessibilityRole="button"

                              onPress={() => { setArrivalStationId(String(gare.id)); if (selectedHour?.arrivalStationId !== String(gare.id)) setSelectedHourKey(''); setActiveField(null); Keyboard.dismiss(); }}

                              style={[styles.stationChoice, active && { borderColor: companyColor, backgroundColor: `${companyColor}09` }]}>

                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={19} color={active ? companyColor : '#A8B2C3'} />

                              <View style={{ flex: 1 }}>

                                <Text style={styles.stationChoiceName}>{gare.nom || 'Gare sans nom'}</Text>

                                {!!gare.adresse && <Text style={styles.stationChoiceAddress}>{gare.adresse}</Text>}

                              </View>

                              {active && <Ionicons name="checkmark-circle" size={19} color={companyColor} />}

                            </Pressable>

                          );

                        })}

                      </View>

                    ) : <Text style={styles.stationEmpty}>Aucune gare d'arrivée publiée pour cette ville.</Text>}

                    <View style={styles.arrivalBox}>

                      <Ionicons name="flag-outline" size={20} color={companyColor} />

                      <View style={{ flex: 1 }}>

                        <Text style={styles.arrivalLabel}>4 · Heure d’arrivée</Text>

                        <Text style={styles.arrivalValue}>{selectedHour?.arrivee || 'À confirmer'}</Text>

                        <Text style={styles.arrivalHint}>

                          {selectedHour?.arrivee

                            ? 'Horaire publié ou calculé à partir de la durée publiée.'

                            : 'Sélectionnez un horaire de départ. Si aucune durée n’est publiée, l’arrivée reste à confirmer.'}

                        </Text>

                      </View>

                    </View>

                  </View>

                )}

              </View>

            </View>

            {(!error && (cities.length === 0 || destinationsByCity.length === 0)) && (

              <View style={styles.emptyNotice}>

                <Ionicons name="information-circle-outline" color="#92400E" size={19} />

                <Text style={styles.emptyNoticeText}>

                  {cities.length === 0

                    ? 'Aucune gare publiée pour cette compagnie. Son espace entreprise doit enregistrer des gares de départ.'

                    : 'Aucune destination publiée pour cette compagnie. La saisie reste possible, mais seul le dashboard entreprise peut publier des départs réellement réservables.'}

                </Text>

              </View>

            )}

          </Animated.View>

          <Animated.View style={[styles.dateCard, revealStyle(dateReveal)]}>

            <Pressable

              accessibilityRole="button"

              accessibilityLabel={`Choisir la date de départ. ${dateLabel(date)}`}

              onPress={openDatePicker}

              style={styles.dateRow}

            >

              <View style={[styles.calendarIcon, { backgroundColor: `${companyColor}14` }]}>

                <Ionicons name="calendar-clear-outline" size={23} color={companyColor} />

              </View>

              <View style={{ flex: 1 }}>

                <Text style={styles.formOverline}>DATE DE DÉPART</Text>

                <Text style={styles.dateValue}>{dateLabel(date)}</Text>

              </View>

              <View style={styles.dateEdit}>

                <Ionicons name="chevron-down" size={19} color={companyColor} />

              </View>

            </Pressable>

          </Animated.View>

          <Animated.View style={revealStyle(footerReveal)}>

            {!!selectedPrice && canSearch && (

              <View style={styles.fareLine}>

                <Ionicons name="pricetag-outline" color="#64748B" size={17} />

                <Text style={styles.fareLabel}>Tarif indicatif publié</Text>

                <Text style={[styles.fareValue, { color: companyColor }]}>{selectedPrice}</Text>

              </View>

            )}

            {departureStationChoiceRequired && !departureStation && (

              <View style={styles.stationRequiredHint}>

                <Ionicons name="information-circle-outline" size={17} color="#92400E" />

                <Text style={styles.stationRequiredText}>

                  Sélectionnez une gare de départ ci-dessus pour continuer.

                </Text>

              </View>

            )}

            <AnimatedAction

              onPress={goToResults}

              disabled={!canSearch}

              color={companyColor}

              reducedMotion={reducedMotion}

              label="Rechercher des départs"

            />

            <View style={styles.secureLine}>

              <Ionicons name="shield-checkmark-outline" color="#059669" size={16} />

              <Text style={styles.secureText}>Les horaires, prix définitifs et places sont confirmés à l'étape suivante.</Text>

            </View>

          </Animated.View>

        </View>

      </ScrollView>

      <Modal

        visible={showPicker}

        transparent

        animationType="slide"

        onRequestClose={() => setShowPicker(false)}

      >

        <View style={styles.modalOverlay}>

          <Pressable style={styles.modalBackdrop} accessibilityLabel="Fermer le calendrier" onPress={() => setShowPicker(false)} />

          <View style={styles.modalSheet}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>Choisir votre date de départ</Text>

              <Pressable onPress={() => setShowPicker(false)} accessibilityLabel="Annuler">

                <Ionicons name="close-circle" size={25} color="#64748B" />

              </Pressable>

            </View>

          <View style={styles.calendarNavigation}>
            <Pressable
              onPress={() => changeCalendarMonth(-12)}
              disabled={!canGoBackOneYear}
              style={[styles.calendarNavigationButton, !canGoBackOneYear && styles.calendarNavDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Année précédente"
            >
              <Text style={styles.calendarArrow}>«</Text>
            </Pressable>
            <Pressable
              onPress={() => changeCalendarMonth(-1)}
              disabled={!canGoBackOneMonth}
              style={[styles.calendarNavigationButton, !canGoBackOneMonth && styles.calendarNavDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Mois précédent"
            >
              <Ionicons name="chevron-back" size={20} color="#334155" />
            </Pressable>
            <Text style={styles.calendarMonthTitle}>
              {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(calendarMonth)}
            </Text>
            <Pressable
              onPress={() => changeCalendarMonth(1)}
              style={styles.calendarNavigationButton}
              accessibilityRole="button"
              accessibilityLabel="Mois suivant"
            >
              <Ionicons name="chevron-forward" size={20} color="#334155" />
            </Pressable>
            <Pressable
              onPress={() => changeCalendarMonth(12)}
              style={styles.calendarNavigationButton}
              accessibilityRole="button"
              accessibilityLabel="Année suivante"
            >
              <Text style={styles.calendarArrow}>»</Text>
            </Pressable>
          </View>

          <View style={styles.calendarWeekRow}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <Text key={`weekday-${index}`} style={styles.calendarWeekday}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {visibleCalendarDays.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.calendarDayCell} />;
              const dayKey = isoLocalDate(day);
              const disabled = dayKey < isoLocalDate(todayStart());
              const selected = dayKey === isoLocalDate(draftDate);
              const isToday = dayKey === isoLocalDate(todayStart());
              return (
                <View key={dayKey} style={styles.calendarDayCell}>
                  <Pressable
                    disabled={disabled}
                    onPress={() => setDraftDate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12))}
                    accessibilityRole="button"
                    accessibilityLabel={dateLabel(day)}
                    accessibilityState={{ disabled, selected }}
                    style={[
                      styles.calendarDayButton,
                      isToday && !selected && styles.calendarDayToday,
                      selected && { backgroundColor: companyColor },
                      disabled && styles.calendarDayDisabled,
                    ]}
                  >
                    <Text style={[
                      styles.calendarDayNumber,
                      selected && styles.calendarDayNumberSelected,
                      disabled && styles.calendarDayNumberDisabled,
                    ]}>{day.getDate()}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.calendarFooter}>
            <Text style={styles.calendarSelectionLabel}>Date sélectionnée</Text>
            <Text style={styles.calendarSelectionValue}>{dateLabel(draftDate)}</Text>
            <Pressable
              onPress={() => {
                const today = clampDepartureDate(new Date());
                setDraftDate(today);
                setCalendarMonth(firstOfMonth(today));
              }}
              accessibilityRole="button"
              accessibilityLabel="Choisir aujourd'hui"
            >
              <Text style={[styles.calendarTodayLink, { color: companyColor }]}>Aujourd’hui</Text>
            </Pressable>
          </View>

            <Pressable

              style={[styles.pickerDone, { backgroundColor: companyColor }]}

              onPress={confirmDate}

              accessibilityRole="button"

            >

              <Text style={styles.pickerDoneText}>Confirmer la date</Text>

            </Pressable>

          </View>

        </View>

      </Modal>

    </View>

  );

}

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F6F8FC' },

  center: { flex: 1, backgroundColor: '#F6F8FC', alignItems: 'center', justifyContent: 'center' },

  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },

  hero: { minHeight: 287, backgroundColor: '#0F172A' },

  heroTint: { minHeight: 287, paddingBottom: 48 },

  navigation: { paddingHorizontal: 18, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },

  glassButton: { height: 43, width: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.17)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.19)' },

  navigationCenter: { flex: 1, alignItems: 'center' },

  navEyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.78)', textAlign: 'center' },

  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', marginTop: 3, textAlign: 'center' },

  heroCopy: { paddingHorizontal: 25, paddingTop: 36 },

  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.19)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 50 },

  heroPillText: { fontSize: 9, letterSpacing: 1, fontWeight: '900', color: '#FFFFFF' },

  heroTitle: { fontSize: 29, fontWeight: '900', color: '#FFFFFF', lineHeight: 35, marginTop: 15 },

  heroSubtitle: { fontSize: 12, lineHeight: 19, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 10, maxWidth: 315 },

  content: { paddingHorizontal: 16, marginTop: -28 },

  errorPanel: { padding: 14, flexDirection: 'row', gap: 10, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FEE4E2', borderRadius: 18, marginBottom: 12 },

  errorHeading: { fontWeight: '900', color: '#B42318', fontSize: 13 },

  errorDescription: { color: '#B42318', fontSize: 12, lineHeight: 18, marginTop: 3 },

  notice: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 9, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, marginBottom: 12 },

  noticeText: { flex: 1, color: '#92400E', lineHeight: 17, fontSize: 11, fontWeight: '600' },

  formCard: { borderRadius: 26, padding: 19, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.085, shadowRadius: 22, elevation: 5, borderWidth: 1, borderColor: '#F0F3F8' },

  formHead: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 23 },

  formHeadIcon: { height: 47, width: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  formOverline: { color: '#D97706', fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },

  formTitle: { fontSize: 19, fontWeight: '900', color: '#101828', marginTop: 4 },

  routePanel: { flexDirection: 'row', gap: 13 },

  routeRail: { width: 18, alignItems: 'center', paddingTop: 40, paddingBottom: 26 },

  routeRailStart: { width: 13, height: 13, borderWidth: 3, borderRadius: 7, backgroundColor: '#FFFFFF' },

  routeRailLine: { flex: 1, width: 2, minHeight: 110, backgroundColor: '#E2E8F0', marginVertical: 8 },

  inputsColumn: { flex: 1 },

  fieldLabel: { fontSize: 10, color: '#64748B', letterSpacing: 1.1, fontWeight: '900', marginBottom: 8 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 15, backgroundColor: '#F8FAFC', height: 51, paddingHorizontal: 12, gap: 7 },

  fieldInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#182230', paddingVertical: 6 },

  suggestions: { marginTop: 5, marginBottom: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAF2', borderRadius: 14, overflow: 'hidden', elevation: 3 },

  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 13, gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEF2F6' },

  suggestionText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#344054' },

  suggestionSub: { marginTop: 3, fontSize: 10, color: '#98A2B3' },

  suggestionPrice: { fontSize: 10, color: '#B45309', fontWeight: '800' },

  noSuggestion: { color: '#7C879A', padding: 13, fontSize: 12 },

  swapLine: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },

  separator: { flex: 1, height: 1, backgroundColor: '#EFF2F7' },

  swapButton: { width: 35, height: 35, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  emptyNotice: { borderRadius: 13, marginTop: 13, padding: 12, backgroundColor: '#FFF7ED', flexDirection: 'row', alignItems: 'center', gap: 8 },

  emptyNoticeText: { flex: 1, color: '#9A3412', fontSize: 11, lineHeight: 17 },

  dateCard: { backgroundColor: '#FFFFFF', borderRadius: 21, paddingHorizontal: 17, paddingVertical: 17, marginTop: 13, borderWidth: 1, borderColor: '#EDF0F6' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  calendarIcon: { height: 48, width: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  dateValue: { marginTop: 6, textTransform: 'capitalize', color: '#101828', fontSize: 13, fontWeight: '800' },

  dateEdit: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF7ED' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.46)' },

  modalBackdrop: { ...StyleSheet.absoluteFill },

  modalSheet: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderTopLeftRadius: 26, borderTopRightRadius: 26 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  modalTitle: { fontSize: 17, fontWeight: '900', color: '#172033' },

  calendarNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 14 },
  calendarNavigationButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F1F5F9' },
  calendarNavDisabled: { opacity: 0.3 },
  calendarArrow: { fontSize: 23, fontWeight: '700', color: '#334155', marginTop: -2 },
  calendarMonthTitle: { flex: 1, textAlign: 'center', textTransform: 'capitalize', fontSize: 15, fontWeight: '900', color: '#101828' },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 3 },
  calendarWeekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 9, fontSize: 12, fontWeight: '800', color: '#64748B' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  calendarDayButton: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  calendarDayToday: { borderColor: '#FB923C', borderWidth: 1.5 },
  calendarDayDisabled: { opacity: 0.48 },
  calendarDayNumber: { fontSize: 14, fontWeight: '700', color: '#334155' },
  calendarDayNumberSelected: { color: '#FFFFFF', fontWeight: '900' },
  calendarDayNumberDisabled: { color: '#94A3B8' },
  calendarFooter: { marginTop: 14, marginBottom: 20, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  calendarSelectionLabel: { fontSize: 11, color: '#64748B', width: '100%' },
  calendarSelectionValue: { fontSize: 12, fontWeight: '800', flex: 1, color: '#0F172A', textTransform: 'capitalize' },
  calendarTodayLink: { fontWeight: '800', fontSize: 12 },

  pickerDone: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 15 },

  pickerDoneText: { color: '#FFFFFF', fontWeight: '800' },

  fareLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, paddingHorizontal: 3 },

  fareLabel: { flex: 1, color: '#64748B', fontSize: 12, fontWeight: '700' },

  fareValue: { fontSize: 12, fontWeight: '900' },

  stationSection: { marginTop: 13, marginBottom: 8 },

  subFieldTitle: { fontSize: 11, color: '#334155', fontWeight: '900', marginBottom: 9 },

  stationList: { gap: 7 },

  stationChoice: { borderWidth: 1.5, borderColor: '#E5EAF2', borderRadius: 12, padding: 11, flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: '#F8FAFC' },

  stationChoiceGuide: { fontSize: 11, color: '#64748B', lineHeight: 17, marginBottom: 10 },

  selectedStationNotice: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 9, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: '#ECFDF5', borderRadius: 12 },

  selectedStationText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#047857' },

  stationRequiredHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 13, backgroundColor: '#FFF7ED', marginTop: 12 },

  stationRequiredText: { flex: 1, fontSize: 11, color: '#92400E', fontWeight: '700' },

  stationChoiceName: { fontWeight: '800', color: '#1E293B', fontSize: 12 },

  stationChoiceAddress: { color: '#7C879A', fontSize: 10, marginTop: 3 },

  stationEmpty: { fontSize: 11, color: '#7C879A', lineHeight: 17, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 11 },

  hoursRow: { gap: 8, paddingVertical: 3 },

  hourChip: { borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },

  hourChipTime: { color: '#334155', fontWeight: '900', fontSize: 13 },

  hourChipCity: { color: '#64748B', fontSize: 10, maxWidth: 90 },

  arrivalBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, backgroundColor: '#FFF7ED', padding: 13, borderRadius: 14 },

  arrivalLabel: { fontSize: 11, color: '#92400E', fontWeight: '800' },

  arrivalValue: { fontSize: 19, color: '#9A3412', fontWeight: '900', marginTop: 4 },

  arrivalHint: { fontSize: 10, color: '#9A3412', lineHeight: 16, marginTop: 4 },

  submitOuter: { marginTop: 16, borderRadius: 18, overflow: 'hidden' },

  submitDisabled: { opacity: 0.7 },

  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16 },

  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, textAlign: 'center', flex: 1 },

  secureLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, marginTop: 15 },

  secureText: { color: '#667085', fontSize: 11, lineHeight: 17, flexShrink: 1, textAlign: 'center' },

});
