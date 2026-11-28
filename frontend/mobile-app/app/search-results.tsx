import PublishedScheduleCalendar from '../src/components/PublishedScheduleCalendar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  AccessibilityInfo,

  ActivityIndicator,

  Alert,


  Animated,

  Image,

  Pressable,

  RefreshControl,

  ScrollView,

  StatusBar,

  StyleSheet,

  Text,

  View,

  type ImageSourcePropType,

} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../src/services/supabase';
import api from '../src/services/api';

const PRIMARY = '#F97316';

const INK = '#16213B';

const MUTED = '#718096';

const FALLBACK_LOGO: ImageSourcePropType = require('../assets/images/bus.jpg');

const LOCAL_LOGOS: Record<string, ImageSourcePropType> = {

  'UTB CI': require('../assets/logos/utb.png'),

  'TRANSPORTS AVS': require('../assets/logos/avs.png'),

  'CTE TRANSPORT EXPRESS': require('../assets/logos/cte.png'),

  'MTK TRANSPORT': require('../assets/logos/mtk.png'),

  'MD TRANSPORT': require('../assets/logos/mdt.png'),

  SBTA: require('../assets/logos/sbta.png'),

  'STAF TRANSPORT': require('../assets/logos/staf.png'),

  'STL TRANSPORT': require('../assets/logos/stl.png'),

  'CA-TRANS': require('../assets/logos/trans.png'),

  TRANS: require('../assets/logos/trans.png'),

  SITTI: require('../assets/logos/sitti.png'),

  'SITTI TRANSPORT TERRESTRE INTERNATIONAL': require('../assets/logos/sitti.png'),

};

const read = (value: string | string[] | undefined): string =>

  (Array.isArray(value) ? value[0] : value || '').trim();

const normalize = (value: string): string =>

  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const sameCity = (a: string, b: string): boolean => normalize(a) === normalize(b);

const validHex = (value: unknown, fallback = PRIMARY): string =>

  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

const money = (value: number): string => `${Math.round(value).toLocaleString('fr-FR')} F CFA`;

// Ajouter des jours en UTC pour ne pas subir le fuseau horaire du téléphone.
function addIsoDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}


function companyLogo(name: string, remote?: string | null): ImageSourcePropType {

  if (remote && /^https:\/\//i.test(remote)) return { uri: remote };

  const key = normalize(name);

  const exact = Object.keys(LOCAL_LOGOS).find(candidate => normalize(candidate) === key);

  return exact ? LOCAL_LOGOS[exact] : FALLBACK_LOGO;

}

function dateDetails(raw: string): { text: string; iso: string | null; valid: boolean } {

  const value = raw.trim();

  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  const isoFormat = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  const year = Number(french?.[3] ?? isoFormat?.[1]);

  const month = Number(french?.[2] ?? isoFormat?.[2]);

  const day = Number(french?.[1] ?? isoFormat?.[3]);

  if (!year || !month || !day) return { text: value || 'Date non précisée', iso: null, valid: false };

  const parsed = new Date(year, month - 1, day, 12);

  const valid = parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;

  if (!valid) return { text: value, iso: null, valid: false };

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { text: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`, iso, valid: true };

}

interface Station {

  id: string;

  nom: string;

  ville: string;

  adresse?: string | null;

  company_id?: string;

}

interface Schedule {

  id: string;

  heure_depart: string;

  heure_arrivee?: string | null;

  date_depart?: string | null;

  date?: string | null;

}

interface RouteRow {

  id: string;

  company_id: string;

  ville: string;

  prix: number | string | null;

  duree?: string | null;

  gare_depart_id?: string | null;

  gare_arrivee_id?: string | null;

  quota?: number | null;

  billets_vendus?: number | null;

  is_active?: boolean | null;

  publie?: boolean | null;

  horaires?: Schedule[] | null;

}

interface CompanyRow {

  id: string;

  name: string;

  color?: string | null;

  logo_url?: string | null;

  is_verified?: boolean | null;

  is_active?: boolean | null;

}

interface DepartsProgrammesResponse {
  departs: DepartProgramme[];
  disponibilite_confirmee: boolean;
  paiement_actif: boolean;
  billet_emis: boolean;
}

interface DepartProgramme {
  id: string;
  company_id: string;
  gare_id: string;
  destination_id: string;
  horaire_id: string;
  date_depart: string;
  heure_depart: string;
  statut: string;
  numero_bus_snapshot: string | null;
  capacite_snapshot: number;
}

// Programmes indicatifs confirmés par le catalogue MESSAY PRO,
// mais PAS des départs avec bus affecté à une date.
interface ProgrammeLigne {
  destinationId: string;
  villeDepart: string;
  villeArrivee: string;
  gareDepart: string | null;
  gareArrivee: string | null;
  prix: number | null;
  duree: string | null;
  horaires: Array<{ horaireId: string; heureDepart: string }>;
}

interface SuggestionCompagnie {
  id: string;
  nom: string;
  logoUrl: string | null;
  correspondance: 'MEME_TRAJET' | 'MEME_DEPART';
}

interface Trip {

  key: string;

  affectationId: string;

  busLabel: string | null;

  capacite: number;

  destinationId: string;

  horaireId: string;

  time: string;

  arrival: string | null;

  duration: string | null;

  price: number | null;

  departureStation: Station;

  arrivalStation: Station | null;

  // true si la gare est directement rattachée à la ligne dans Supabase.
  arrivalLinked: boolean;

  company: CompanyRow;

}

interface Alternative {

  company: CompanyRow;

  price: number | null;

  routes: number;

  // Une liaison "linked" a une gare de départ explicitement liée.

  // "toConfirm" : ancienne destination sans gare_depart_id ; ce n'est pas une liaison confirmée.

  certainty: 'linked' | 'toConfirm' | 'sameRoute' | 'sameOrigin' | 'discovery';

}

type AlternativeCandidate = {

  companyId: string;

  route: RouteRow;

  certainty: 'linked' | 'toConfirm';

};

/**

 * Recherche intercompagnies compatible avec les deux modèles de destinations.

 * Ne déduit jamais une liaison certaine d'une simple liste de villes.

 */

function findAlternativeCandidates(

  allStations: Station[],

  routes: RouteRow[],

  origin: string,

  destination: string,

  selectedCompanyId: string,

): AlternativeCandidate[] {

  const stationsById = new Map(allStations.map(station => [String(station.id), station]));

  const originCompanies = new Set(allStations

    .filter(station => sameCity(station.ville, origin))

    .map(station => String(station.company_id || '')));

  return routes.flatMap<AlternativeCandidate>((route) => {

    const routeCompanyId = String(route.company_id || '');

    if (!routeCompanyId || routeCompanyId === selectedCompanyId || route.is_active === false || route.publie !== true) return [];

    const arrivalStation = route.gare_arrivee_id

      ? stationsById.get(String(route.gare_arrivee_id)) : undefined;

    // Si la gare d'arrivée explicite est absente de la base lisible, on ne peut pas

    // certifier la relation de cette destination.

    if (route.gare_arrivee_id && !arrivalStation) return [];

    if (arrivalStation && String(arrivalStation.company_id) !== routeCompanyId) return [];

    // Une destination contradictoire (ville publiée != gare d'arrivée) exige une correction ADMIN.

    if (arrivalStation && route.ville && !sameCity(route.ville, arrivalStation.ville)) return [];

    const destinationMatches = arrivalStation

      ? sameCity(arrivalStation.ville, destination)

      : sameCity(route.ville || '', destination);

    if (!destinationMatches) return [];

    if (route.gare_depart_id) {

      const departureStation = stationsById.get(String(route.gare_depart_id));

      if (!departureStation || String(departureStation.company_id) !== routeCompanyId ||

          !sameCity(departureStation.ville, origin)) return [];

      return [{ companyId: routeCompanyId, route, certainty: 'linked' as const }];

    }

    // Compatibilité ancien schéma : la compagnie a une gare dans la ville de départ,

    // mais la destination n'est liée à aucune gare départ. À confirmer, jamais réservable ici.

    if (!originCompanies.has(routeCompanyId)) return [];

    return [{ companyId: routeCompanyId, route, certainty: 'toConfirm' as const }];

  });

}

// Utiliser le fuseau de la compagnie, pas le fuseau du telephone.
function abidjanNow(): { date: string; heure: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    heure: `${part('hour')}:${part('minute')}`,
  };
}

function estDepartFutur(date: string, heure: string): boolean {
  const now = abidjanNow();
  return date > now.date || (date === now.date && heure > now.heure);
}

function hoursOnly(value: string): string | null {

  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));

  if (!match) return null;

  const hh = Number(match[1]);

  const mm = Number(match[2]);

  return hh <= 23 && mm <= 59 ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : null;

}

function arrivalTime(time: string, duration: string | null): string | null {

  if (!duration) return null;

  const format = /^(\d{1,2})h(?:(\d{1,2}))?$/.exec(duration.replace(/\s/g, ''));

  if (!format) return null;

  const [hh, mm] = time.split(':').map(Number);

  const minutes = hh * 60 + mm + Number(format[1]) * 60 + Number(format[2] ?? 0);

  const next = minutes % (24 * 60);

  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}${minutes >= 1440 ? ' +1j' : ''}`;

}

function StationSelector({

  title, icon, items, selected, onSelect, color,

}: {

  title: string;

  icon: React.ComponentProps<typeof Ionicons>['name'];

  items: Station[];

  selected: string;

  onSelect: (value: string) => void;

  color: string;

}) {

  const [expanded, setExpanded] = useState(false);

  const label = selected === 'all' ? `Toutes les gares (${items.length})` : items.find(g => g.id === selected)?.nom || 'Choisir une gare';

  return (

    <View style={s.stationField}>

      <Text style={s.stationLabel}><Ionicons name={icon} size={14} color={color} />  {title}</Text>

      <Pressable

        accessibilityRole="button" accessibilityState={{ expanded }}

        onPress={() => setExpanded(previous => !previous)}

        style={[s.stationButton, expanded && { borderColor: color }]}

      >

        <Text style={s.stationValue} numberOfLines={1}>{label}</Text>

        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />

      </Pressable>

      {expanded && (

        <View style={s.stationOptions}>

          <Pressable style={s.stationOption} onPress={() => { onSelect('all'); setExpanded(false); }}>

            <Text style={s.optionName}>Toutes les gares</Text>

            {selected === 'all' && <Ionicons name="checkmark-circle" size={19} color={color} />}

          </Pressable>

          {items.map(station => (

            <Pressable key={station.id} style={s.stationOption} onPress={() => { onSelect(station.id); setExpanded(false); }}>

              <View style={s.stationOptionCopy}>

                <Text style={s.optionName}>{station.nom}</Text>

                <Text style={s.optionInfo}>{station.adresse || station.ville}</Text>

              </View>

              {selected === station.id && <Ionicons name="checkmark-circle" size={19} color={color} />}

            </Pressable>

          ))}

        </View>

      )}

    </View>

  );

}

/** Animation discrète, compatible iOS/Android et accessibilité Reduce Motion. */
function PremiumReveal({ children, index = 0, reducedMotion }: {
  children: React.ReactNode;
  index?: number;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 490,
      delay: Math.min(index, 8) * 65,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index, reducedMotion]);
  return (
    <Animated.View style={{
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

/** Les horaires restent purement informatifs : aucun bouton d'achat fictif. */
function ProgrammeCard({ ligne, index, reducedMotion, accent }: {
  ligne: ProgrammeLigne;
  index: number;
  reducedMotion: boolean;
  accent: string;
}) {
  return (
    <PremiumReveal index={index} reducedMotion={reducedMotion}>
      <View style={s.programmeCard}>
        <View style={s.programmeHead}>
          <View style={s.programmeRouteIcon}>
            <Ionicons name="git-compare-outline" size={19} color={accent} />
          </View>
          <View style={s.programmeHeadCopy}>
            <Text style={s.programmeTrajet} numberOfLines={2}>
              {ligne.villeDepart} <Text style={{ color: accent }}>→</Text> {ligne.villeArrivee}
            </Text>
            {!!ligne.gareDepart && (
              <Text style={s.programmeGare} numberOfLines={2}>
                <Ionicons name="location-outline" size={13} color="#79869B" /> {ligne.gareDepart}
              </Text>
            )}
          </View>
          <View style={s.programmeTag}><Text style={s.programmeTagText}>INDICATIF</Text></View>
        </View>
        <View style={s.programmeDivider} />
        <View style={s.programmePriceRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.programmePriceLabel}>TARIF PUBLIÉ</Text>
            <Text style={s.programmeTarif}>
              {ligne.prix === null ? 'À confirmer' : money(ligne.prix)}
            </Text>
          </View>
          {!!ligne.duree && (
            <View style={s.programmeDuration}>
              <Ionicons name="time-outline" color="#64748B" size={15} />
              <Text style={s.programmeDurationText}>{ligne.duree}</Text>
            </View>
          )}
        </View>
        <Text style={s.programmeHoursLabel}>HORAIRES HABITUELS</Text>
        <View style={s.programmeHoraires}>
          {ligne.horaires.map(horaire => (
            <View key={horaire.horaireId} style={s.programmeHeurePill}>
              <Text style={s.programmeHeure}>{horaire.heureDepart}</Text>
            </View>
          ))}
        </View>
        <View style={s.programmeFoot}>
          <Ionicons name="shield-checkmark-outline" size={15} color="#9A5B24" />
          <Text style={s.programmeAvertissement}>
            Départ non confirmé · aucun siège garanti · réservation indisponible
          </Text>
        </View>
      </View>
    </PremiumReveal>
  );
}

function AnimatedTrip({

  trip, index, onBook, reducedMotion, color, blocked,

}: {

  trip: Trip;

  index: number;

  onBook: () => void;

  reducedMotion: boolean;

  color: string;

  blocked: boolean;

}) {

  const entry = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    if (reducedMotion) { entry.setValue(1); return; }

    const animate = Animated.timing(entry, { toValue: 1, duration: 400, delay: Math.min(index, 8) * 65, useNativeDriver: true });

    animate.start();

    return () => animate.stop();

  }, [entry, index, reducedMotion]);

  const scaleTo = (toValue: number) => {

    if (reducedMotion) return;

    Animated.spring(press, { toValue, useNativeDriver: true, friction: 8, tension: 180 }).start();

  };

  const arrival = trip.arrival;

  return (

    <Animated.View style={[s.tripCard, {

      opacity: entry,

      transform: [

        { translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },

        { scale: press },

      ],

    }]}>

      <View style={s.tripTop}>

        <View style={s.companyIdentity}>

          <View style={s.logoWrap}><Image source={companyLogo(trip.company.name, trip.company.logo_url)} style={s.logo} resizeMode="contain" /></View>

          <View style={{ flex: 1 }}>

            <Text style={s.companyName} numberOfLines={1}>{trip.company.name}</Text>

            <Text style={s.companySubtitle}>Transport interurbain · Départ programmé</Text>

          </View>

        </View>

        <View style={[s.timeBadge, { backgroundColor: `${color}12` }]}><Text style={[s.timeBadgeText, { color }]}>{trip.time}</Text></View>

      </View>

      <View style={s.journey}>

        <View style={s.journeyStop}>

          <Text style={s.journeyTime}>{trip.time}</Text>

          <Text style={s.journeyStation} numberOfLines={2}>{trip.departureStation.nom}</Text>

          <Text style={s.journeyCity}>{trip.departureStation.ville}</Text>

        </View>

        <View style={s.journeyMiddle}>

          <View style={s.journeyLine}/>

          <View style={[s.journeyBus, { backgroundColor: color }]}><MaterialCommunityIcons name="bus" size={15} color="#FFFFFF" /></View>

          <View style={s.journeyLine}/>

          {trip.duration && <Text style={s.durationText}>{trip.duration}</Text>}

        </View>

        <View style={[s.journeyStop, { alignItems: 'flex-end' }]}>

          <Text style={s.journeyTime}>{arrival || '—'}</Text>

          <Text style={[s.journeyStation, { textAlign: 'right' }]} numberOfLines={2}>{trip.arrivalStation?.nom || 'Gare à préciser'}</Text>

          <Text style={s.journeyCity}>{trip.arrivalStation?.ville || 'Arrivée à confirmer'}</Text>

        </View>

      </View>

      <View style={s.tripFooter}>

        <View style={{ flex: 1 }}>

          <Text style={s.priceLabel}>Tarif indicatif publié</Text>

          <Text style={[s.price, { color }]}>{trip.price !== null ? money(trip.price) : 'À confirmer'}</Text>

          <Text style={s.seatsText}>Bus : {trip.busLabel || 'affecté'} · Capacité : {trip.capacite} places</Text>
          <Text style={s.seatsText}>Ventes appli + guichet · Siège attribué par la compagnie après paiement</Text>

        </View>

        <Pressable

          accessibilityRole="button"

          disabled={blocked}

          onPressIn={() => { if (!blocked) scaleTo(0.975); }} onPressOut={() => scaleTo(1)}

          onPress={onBook}

          style={[s.reserveButton, { backgroundColor: blocked ? '#E9ECF1' : color }]}

        >

          <Text style={[s.reserveText, blocked && { color: '#6B7280' }]}>{blocked ? 'Indisponible' : 'Continuer'}</Text>

          <Ionicons name="arrow-forward" size={16} color={blocked ? '#6B7280' : '#FFFFFF'} />

        </Pressable>

      </View>

    </Animated.View>

  );

}

function AnimatedAlternativeCard({ item, index, reducedMotion, accent, onPress }: {

  item: Alternative;

  index: number;

  reducedMotion: boolean;

  accent: string;

  onPress: () => void;

}) {

  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    if (reducedMotion) { reveal.setValue(1); return; }

    const animation = Animated.timing(reveal, { toValue: 1, duration: 380, delay: Math.min(index, 8) * 60, useNativeDriver: true });

    animation.start();

    return () => animation.stop();

  }, [reveal, index, reducedMotion]);

  const animatePress = (value: number) => {

    if (reducedMotion) return;

    Animated.spring(press, { toValue: value, friction: 8, tension: 180, useNativeDriver: true }).start();

  };

  const linked = item.certainty === 'linked';
  const disclosure = item.certainty === 'discovery';
  const certaintyLabel = linked ? 'Gare de départ liée · bus à vérifier'
    : item.certainty === 'sameRoute' ? 'Même trajet publié · bus à vérifier'
    : item.certainty === 'sameOrigin' ? 'Même ville de départ · trajet à vérifier'
    : disclosure ? 'Compagnie du répertoire · trajet inconnu'
    : 'Destination à confirmer';

  return (

    <Animated.View style={[s.alternative, {

      opacity: reveal,

      transform: [

        { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },

        { scale: press },

      ],

    }]}>

      <Pressable accessibilityRole="button"

        accessibilityLabel={`Consulter les voyages de ${item.company.name}, disponibilité non confirmée`}

        style={s.altPressable}

        onPressIn={() => animatePress(0.975)} onPressOut={() => animatePress(1)}

        onPress={onPress}>

        <View style={s.altLogo}><Image source={companyLogo(item.company.name, item.company.logo_url)} resizeMode="contain" style={s.logo}/></View>

        <View style={s.altCopy}>

          <Text numberOfLines={1} style={s.altName}>{item.company.name}</Text>

          <Text style={[s.altCertainty, { color: linked ? '#166534' : '#92400E' }]}>

            {certaintyLabel}

          </Text>

          <Text style={s.altSub}>
          {item.routes > 0 ? `${item.routes} ligne${item.routes > 1 ? 's' : ''} identifiée${item.routes > 1 ? 's' : ''}` : 'Aucun départ confirmé ici'}
          {' · '}{item.company.is_verified === true ? 'Compte vérifié' : 'Compte à vérifier'}
        </Text>

        </View>

        <View style={s.altRight}>

          <Text style={[s.altPrice, { color: linked ? accent : MUTED }]}>

            {linked && item.price !== null ? `Dès ${money(item.price)}` : 'Tarif à vérifier'}

          </Text>

          <Text style={[s.altForwardLabel, { color: accent }]}>{'Vérifier les départs'}</Text>

        <Ionicons name="arrow-forward-circle" size={25} color={accent}/>

        </View>

      </Pressable>

    </Animated.View>

  );

}

export default function SearchResultsScreen() {

  const router = useRouter();

  const params = useLocalSearchParams<{

    depart?: string; destination?: string; date?: string; company?: string; color?: string; id?: string;

    gare_depart_id?: string; gare_arrivee_id?: string; horaireId?: string; heure_depart?: string;

  }>();

  const origin = read(params.depart);

  const destination = read(params.destination);

  const dateParam = read(params.date);

  const companyId = read(params.id);

  const companyParamName = read(params.company);

  const requestedDepartureStation = read(params.gare_depart_id);

  const requestedArrivalStation = read(params.gare_arrivee_id);

  const requestedScheduleId = read(params.horaireId);

  const requestedHour = read(params.heure_depart);

  const theme = validHex(read(params.color));

  const travelDate = useMemo(() => dateDetails(dateParam), [dateParam]);

  const [company, setCompany] = useState<CompanyRow | null>(null);

  // Une date sans bus affecté n'est pas une vente possible : proposer seulement
  // d'autres dates qui ont de VRAIES affectations renvoyées par le backend.
  const [eligibleDepartKeys, setEligibleDepartKeys] = useState<string[]>([]);
  const [nextDates, setNextDates] = useState<string[]>([]);
  const [nextDatesLoading, setNextDatesLoading] = useState(false);
  const [nextDatesError, setNextDatesError] = useState<string | null>(null);
  const [nextDatesChecked, setNextDatesChecked] = useState(false);
  const nextDatesRequest = useRef(0);


  const [trips, setTrips] = useState<Trip[]>([]);

  const [stations, setStations] = useState<Station[]>([]);

  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  const [alternativesError, setAlternativesError] = useState<string | null>(null);

  const [programmesLignes, setProgrammesLignes] = useState<ProgrammeLigne[]>([]);
  const [programmesError, setProgrammesError] = useState<string | null>(null);
  const [showAllProgrammes, setShowAllProgrammes] = useState(false);

  const programmesTrajet = programmesLignes.filter(ligne =>
    sameCity(ligne.villeDepart, origin) && sameCity(ligne.villeArrivee, destination)
  );
  const programmesAutres = programmesLignes.filter(ligne =>
    sameCity(ligne.villeDepart, origin) && !sameCity(ligne.villeArrivee, destination)
  );
  const programmesAutresVisibles = showAllProgrammes
    ? programmesAutres
    : programmesAutres.slice(0, 3);

  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);

  const [departureId, setDepartureId] = useState(requestedDepartureStation || 'all');

  const [arrivalId, setArrivalId] = useState(requestedArrivalStation || 'all');

  const [hourId, setHourId] = useState(requestedScheduleId);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  const requestCounter = useRef(0);

  const headerEntry = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then(value => {

      if (!active) return;

      setReducedMotion(value);

      if (value) headerEntry.setValue(1);

      else Animated.timing(headerEntry, { toValue: 1, duration: 550, useNativeDriver: true }).start();

    }).catch(() => headerEntry.setValue(1));

    return () => { active = false; };

  }, [headerEntry]);

  const load = useCallback(async (refresh = false) => {

    const request = ++requestCounter.current;

    if (refresh) setRefreshing(true);

    else setLoading(true);

    setError(null);
    // Annuler une éventuelle recherche de dates lancée avant ce rechargement.
    nextDatesRequest.current += 1;
    setNextDates([]);
    setNextDatesChecked(false);
    setNextDatesError(null);
    setNextDatesLoading(false);
    setEligibleDepartKeys([]);

    try {

      if (!companyId || !origin || !destination || !travelDate.valid) {

        throw new Error('Vérifiez la compagnie, le départ, la destination et la date sélectionnés.');

      }

      // Une gare ou une destination doit appartenir à la compagnie. Aucune donnée fictive.

      // La liste des départs est issue du backend MESSAY (lecture SQL avec
      // liaison exacte compagnie + gare + ligne + horaire + date).
      // Si elle est inaccessible, ne jamais inventer des bus programmés.
      const [stationsResult, routesResult, companyResult, departsResponse] = await Promise.all([
        supabase.from('gares').select('id,nom,ville,adresse,company_id').eq('company_id', companyId).limit(500),
        supabase.from('destinations').select('*').eq('company_id', companyId).limit(500),
        supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
        api.get<DepartsProgrammesResponse>('/tickets/departs-programmes', {
          params: { companyId, date: travelDate.iso },
        }),
      ]);

      if (stationsResult.error) throw stationsResult.error;

      if (routesResult.error) throw routesResult.error;

      if (companyResult.error) throw companyResult.error;

      if (!companyResult.data) throw new Error('La compagnie demandée est introuvable.');

      const currentCompany = companyResult.data as CompanyRow;

      if (currentCompany.is_active !== true) throw new Error('Cette compagnie est actuellement indisponible.');

      const allStations = (stationsResult.data ?? []) as Station[];

      const rows = (routesResult.data ?? []) as RouteRow[];
      const departs = Array.isArray(departsResponse.data?.departs)
        ? departsResponse.data.departs
        : [];
      // Le statut commercial réel reste une décision du backend de réservation.
      // Les données du catalogue seules n'autorisent aucun encaissement.

      const routeIds = rows.map(row => String(row.id));
      const horairesParLigne = new Map<string, Schedule[]>();
      if (routeIds.length > 0) {
        const horairesResult = await supabase.from('horaires')
          .select('id,destination_id,heure_depart')
          .in('destination_id', routeIds).limit(5000);
        if (horairesResult.error) throw horairesResult.error;
        for (const row of (horairesResult.data ?? [])) {
          const id = String(row.destination_id);
          const list = horairesParLigne.get(id) ?? [];
          list.push(row as Schedule);
          horairesParLigne.set(id, list);
        }
      }

      const departureStations = allStations.filter(station => sameCity(station.ville, origin));

      const departureIds = new Set(departureStations.map(station => String(station.id)));

      const stationsById = new Map(allStations.map(station => [String(station.id), station]));

      const publishedRoutes = rows.filter(row => {

        if (row.publie !== true || row.is_active === false || !row.gare_depart_id || !departureIds.has(String(row.gare_depart_id))) return false;

        const arrival = row.gare_arrivee_id ? stationsById.get(String(row.gare_arrivee_id)) : undefined;

        if (row.gare_arrivee_id && !arrival) return false;
        if (arrival && !sameCity(row.ville, arrival.ville)) return false;
        return arrival ? sameCity(arrival.ville, destination) : sameCity(row.ville, destination);

      });

      const scheduled: Trip[] = [];

      for (const route of publishedRoutes) {

        const departureStation = stationsById.get(String(route.gare_depart_id));

        if (!departureStation) continue;

        // Préserver la gare explicitement choisie par le voyageur dans buy-ticket.
        // Dans les anciennes lignes, gare_arrivee_id peut être NULL même si
        // la gare existe dans le registre de cette compagnie. Vérifier son ID,
        // sa compagnie (liste chargée avec eq(company_id)) et sa ville.
        // Le rattachement de cette gare à la ligne devra néanmoins être
        // confirmé par le serveur AVANT toute vente.
        const linkedArrivalStation = route.gare_arrivee_id
          ? stationsById.get(String(route.gare_arrivee_id)) ?? null
          : null;
        const selectedArrivalStation = requestedArrivalStation
          ? stationsById.get(requestedArrivalStation) ?? null
          : null;
        const arrivalStation = linkedArrivalStation ?? (
          !route.gare_arrivee_id &&
          selectedArrivalStation &&
          sameCity(selectedArrivalStation.ville, route.ville) &&
          String(selectedArrivalStation.company_id) === companyId
            ? selectedArrivalStation
            : null
        );

        const rawPrice = route.prix === null ? NaN : Number(route.prix);

        const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null;

        // Ne pas créer d'horaire fictif lorsque la compagnie n'en a publié aucun.

        for (const schedule of (horairesParLigne.get(String(route.id)) ?? [])) {
          const time = hoursOnly(schedule.heure_depart);
          if (!time || !travelDate.iso || !estDepartFutur(travelDate.iso, time)) continue;

          // Correspondance stricte : un horaire général n'est PAS un départ
          // confirmé tant qu'un bus n'a pas été affecté pour cette date.
          const matching = departs.filter(a =>
            a.company_id === companyId &&
            a.gare_id === String(departureStation.id) &&
            a.destination_id === String(route.id) &&
            a.horaire_id === String(schedule.id) &&
            a.date_depart === travelDate.iso &&
            a.heure_depart === time &&
            ['PROGRAMME', 'PROGRAMMEE'].includes(a.statut.toUpperCase()) &&
            Number.isInteger(a.capacite_snapshot) &&
            a.capacite_snapshot >= 1 && a.capacite_snapshot <= 120
          );

          for (const affectation of matching) {
            if (currentCompany.is_verified !== true) continue;
            scheduled.push({
              key: affectation.id,
              affectationId: affectation.id,
              busLabel: affectation.numero_bus_snapshot,
              capacite: affectation.capacite_snapshot,
              destinationId: String(route.id),
              horaireId: String(schedule.id),
              time,
              arrival: arrivalTime(time, route.duree || null),
              duration: route.duree || null,
              price,
              departureStation,
              arrivalStation,
              arrivalLinked: Boolean(linkedArrivalStation),
              company: currentCompany,
            });
          }
        }

      }

      // Les clés de recherche correspondent exclusivement à des lignes et
      // horaires publiés, attachés à la bonne gare dans la compagnie vérifiée.
      const eligibleKeys = currentCompany.is_verified === true
        ? publishedRoutes.flatMap(route =>
            (horairesParLigne.get(String(route.id)) ?? [])
              .filter(schedule => hoursOnly(schedule.heure_depart) !== null)
              .map(schedule => `${route.gare_depart_id}|${route.id}|${schedule.id}`),
          )
        : [];

      scheduled.sort((a, b) => a.time.localeCompare(b.time));

      // Les programmes et compagnies suggérées ne sont pas des bus confirmés.
      // Un échec de ces catalogues complémentaires n'annule pas la recherche principale.
      let lignesPubliees: ProgrammeLigne[] = [];
      let lignesErreur: string | null = null;
      let compagniesApi: SuggestionCompagnie[] = [];
      let suggestionsErreur: string | null = null;

      if (scheduled.length === 0) {
        const [programmesResult, suggestionsResult] = await Promise.allSettled([
          api.get<{ lignes: ProgrammeLigne[] }>('/tickets/programmes-lignes', {
            params: { companyId },
          }),
          api.get<{ suggestions: SuggestionCompagnie[] }>('/tickets/compagnies-suggestions', {
            params: { companyId, villeDepart: origin, villeArrivee: destination },
          }),
        ]);

        if (programmesResult.status === 'fulfilled') {
          lignesPubliees = Array.isArray(programmesResult.value.data?.lignes)
            ? programmesResult.value.data.lignes
            : [];
        } else {
          if (__DEV__) console.warn('[MESSAY/programmes-lignes]', programmesResult.reason);
          lignesErreur = 'Impossible de charger les horaires publiés. Actualisez pour réessayer.';
        }

        if (suggestionsResult.status === 'fulfilled') {
          compagniesApi = Array.isArray(suggestionsResult.value.data?.suggestions)
            ? suggestionsResult.value.data.suggestions
            : [];
        } else {
          if (__DEV__) console.warn('[MESSAY/compagnies-suggestions]', suggestionsResult.reason);
          suggestionsErreur = 'Recherche des compagnies suggérées indisponible.';
        }
      }

      const otherStations = allStations.filter(station => !sameCity(station.ville, origin));

      // Comparateur intercompagnies : disponible même si la compagnie actuelle a des départs.

      // Les anciennes destinations non liées à une gare restent seulement "à confirmer".

      let otherCompanies: Alternative[] = [];

      let alternativesLoadError: string | null = null;

      try {

        const [allStationsResult, allRoutesResult] = await Promise.all([

          supabase.from('gares').select('id,nom,ville,company_id').limit(2000),

          supabase.from('destinations').select('*').limit(2000),

        ]);

        if (allStationsResult.error) throw allStationsResult.error;

        if (allRoutesResult.error) throw allRoutesResult.error;

        const allPublicStations = (allStationsResult.data ?? []) as Station[];

        const allPublicRoutes = (allRoutesResult.data ?? []) as RouteRow[];

        const candidates = findAlternativeCandidates(

          allPublicStations, allPublicRoutes, origin, destination, companyId,

        );

        const companyIds = Array.from(new Set(candidates.map(candidate => candidate.companyId)));

        if (companyIds.length > 0) {

          const companiesResult = await supabase.from('companies').select('*')

            .in('id', companyIds).limit(100);

          if (companiesResult.error) throw companiesResult.error;

          otherCompanies = ((companiesResult.data ?? []) as CompanyRow[])

            .filter(item => item.is_active !== false)

            .map(item => {

              const matches = candidates.filter(candidate => candidate.companyId === String(item.id));

              const linked = matches.filter(candidate => candidate.certainty === 'linked');

              // Prix d'un itinéraire explicitement lié uniquement (pas de prix fictif pour l'ancien modèle).

              const prices = linked.map(candidate => candidate.route.prix === null ? NaN : Number(candidate.route.prix))

                .filter(price => Number.isFinite(price) && price >= 0);

              return {

                company: item,

                price: prices.length > 0 ? Math.min(...prices) : null,

                routes: matches.length,

                certainty: linked.length > 0 ? 'linked' as const : 'toConfirm' as const,

              };

            })

            .sort((a, b) => {

              if (a.certainty !== b.certainty) return a.certainty === 'linked' ? -1 : 1;

              if (a.company.is_verified !== b.company.is_verified) return a.company.is_verified ? -1 : 1;

              return a.company.name.localeCompare(b.company.name, 'fr');

            });

        }

        if (__DEV__) console.log('[MESSAY/alternatives]', {

          garesAccessibles: allPublicStations.length,

          destinationsAccessibles: allPublicRoutes.length,

          candidates: candidates.length,

          compagnies: otherCompanies.length,

        });

      } catch (candidateError: unknown) {

        // Un problème RLS/réseau sur les autres compagnies ne doit pas masquer les départs actuels.

        if (__DEV__) console.warn('[MESSAY/alternatives] Erreur de lecture Supabase', candidateError);

        alternativesLoadError = 'Recherche des autres compagnies indisponible. Vérifiez les accès en lecture aux gares, destinations et compagnies, puis actualisez.';

      }

      if (scheduled.length === 0) {
        // Ordre de pertinence : vraie ligne liée, même trajet déclaré, même ville,
        // ancienne liaison non reliée, puis simple présence au répertoire.
        const connues = new Set(otherCompanies.map(item => String(item.company.id)));
        connues.add(companyId);
        for (const item of compagniesApi) {
          if (!item.id || !item.nom || connues.has(item.id)) continue;
          connues.add(item.id);
          otherCompanies.push({
            company: { id: item.id, name: item.nom, logo_url: item.logoUrl },
            price: null,
            routes: 0,
            certainty: item.correspondance === 'MEME_TRAJET' ? 'sameRoute' : 'sameOrigin',
          });
        }

        // S'il n'y a pas 4 correspondances, proposer de vraies compagnies inscrites,
        // mais sans leur attribuer une ligne ou un départ non démontré.
        if (otherCompanies.length < 4) {
          try {
            const repertoire = await supabase.from('companies').select('*')
              .neq('id', companyId).limit(100);
            if (repertoire.error) throw repertoire.error;
            const decouvertes = ((repertoire.data ?? []) as CompanyRow[])
              .filter(item => item.is_active !== false && !!item.name?.trim() && !connues.has(String(item.id)))
              .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            for (const item of decouvertes) {
              if (otherCompanies.length >= 4) break;
              connues.add(String(item.id));
              otherCompanies.push({ company: item, price: null, routes: 0, certainty: 'discovery' });
            }
          } catch (repertoireError: unknown) {
            if (__DEV__) console.warn('[MESSAY/repertoire-compagnies]', repertoireError);
            if (otherCompanies.length === 0) {
              alternativesLoadError = suggestionsErreur ||
                'Le répertoire des compagnies est momentanément indisponible.';
            }
          }
        }
        // L'absence de suggestions strictes (HTTP 200, tableau vide) est normale.
        if (otherCompanies.length === 0 && suggestionsErreur && !alternativesLoadError) {
          alternativesLoadError = suggestionsErreur;
        }
      }

      const classement: Record<Alternative['certainty'], number> = {
        linked: 0,
        sameRoute: 1,
        sameOrigin: 2,
        toConfirm: 3,
        discovery: 4,
      };
      otherCompanies.sort((a, b) =>
        classement[a.certainty] - classement[b.certainty] ||
        a.company.name.localeCompare(b.company.name, 'fr')
      );
      otherCompanies = otherCompanies.slice(0, 4);

      if (request !== requestCounter.current) return;

      setCompany(currentCompany);

      setStations(allStations);

      setNearbyStations(otherStations.slice(0, 8));

      setTrips(scheduled);
      setEligibleDepartKeys(eligibleKeys);
      setProgrammesLignes(lignesPubliees);
      setProgrammesError(lignesErreur);
      setShowAllProgrammes(false);

      setAlternatives(otherCompanies);

      setAlternativesError(alternativesLoadError);

      // Réutilise les gares et l'horaire choisis sur la page précédente.

      // Ils sont filtrés contre les départs réels, sans faire confiance aux paramètres.

      // Les paramètres peuvent provenir d'une ancienne recherche ou compagnie.
      // Ne pas appliquer un filtre qui masquerait des départs valides.
      const selectedDepartureExists = scheduled.some(
        trip => trip.departureStation.id === requestedDepartureStation,
      );
      const nextDeparture = selectedDepartureExists ? requestedDepartureStation : 'all';
      const selectedArrivalExists = scheduled.some(trip =>
        trip.arrivalStation?.id === requestedArrivalStation &&
        (nextDeparture === 'all' || trip.departureStation.id === nextDeparture),
      );
      const nextArrival = selectedArrivalExists ? requestedArrivalStation : 'all';
      const selectedHourExists = scheduled.some(trip =>
        trip.horaireId === requestedScheduleId &&
        (nextDeparture === 'all' || trip.departureStation.id === nextDeparture) &&
        (nextArrival === 'all' || trip.arrivalStation?.id === nextArrival),
      );
      setDepartureId(nextDeparture);
      setArrivalId(nextArrival);
      setHourId(selectedHourExists ? requestedScheduleId : '');

    } catch (caught) {

      if (request !== requestCounter.current) return;

      const message = caught instanceof Error ? caught.message : 'Impossible de récupérer les trajets.';

      setError(message);

      setTrips([]);
      setEligibleDepartKeys([]);
      setProgrammesLignes([]);
      setProgrammesError(null);

      setAlternatives([]);

      setAlternativesError(null);

    } finally {

      if (request === requestCounter.current) { setLoading(false); setRefreshing(false); }

    }

  }, [companyId, destination, origin, travelDate.iso, travelDate.valid,

      requestedDepartureStation, requestedArrivalStation, requestedScheduleId]);

  useEffect(() => {

    void load();

    return () => {
      requestCounter.current += 1;
      nextDatesRequest.current += 1;
    };

  }, [load]);

  // Recherche explicite, déclenchée par le voyageur pour éviter 7 requêtes
  // supplémentaires à chaque affichage. Aucune affectation n'est créée ici.
  const searchNextDates = async () => {
    if (!companyId || !travelDate.iso || company?.is_active !== true ||
        company?.is_verified !== true || eligibleDepartKeys.length === 0) {
      setNextDatesChecked(true);
      setNextDatesError('Aucune ligne publiée et validée ne permet cette recherche.');
      return;
    }

    const request = ++nextDatesRequest.current;
    setNextDatesLoading(true);
    setNextDatesChecked(false);
    setNextDatesError(null);
    setNextDates([]);

    // Commencer après la date demandée (ou aujourd'hui, si elle est passée).
    const start = travelDate.iso > abidjanNow().date ? travelDate.iso : abidjanNow().date;
    const dates = Array.from({ length: 7 }, (_, index) => addIsoDays(start, index + 1));
    const allowed = new Set(eligibleDepartKeys);

    try {
      const results = await Promise.allSettled(dates.map(date =>
        api.get<DepartsProgrammesResponse>('/tickets/departs-programmes', {
          params: { companyId, date },
        }),
      ));
      if (request !== nextDatesRequest.current) return;

      let verifiedCount = 0;
      const confirmedDates: string[] = [];
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const rows = result.value.data?.departs;
        if (!Array.isArray(rows)) return;
        verifiedCount += 1;
        const date = dates[index];
        if (rows.some(depart =>
          depart.company_id === companyId &&
          depart.date_depart === date &&
          ['PROGRAMME', 'PROGRAMMEE'].includes(String(depart.statut).toUpperCase()) &&
          Number.isInteger(depart.capacite_snapshot) &&
          depart.capacite_snapshot >= 1 && depart.capacite_snapshot <= 120 &&
          hoursOnly(depart.heure_depart) !== null &&
          estDepartFutur(date, hoursOnly(depart.heure_depart)!) &&
          allowed.has(`${depart.gare_id}|${depart.destination_id}|${depart.horaire_id}`)
        )) confirmedDates.push(date);
      });
      setNextDates(confirmedDates);
      setNextDatesChecked(true);
      if (verifiedCount === 0) {
        setNextDatesError('Impossible de consulter les prochains départs. Réessayez.');
      } else if (verifiedCount < dates.length) {
        setNextDatesError('Recherche partielle : certaines dates n’ont pas pu être vérifiées.');
      }
    } catch (err: unknown) {
      if (request !== nextDatesRequest.current) return;
      if (__DEV__) console.warn('[MESSAY/prochains-departs]', err);
      setNextDatesError('Recherche momentanément indisponible.');
    } finally {
      if (request === nextDatesRequest.current) setNextDatesLoading(false);
    }
  };

  const openNextDate = (date: string) => {
    if (!dateDetails(date).valid) return;
    router.push({
      pathname: '/search-results',
      params: {
        depart: origin,
        destination,
        date,
        company: company?.name ?? companyParamName,
        color: validHex(company?.color, theme),
        id: companyId,
        ...(requestedDepartureStation ? { gare_depart_id: requestedDepartureStation } : {}),
        ...(requestedArrivalStation ? { gare_arrivee_id: requestedArrivalStation } : {}),
      },
    });
  };

  const filtered = useMemo(() => trips.filter(trip =>

    (departureId === 'all' || String(trip.departureStation.id) === departureId) &&

    (arrivalId === 'all' || String(trip.arrivalStation?.id) === arrivalId) &&

    (!hourId || trip.horaireId === hourId)

  ), [trips, departureId, arrivalId, hourId]);

  const departureStations = useMemo(() => stations.filter(station => trips.some(trip => trip.departureStation.id === station.id)), [stations, trips]);

  const arrivalStations = useMemo(() => stations.filter(station => trips.some(trip =>

    trip.arrivalStation?.id === station.id && (departureId === 'all' || String(trip.departureStation.id) === departureId)

  )), [stations, trips, departureId]);

  const accent = validHex(company?.color, theme);

  const expired = !travelDate.iso || travelDate.iso < abidjanNow().date;

  // Le voyageur ne choisit jamais son siège sur le mobile.
  // Les ventes APP et GUICHET doivent consommer une même capacité serveur.
  // Cette navigation ouvre uniquement la saisie du passager : aucun billet,
  // siège ou paiement n'est créé ici. Le backend doit ensuite confirmer un
  // blocage de capacité et le montant réel avant toute transaction.
  const onBook = (trip: Trip) => {
    if (!travelDate.iso || !estDepartFutur(travelDate.iso, trip.time)) {
      Alert.alert('Départ terminé', 'Choisissez une date et un horaire futurs.');
      return;
    }
    if (company?.is_active !== true || company?.is_verified !== true) {
      Alert.alert('Départ non réservable', 'Cette compagnie n’est pas encore active et vérifiée par MESSAY.');
      return;
    }
    if (trip.price === null || !Number.isFinite(trip.price) || trip.price <= 0) {
      Alert.alert('Tarif non confirmé', 'La compagnie doit publier un tarif valide pour continuer.');
      return;
    }
    router.push({
      pathname: '/passenger-info',
      params: {
        // Identité du départ daté : obligatoire dans les étapes suivantes.
        affectationId: trip.affectationId,
        companyId: String(trip.company.id),
        company: trip.company.name,
        color: accent,
        depart: trip.departureStation.ville,
        destination: trip.arrivalStation?.ville || destination,
        date: travelDate.text,
        dateIso: travelDate.iso,
        // Harmoniser les noms : passenger-info et checkout reconnaissent heure/prix.
        heure: trip.time,
        heureDepart: trip.time,
        heure_arrivee: trip.arrival ?? '',
        duree: trip.duration ?? '',
        prix: String(trip.price),
        prixIndicatif: String(trip.price),
        gare: trip.departureStation.nom,
        gareId: String(trip.departureStation.id),
        gare_depart: trip.departureStation.nom,
        gare_depart_id: String(trip.departureStation.id),
        // Ne jamais inventer une gare d'arrivée lorsqu'elle n'est pas liée.
        ...(trip.arrivalStation ? {
          gare_arrivee: trip.arrivalStation.nom,
          gare_arrivee_id: String(trip.arrivalStation.id),
          // Une gare choisie n'est pas automatiquement liée à la destination.
          gare_arrivee_liee: trip.arrivalLinked ? 'true' : 'false',
        } : {}),
        destinationId: trip.destinationId,
        horaireId: trip.horaireId,
        seats: '1',
        siege_auto: 'true',
        attributionSiege: 'COMPAGNIE_APRES_PAIEMENT',
      },
    });
  };

  const onAlternative = (alternative: Alternative) => {

    // Le changement de compagnie poursuit le parcours, sans retourner à son accueil.

    // On garde la ville de départ, la destination et la date, mais JAMAIS les IDs

    // des gares/horaires : ils appartiennent à la compagnie précédente.

    const nextParams = {

      depart: origin,

      destination,

      date: travelDate.text,

      company: alternative.company.name,

      color: validHex(alternative.company.color),

      id: String(alternative.company.id),

    };

    // Même pour les anciennes liaisons et les compagnies du répertoire,
  // ne jamais orienter directement vers un achat ou un paiement.
  // La nouvelle recherche vérifie les départs affectés pour cette compagnie.
  router.push({ pathname: '/search-results', params: nextParams });

  };

  return (

    <View style={s.root}>

      <StatusBar barStyle="light-content" />

      <Animated.View style={{ opacity: headerEntry, transform: [{ translateY: headerEntry.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) }] }}>

        <LinearGradient colors={['#111B30', '#713D3A', accent]} locations={[0, 0.43, 1]} style={s.hero}>
          <View pointerEvents="none" style={s.heroGlow} />
          <SafeAreaView edges={['top']}>

            <View style={s.topBar}>

              <Pressable accessibilityLabel="Retour" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.circleButton}>

                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />

              </Pressable>

              <View style={s.headerTitleBox}>

                <Text style={s.overline}>MESSAY · BILLETTERIE</Text>

                <Text style={s.headerTitle}>Voyages disponibles</Text>

              </View>

              <Pressable accessibilityLabel="Actualiser" onPress={() => void load(true)} style={s.circleButton}>

                {refreshing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="refresh" size={20} color="#FFFFFF" />}

              </Pressable>

            </View>

            <View style={s.routeHeader}>
              <Text style={s.routeCaption}>VOTRE ITINÉRAIRE</Text>
              {/* Les villes occupent chacune toute la largeur : jamais de coupure de Yamoussoukro. */}
              <View style={s.routeNames}>
                <View style={s.premiumOriginRow}>
                  <View style={s.premiumRouteDot} />
                  <Text style={s.premiumRouteOverline}>DÉPART</Text>
                  <Text style={s.premiumOriginCity} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>
                    {origin || 'Départ'}
                  </Text>
                </View>
                <View style={s.premiumArrivalRow}>
                  <View style={s.routeArrow}>
                    <Ionicons name="arrow-down" color="#FFFFFF" size={18} />
                  </View>
                  <View style={s.premiumDestinationBox}>
                    <Text style={s.premiumRouteOverline}>DESTINATION</Text>
                    <Text style={s.premiumDestinationCity} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                      {destination || 'Arrivée'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={s.heroMeta}>

                <Ionicons name="calendar-outline" color="#FFFFFF" size={15}/>

                <Text style={s.heroMetaText}>{travelDate.text}</Text>

                <View style={s.heroDivider}/>

                <Ionicons name="business-outline" color="#FFFFFF" size={15}/>

                <Text numberOfLines={1} style={[s.heroMetaText, { flex: 1 }]}>{company?.name || companyParamName || 'Compagnie'}</Text>

              </View>

            </View>

          </SafeAreaView>

        </LinearGradient>

      </Animated.View>

      {loading ? (

        <View style={s.loader}><ActivityIndicator size="large" color={accent}/><Text style={s.loaderText}>Recherche des bus programmés…</Text></View>

      ) : (

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollContent}

          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={accent} colors={[accent]} />}>

          {error ? (

            <View style={s.errorCard}>

              <Ionicons name="cloud-offline-outline" size={27} color="#C2410C"/>

              <Text style={s.errorTitle}>Recherche indisponible</Text>

              <Text style={s.errorDescription}>{error}</Text>

              <Pressable onPress={() => void load(true)} style={[s.retry, { backgroundColor: accent }]}><Text style={s.retryText}>Réessayer</Text></Pressable>

            </View>

          ) : (

            <>

              <PremiumReveal reducedMotion={reducedMotion}>
                <View style={s.notice}>
                  <View style={s.noticeIcon}>
                    <Ionicons name="information-circle-outline" color="#AF5D2A" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.noticeTitle}>Information sur les départs</Text>
                    <Text style={s.noticeText}>
                      Les billets vendus en ligne et au guichet partagent le même stock de places.
                      La compagnie attribue le siège après confirmation du paiement.
                    </Text>
                  </View>
                </View>
              </PremiumReveal>

              {trips.length > 0 ? (

                <>

                  <View style={s.sectionTitleRow}>

                    <View><Text style={s.eyebrow}>VOTRE VOYAGE</Text><Text style={s.sectionTitle}>Choisissez votre départ</Text></View>

                    <View style={s.countPill}><Text style={[s.countText, { color: accent }]}>{filtered.length} horaire{filtered.length > 1 ? 's' : ''}</Text></View>

                  </View>

                  <View style={s.filters}>

                    <StationSelector title="Gare de départ" icon="location-outline" items={departureStations} selected={departureId} onSelect={value => { setDepartureId(value); setArrivalId('all'); setHourId(''); }} color={accent}/>

                    {arrivalStations.length > 0 && <StationSelector title="Gare d’arrivée" icon="flag-outline" items={arrivalStations} selected={arrivalId} onSelect={value => { setArrivalId(value); setHourId(''); }} color={accent}/>}

                  </View>

                  {!!hourId && (

                    <View style={s.timeFilterNotice}>

                      <Ionicons name="time-outline" color={accent} size={17} />

                      <Text style={s.timeFilterText}>Horaire choisi{requestedHour ? ` : ${requestedHour}` : ''}</Text>

                      <Pressable accessibilityRole="button" onPress={() => setHourId('')}>

                        <Text style={[s.clearTimeText, { color: accent }]}>Tous les horaires</Text>

                      </Pressable>

                    </View>

                  )}

                  {filtered.length === 0 && <Text style={s.noMatch}>Aucun départ pour cette combinaison gare / horaire. Modifiez les filtres.</Text>}

                  {filtered.map((trip, index) => <AnimatedTrip

                    key={trip.key} trip={trip} index={index} reducedMotion={reducedMotion} color={accent}

                    blocked={expired || !estDepartFutur(travelDate.iso || '', trip.time) || company?.is_active !== true || company?.is_verified !== true || trip.price === null || trip.price <= 0}

                    onBook={() => onBook(trip)} />)}

                </>

              ) : (

                <PremiumReveal reducedMotion={reducedMotion} index={1}>
                  <View style={s.emptyCard}>
                    <View style={s.emptyTop}>
                      <View style={s.emptyIcon}>
                        <MaterialCommunityIcons name="bus-clock" color={accent} size={23} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.emptyTitle}>Aucun départ confirmé pour cette date</Text>
                        <Text style={s.emptyDescription}>
                          {programmesTrajet.length > 0
                            ? `${company?.name || companyParamName || 'La compagnie'} publie bien des horaires ${origin} → ${destination}, mais aucun bus affecté n’est confirmé pour le ${travelDate.text}.`
                            : `Aucun bus affecté n’est confirmé pour ${origin} → ${destination} le ${travelDate.text}.`}
                        </Text>
                      </View>
                    </View>

                    {/* MESSAY_G6_CALENDRIER_MOTION : horaires publiés, jamais réservables */}
                    {!expired &&
                      company?.is_active === true &&
                      company?.is_verified === true &&
                      programmesTrajet.length > 0 && (
                        <PublishedScheduleCalendar
                          selectedDate={travelDate.iso || ''}
                          onSelectDate={openNextDate}
                          horaires={programmesTrajet.flatMap(ligne =>
                            ligne.horaires.flatMap(horaire => {
                              const heure = hoursOnly(horaire.heureDepart);
                              return heure && estDepartFutur(travelDate.iso || '', heure)
                                ? [{
                                    id: `${ligne.destinationId}-${horaire.horaireId}`,
                                    heure,
                                    destination: ligne.villeArrivee,
                                    prix: ligne.prix,
                                  }]
                                : [];
                            })
                          )}
                        />
                      )}
                    <View style={s.emptyHintRow}>
                      <Ionicons name="shield-checkmark-outline" color="#986025" size={16} />
                      <Text style={s.emptyHint}>
                        {expired ? 'Cette date est passée. Sélectionnez une nouvelle date.'
                          : 'Un horaire habituel ne garantit ni bus ni place disponible.'}
                      </Text>
                    </View>
                    {/* Un horaire publié ne donne pas accès à un siège : chercher
                        d'autres dates confirmées ou revenir au formulaire. */}
                    <Pressable
                      accessibilityRole="button"
                      disabled={nextDatesLoading}
                      onPress={() => void searchNextDates()}
                      style={[s.emptyAction, { backgroundColor: accent }, nextDatesLoading && { opacity: 0.7 }]}
                    >
                      {nextDatesLoading
                        ? <ActivityIndicator color="#FFFFFF" size="small" />
                        : <Ionicons name="calendar-outline" color="#FFFFFF" size={18} />}
                      <Text style={s.emptyActionText}>
                        {nextDatesLoading ? 'Recherche en cours…' : 'Voir les prochains départs confirmés'}
                      </Text>
                    </Pressable>
                    {nextDatesChecked && nextDates.length === 0 && !nextDatesError && (
                      <Text style={s.nextDatesInfo}>
                        Aucun bus confirmé sur cette liaison dans les 7 prochains jours.
                        Les horaires restent consultables ci-dessous.
                      </Text>
                    )}
                    {!!nextDatesError && <Text style={s.nextDatesInfo}>{nextDatesError}</Text>}
                    {nextDates.length > 0 && (
                      <View style={s.nextDateList}>
                        <Text style={s.nextDatesTitle}>Départs confirmés à d’autres dates</Text>
                        {nextDates.map(date => (
                          <Pressable
                            key={date}
                            accessibilityRole="button"
                            onPress={() => openNextDate(date)}
                            style={s.nextDateOption}
                          >
                            <Text style={s.nextDateText}>{dateDetails(date).text}</Text>
                            <Ionicons name="arrow-forward" color={accent} size={18} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/buy-ticket')}
                      style={s.editSearchButton}
                    >
                      <Text style={[s.editSearchText, { color: accent }]}>Modifier le trajet ou la date</Text>
                    </Pressable>
                  </View>
                </PremiumReveal>

              )}

              {trips.length === 0 && (
                <View style={s.programmesSection}>
                  <Text style={s.eyebrow}>HORAIRES PUBLIÉS · {company?.name || companyParamName}</Text>
                  <Text style={s.sectionTitle}>Horaires de la compagnie</Text>
                  <Text style={s.sectionSubtitle}>
                    Consultez les trajets et horaires habituels. Pour le {travelDate.text},
                    aucun billet n'est proposé sans départ confirmé.
                  </Text>

                  {programmesError ? (
                    <View style={s.altEmpty}>
                      <Ionicons name="cloud-offline-outline" color="#C2410C" size={20} />
                      <Text style={s.altEmptyText}>{programmesError}</Text>
                    </View>
                  ) : programmesTrajet.length === 0 && programmesAutres.length === 0 ? (
                    <View style={s.altEmpty}>
                      <Text style={s.altEmptyText}>Aucun programme publié pour ce départ.</Text>
                    </View>
                  ) : (
                    <>
                      {programmesTrajet.length === 0 && (
                        <Text style={s.sectionSubtitle}>
                          Aucun horaire indicatif pour {origin} → {destination}.
                          Voici d'autres lignes publiées depuis {origin}.
                        </Text>
                      )}
                      {programmesTrajet.map((ligne, index) => (
                        <ProgrammeCard key={ligne.destinationId} ligne={ligne} index={index + 1}
                          reducedMotion={reducedMotion} accent={accent} />
                      ))}
                      {programmesAutres.length > 0 && (
                        <>
                          <Text style={[s.otherTitle, { marginTop: 20 }]}>Autres lignes de {company?.name || companyParamName}</Text>
                          {programmesAutresVisibles.map((ligne, index) => (
                            <ProgrammeCard key={ligne.destinationId} ligne={ligne} index={index + 1}
                              reducedMotion={reducedMotion} accent={accent} />
                          ))}
                          {programmesAutres.length > 3 && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={showAllProgrammes ? 'Réduire les autres lignes' : 'Afficher toutes les lignes'}
                              accessibilityState={{ expanded: showAllProgrammes }}
                              onPress={() => setShowAllProgrammes(value => !value)}
                              style={s.programmeMoreButton}
                            >
                              <Text style={[s.clearTimeText, { color: accent }]}>
                                {showAllProgrammes ? 'Voir moins' : `Voir toutes les lignes (${programmesAutres.length})`}
                              </Text>
                              <Ionicons name={showAllProgrammes ? 'chevron-up' : 'chevron-down'} size={16} color={accent} />
                            </Pressable>
                          )}
                        </>
                      )}
                    </>
                  )}
                </View>
              )}

              {trips.length === 0 && nearbyStations.length > 0 && (

                <View style={s.otherLocations}>

                  <Text style={s.otherTitle}>Autres villes avec une gare de {company?.name || companyParamName}</Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nearbyRow}>

                    {nearbyStations.map(station => <View key={station.id} style={s.nearbyChip}><Ionicons name="location-outline" size={15} color={accent}/><View style={{ flex: 1 }}><Text style={s.nearbyCity}>{station.ville}</Text><Text numberOfLines={1} style={s.nearbyStation}>{station.nom}</Text></View></View>)}

                  </ScrollView>

                </View>

              )}

              {(trips.length === 0 || alternatives.length > 0 || !!alternativesError) && (

                <View style={s.alternativeSection}>

                  <Text style={s.eyebrow}>COMPARER LES TRANSPORTEURS</Text>

                  <Text style={s.sectionTitle}>Autres compagnies pour cette destination</Text>

                  <Text style={s.sectionSubtitle}>

                    Jusqu’à quatre compagnies réelles du répertoire MESSAY : une ligne publiée ne garantit pas un bus affecté.

                    Les horaires et les places dépendent de la date sélectionnée.

                  </Text>

                  {alternativesError && alternatives.length === 0 ? (

                    <View style={s.altEmpty}>

                      <Ionicons name="cloud-offline-outline" size={20} color="#C2410C"/>

                      <Text style={s.altEmptyText}>{alternativesError}</Text>

                    </View>

                  ) : alternatives.length === 0 ? (

                    <View style={s.altEmpty}>

                      <Text style={s.altEmptyText}>Aucune autre compagnie visible dans le répertoire pour le moment.</Text>

                    </View>

                  ) : alternatives.map((item, index) => (

                    <AnimatedAlternativeCard

                      key={String(item.company.id)} item={item} index={index}

                      reducedMotion={reducedMotion} accent={accent}

                      onPress={() => onAlternative(item)}

                    />

                  ))}

                </View>

              )}

            </>

          )}

        </ScrollView>

      )}



    </View>

  );

}

const s = StyleSheet.create({
  programmesSection: { marginTop: 26 },
  programmeCard: { marginTop: 14, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: '#E7ECF2', shadowColor: '#1B2B49',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.055, shadowRadius: 22, elevation: 2 },
  programmeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  programmeHeadCopy: { flex: 1, minWidth: 0 },
  programmeRouteIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: 11, backgroundColor: '#FFF3EC' },
  programmeTag: { borderRadius: 7, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 5 },
  programmeTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, color: '#617187' },
  programmeTrajet: { color: INK, fontSize: 15, lineHeight: 21, fontWeight: '900' },
  programmeGare: { color: '#75849A', fontSize: 11, marginTop: 5, lineHeight: 16 },
  programmeDivider: { height: 1, backgroundColor: '#EEF2F7', marginTop: 16, marginBottom: 15 },
  programmePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  programmePriceLabel: { color: '#94A3B8', letterSpacing: 1, fontWeight: '800', fontSize: 9 },
  programmeTarif: { color: INK, fontSize: 19, fontWeight: '900', marginTop: 3 },
  programmeDuration: { flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F7FA', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11 },
  programmeDurationText: { fontSize: 11, color: '#475569', fontWeight: '800' },
  programmeHoursLabel: { marginTop: 18, fontWeight: '900', fontSize: 9,
    color: '#8794A6', letterSpacing: 1.1 },
  programmeHoraires: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  programmeHeurePill: { backgroundColor: '#FFF4EE', borderRadius: 11, borderWidth: 1,
    borderColor: '#FCE8DC', paddingHorizontal: 11, paddingVertical: 9 },
  programmeHeure: { color: '#A94C26', fontSize: 12, fontWeight: '900' },
  programmeFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 11, backgroundColor: '#FFFAF2', borderRadius: 12, marginTop: 15 },
  programmeAvertissement: { flex: 1, color: '#926237', fontSize: 10, lineHeight: 16 },
  programmeMoreButton: { paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'center',
    backgroundColor: '#FFF4ED', borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', gap: 7, marginTop: 16 },


  timeFilterNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, padding: 11, borderRadius: 13, backgroundColor: '#FFF7ED' },

  timeFilterText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#6B7280' },

  clearTimeText: { fontWeight: '900', fontSize: 11 },

  root: { flex: 1, backgroundColor: '#F7F8FB' },

  hero: { borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 22, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100,
    right: -65, top: -80, backgroundColor: 'rgba(255,255,255,0.07)' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 7 },

  circleButton: { width: 43, height: 43, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', borderColor: 'rgba(255,255,255,0.17)', borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)' },

  headerTitleBox: { flex: 1, alignItems: 'center' },

  overline: { color: 'rgba(255,255,255,0.78)', letterSpacing: 2.0, fontSize: 9, fontWeight: '900' },

  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 4 },

  routeHeader: { marginTop: 21, marginHorizontal: 22 },
  routeCaption: { color: 'rgba(255,255,255,0.65)', fontSize: 9,
    fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
  routeSide: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 46 },
  routeCityLabel: { marginTop: 5, color: 'rgba(255,255,255,0.69)', fontSize: 9,
    letterSpacing: 1, fontWeight: '800' },

  routeNames: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },

  routeCity: { fontSize: 22, lineHeight: 25, fontWeight: '900', color: '#FFFFFF' },
  // Route compacte à largeur réelle, compatible iPhone SE / grands textes.
  premiumOriginRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 29 },
  premiumRouteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FDBA74' },
  premiumRouteOverline: { color: 'rgba(255,255,255,0.69)', fontSize: 10,
    fontWeight: '900', letterSpacing: 1.1 },
  premiumOriginCity: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 19 },
  premiumArrivalRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  premiumDestinationBox: { flex: 1, minWidth: 0 },
  premiumDestinationCity: { color: '#FFFFFF', fontSize: 31, lineHeight: 39, fontWeight: '900',
    letterSpacing: -0.8 },

  routeArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center',
    justifyContent: 'center', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.14)' },

  heroMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 18,
    borderColor: 'rgba(255,255,255,0.16)', borderWidth: 1,
    backgroundColor: 'rgba(20,24,40,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },

  heroMetaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  heroDivider: { height: 14, width: 1, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 3 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  loaderText: { color: MUTED, fontSize: 13 },

  scrollContent: { paddingHorizontal: 18, paddingTop: 19, paddingBottom: 80, flexGrow: 1 },

  notice: { flexDirection: 'row', gap: 11, alignItems: 'flex-start',
    backgroundColor: '#FFF9F2', borderColor: '#F4E5D7', borderWidth: 1,
    borderRadius: 18, padding: 14, marginBottom: 20 },
  noticeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#FCEBDA' },
  noticeTitle: { color: '#8B4928', fontSize: 12, fontWeight: '900', marginBottom: 4 },

  noticeText: { color: '#9B694E', fontSize: 11, fontWeight: '600', lineHeight: 17 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },

  eyebrow: { color: '#D85B30', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 },

  sectionTitle: { color: INK, fontSize: 22, lineHeight: 28, fontWeight: '900' },

  sectionSubtitle: { color: MUTED, marginTop: 8, fontSize: 12, lineHeight: 19 },

  countPill: { borderRadius: 30, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF2E7' },

  countText: { fontSize: 11, fontWeight: '800' },

  filters: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#ECF0F6', padding: 14, marginBottom: 17 },

  stationField: { marginBottom: 9 },

  stationLabel: { fontSize: 12, fontWeight: '800', color: '#344054', marginBottom: 8 },

  stationButton: { minHeight: 49, borderWidth: 1.5, borderColor: '#E8EDF3', borderRadius: 13, backgroundColor: '#FAFBFD', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },

  stationValue: { color: INK, fontWeight: '700', fontSize: 12, flex: 1 },

  stationOptions: { marginTop: 5, borderRadius: 12, borderColor: '#E8EDF3', borderWidth: 1, overflow: 'hidden' },

  stationOption: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F4F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  stationOptionCopy: { flex: 1 },

  optionName: { color: INK, fontSize: 12, fontWeight: '800' },

  optionInfo: { marginTop: 4, color: MUTED, fontSize: 10 },

  noMatch: { textAlign: 'center', color: MUTED, marginBottom: 15 },

  tripCard: { padding: 15, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF1F6', marginBottom: 13, shadowColor: '#101828', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.055, shadowRadius: 12, elevation: 2 },

  tripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F5F7', paddingBottom: 12, gap: 8 },

  companyIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },

  logoWrap: { height: 44, width: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderColor: '#EEF1F6', borderWidth: 1, justifyContent: 'center', alignItems: 'center', padding: 5 },

  logo: { height: 34, width: 34 },

  companyName: { color: INK, fontWeight: '900', fontSize: 13 },

  companySubtitle: { color: MUTED, fontSize: 10, marginTop: 3 },

  timeBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },

  timeBadgeText: { fontSize: 12, fontWeight: '900' },

  journey: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 22 },

  journeyStop: { flex: 1, minWidth: 0 },

  journeyTime: { color: INK, fontSize: 19, fontWeight: '900' },

  journeyStation: { marginTop: 6, color: '#334155', fontSize: 11, lineHeight: 15, fontWeight: '700' },

  journeyCity: { color: MUTED, fontSize: 10, marginTop: 3 },

  journeyMiddle: { width: 90, flexDirection: 'row', alignItems: 'center', marginHorizontal: 7, marginTop: 6 },

  journeyLine: { height: 1.5, backgroundColor: '#DBE2EA', flex: 1 },

  journeyBus: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  durationText: { position: 'absolute', top: 29, left: 0, right: 0, color: MUTED, textAlign: 'center', fontSize: 10 },

  tripFooter: { borderTopWidth: 1, borderTopColor: '#F3F5F7', paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },

  priceLabel: { color: MUTED, fontSize: 10 },

  price: { fontSize: 17, fontWeight: '900', marginTop: 1 },

  seatsText: { fontSize: 9, color: MUTED, marginTop: 4 },

  reserveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 11, paddingHorizontal: 14, gap: 8, minWidth: 116 },

  reserveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  emptyCard: { padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E7ECF2', shadowColor: '#172341',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.035, shadowRadius: 14, elevation: 1 },
  emptyTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emptyIcon: { height: 45, width: 45, borderRadius: 15, backgroundColor: '#FFF1E8',
    alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: INK, fontWeight: '900', fontSize: 14, lineHeight: 19 },
  emptyDescription: { fontSize: 11, color: MUTED, lineHeight: 17, marginTop: 7 },
  emptyHintRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 15,
    borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#FFFAF1' },
  emptyHint: { flex: 1, fontSize: 10, color: '#97632D', lineHeight: 15 },
  emptyAction: { marginTop: 17, minHeight: 48, borderRadius: 13, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  nextDatesInfo: { marginTop: 12, fontSize: 11, lineHeight: 18, color: '#64748B' },
  nextDateList: { marginTop: 14, gap: 8 },
  nextDatesTitle: { color: INK, fontSize: 12, fontWeight: '900', marginBottom: 3 },
  nextDateOption: { borderColor: '#E8EDF3', borderWidth: 1, padding: 12, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFBFD' },
  nextDateText: { fontSize: 13, color: INK, fontWeight: '800' },
  editSearchButton: { marginTop: 12, alignItems: 'center', padding: 10 },
  editSearchText: { fontWeight: '900', fontSize: 12 },


  otherLocations: { marginTop: 22 },

  otherTitle: { color: INK, fontWeight: '900', fontSize: 14, marginBottom: 12 },

  nearbyRow: { gap: 9, paddingRight: 15 },

  nearbyChip: { width: 165, borderRadius: 17, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E7ECF2', padding: 14, flexDirection: 'row', gap: 9, alignItems: 'center' },

  nearbyCity: { color: INK, fontWeight: '800', fontSize: 12 },

  nearbyStation: { color: MUTED, fontSize: 10, marginTop: 2 },

  alternativeSection: { marginTop: 27 },

  altEmpty: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 15, marginTop: 13 },

  altEmptyText: { color: MUTED, fontSize: 12, textAlign: 'center' },

  alternative: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#E7ECF2', overflow: 'hidden', shadowColor: '#1B2B49',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 14, elevation: 1 },

  altPressable: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },

  altCertainty: { marginTop: 4, fontSize: 10, fontWeight: '800' },

  altRight: { maxWidth: 105, alignItems: 'flex-end', gap: 4 },

  altForwardLabel: { fontSize: 10, fontWeight: '900', textAlign: 'right' },

  altLogo: { width: 42, height: 42, borderWidth: 1, borderColor: '#EEF1F6', borderRadius: 14, padding: 4, justifyContent: 'center', alignItems: 'center' },

  altCopy: { flex: 1 },

  altName: { color: INK, fontWeight: '900', fontSize: 12 },

  altSub: { color: MUTED, fontSize: 10, marginTop: 3 },

  altPrice: { fontWeight: '900', fontSize: 10, marginBottom: 5 },

  errorCard: { backgroundColor: '#FFFFFF', borderRadius: 18, alignItems: 'center', padding: 25, gap: 9 },

  errorTitle: { fontSize: 17, fontWeight: '900', color: INK },

  errorDescription: { textAlign: 'center', fontSize: 12, color: MUTED, lineHeight: 19 },

  retry: { borderRadius: 12, marginTop: 12, paddingVertical: 11, paddingHorizontal: 25 },

  retryText: { color: '#FFFFFF', fontWeight: '900' },


});
