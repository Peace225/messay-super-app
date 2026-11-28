/**
 * MESSAY — Informations passager (production, billetterie interurbaine).
 * Passe les identifiants de ligne, départ programmé et gares au checkout.
 * Ce composant N'ENCAISSE PAS : le backend doit recalculer tarif/disponibilité,
 * vérifier le paiement prestataire, puis seulement émettre le billet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {

  AccessibilityInfo,

  Alert,

  Animated,

  Easing,

  KeyboardAvoidingView,

  Platform,

  Pressable,

  ScrollView,

  StatusBar,

  StyleSheet,

  Text,

  TextInput,

  View,

  type KeyboardTypeOptions,

  type TextInputProps,

} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

const ORANGE = '#F97316';

const INK = '#17243E';

const MUTED = '#718096';

const BACKGROUND = '#F5F7FB';

function read(value: string | string[] | undefined): string {

  return (Array.isArray(value) ? value[0] : value ?? '').trim();

}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

const validIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
};

function safeColor(value: string): string {

  return /^#[\da-f]{6}$/i.test(value) ? value : ORANGE;

}

// L'API fournit normalement un entier XOF. On accepte également « 12 500 » et « 12.500,00 ».

function parseFcfa(value: string): number | null {

  // Prix seulement indicatif, issu du catalogue. Le backend devra recalculer

  // le tarif depuis la ligne liée au départ, jamais depuis ce paramètre URL.

  const cleaned = value.trim().replace(/(?:FCFA|F\s*CFA|XOF)/gi, '')

    .replace(/[\s\u00a0\u202f]/g, '');

  if (!cleaned) return null;

  let numeric = cleaned;

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) {

    numeric = cleaned.replace(/\./g, '').replace(',', '.');

  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(cleaned)) {

    numeric = cleaned.replace(/,/g, '');

  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) {

    numeric = cleaned.replace(',', '.');

  } else {

    return null;

  }

  const amount = Number(numeric);

  // XOF est une monnaie sans décimales : refuser les fractions et les valeurs hors bornes.
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;

}

const money = (amount: number | null): string =>

  amount === null ? 'À confirmer' : `${amount.toLocaleString('fr-FR')} FCFA`;

function validPhone(value: string): boolean {

  const trimmed = value.trim();

  const digits = trimmed.replace(/\D/g, '');

  // Côte d'Ivoire : 10 chiffres locaux ; autres numéros avec indicatif international.

  if (trimmed.startsWith('+')) return /^\+[\d\s().-]+$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;

  return digits.length === 10 && /^[\d\s().-]+$/.test(trimmed);

}

function validEmail(value: string): boolean {

  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

}

type FieldProps = {

  icon: React.ComponentProps<typeof Ionicons>['name'];

  label: string;

  placeholder: string;

  value: string;

  onChangeText: (value: string) => void;

  color: string;

  valid?: boolean;

  required?: boolean;

  keyboardType?: KeyboardTypeOptions;

  autoCapitalize?: TextInputProps['autoCapitalize'];

  autoComplete?: TextInputProps['autoComplete'];

  maxLength?: number;

  hint?: string;

};

function ElegantField({

  icon, label, placeholder, value, onChangeText, color, valid = false,

  required = false, keyboardType = 'default', autoCapitalize = 'sentences',

  autoComplete, maxLength, hint,

}: FieldProps) {

  const [focused, setFocused] = useState(false);

  return (

    <View style={styles.fieldGroup}>

      <View style={styles.fieldTitleRow}>

        <Text style={styles.fieldTitle}>{label}{required ? <Text style={{ color }}> \*</Text> : null}</Text>

        {valid && value.trim().length > 0 ? (

          <View style={styles.validBadge}>

            <Ionicons name="checkmark-circle" size={14} color="#059669" />

            <Text style={styles.validText}>Valide</Text>

          </View>

        ) : null}

      </View>

      <View style={[

        styles.fieldBox,

        focused && { borderColor: color, backgroundColor: '#FFFFFF', shadowOpacity: 0.09 },

        valid && !focused && { borderColor: '#B7E4D3' },

      ]}>

        <View style={[styles.fieldIcon, focused && { backgroundColor: `${color}12` }]}>

          <Ionicons name={icon} size={19} color={focused ? color : '#8492A8'} />

        </View>

        <TextInput

          style={styles.fieldInput}

          value={value}

          onChangeText={onChangeText}

          placeholder={placeholder}

          placeholderTextColor="#9AA5B5"

          onFocus={() => setFocused(true)}

          onBlur={() => setFocused(false)}

          keyboardType={keyboardType}

          autoCapitalize={autoCapitalize}

          autoComplete={autoComplete}

          maxLength={maxLength}

          autoCorrect={false}

          returnKeyType="done"

          accessibilityLabel={label}

        />

        {valid && value.trim().length > 0 ? <Ionicons name="checkmark-circle" size={20} color="#10B981" /> : null}

      </View>

      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}

    </View>

  );

}

function Step({ number, title, state, accent }: {

  number: number;

  title: string;

  state: 'done' | 'active' | 'future';

  accent: string;

}) {

  const done = state === 'done';

  const active = state === 'active';

  return (

    <View style={styles.step}>

      <View style={[

        styles.stepCircle,

        done && styles.stepDone,

        active && { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },

      ]}>

        {done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : (

          <Text style={[styles.stepNumber, active && { color: accent }]}>{number}</Text>

        )}

      </View>

      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{title}</Text>

    </View>

  );

}

export default function PassengerInfo() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{

    depart?: string; destination?: string;

    date?: string; dateIso?: string;

    heure?: string; heureDepart?: string; heure_arrivee?: string;

    duree?: string; prix?: string; prixIndicatif?: string; total?: string;

    company?: string; color?: string;

    companyId?: string; destinationId?: string; horaireId?: string;

    affectationId?: string;

    gare?: string; gareId?: string;

    gare_depart?: string; gare_depart_nom?: string; gare_depart_id?: string;

    gare_arrivee?: string; gare_arrivee_nom?: string; gare_arrivee_id?: string;

    gare_arrivee_liee?: string;

    tier?: string;

  }>();

  const depart = read(params.depart);

  const destination = read(params.destination);

  const date = read(params.date);

  const dateIso = read(params.dateIso);

  // Compatibilité avec les deux contrats de navigation du mobile.

  const heure = read(params.heure) || read(params.heureDepart);

  const heureArrivee = read(params.heure_arrivee);

  const duree = read(params.duree);

  const company = read(params.company);

  const companyId = read(params.companyId);

  const destinationId = read(params.destinationId);

  const horaireId = read(params.horaireId);

  const affectationId = read(params.affectationId);

  const gareDepart = read(params.gare_depart) || read(params.gare_depart_nom) || read(params.gare);

  const gareDepartId = read(params.gare_depart_id) || read(params.gareId);

  const gareArrivee = read(params.gare_arrivee) || read(params.gare_arrivee_nom);

  const gareArriveeId = read(params.gare_arrivee_id);

  // Un drapeau client seul ne prouve rien : le checkout doit revérifier la gare auprès du backend.
  // Mais si la recherche indique explicitement une gare NON liée, arrêter le parcours.
  const arrivalIsLinked = isUuid(gareArriveeId) &&
    read(params.gare_arrivee_liee) !== 'false';

  const companyColor = safeColor(read(params.color));

  const isThirdParty = read(params.tier) === 'true';

  const [nom, setNom] = useState('');

  const [phone, setPhone] = useState('');

  const [email, setEmail] = useState('');

  const [piece, setPiece] = useState('');

  const [reducedMotion, setReducedMotion] = useState(false);

  // Une fiche passager = un billet. Aucun numéro de siège n'est sélectionné

  // côté client : la compagnie attribuera le siège après paiement confirmé.

  const quantity = 1;

  const unitPrice = useMemo(

    () => parseFcfa(read(params.prix) || read(params.prixIndicatif)),

    [params.prix, params.prixIndicatif],

  );

  const totalPrice = unitPrice;

  // Date opérationnelle transmise par la recherche (iso) ou ancien format FR.

  const departureDateIso = useMemo(() => {

    if (validIsoDate(dateIso)) return dateIso;

    const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);

    if (french) {
      const iso = `${french[3]}-${french[2]}-${french[1]}`;
      return validIsoDate(iso) ? iso : '';
    }

    return validIsoDate(date) ? date : '';

  }, [dateIso, date]);

  const validName = nom.trim().replace(/\s+/g, ' ').length >= 3;

  const phoneOk = validPhone(phone);

  const emailOk = validEmail(email);

  const formValid = validName && phoneOk && emailOk;

  const missingPassengerFields = [

    !validName && 'nom complet (3 caractères minimum)',

    !phoneOk && 'téléphone valide (10 chiffres CI ou +indicatif)',

    !emailOk && 'adresse e-mail valide',

  ].filter((value): value is string => typeof value === 'string');

  // Ne jamais confondre un simple horaire publié et un départ daté

  // disposant d'un bus affecté. Le contrôle définitif appartient au serveur.

  const missingTripFields: string[] = [
    !isUuid(affectationId) && 'identifiant du départ programmé',
    !isUuid(companyId) && 'identifiant de la compagnie',
    !isUuid(destinationId) && 'identifiant de la ligne',
    !isUuid(horaireId) && 'identifiant de l’horaire',
    !isUuid(gareDepartId) && 'identifiant de la gare de départ',
    !gareDepart && 'nom de la gare de départ',
    !isUuid(gareArriveeId) && 'identifiant de la gare d’arrivée',
    !gareArrivee && 'nom de la gare d’arrivée',
    Boolean(gareArriveeId && !arrivalIsLinked) && 'liaison de la gare d’arrivée avec la ligne',
    gareDepartId === gareArriveeId && 'gares de départ et d’arrivée distinctes',
    !depart && 'ville de départ',
    !destination && 'ville d’arrivée',
    !departureDateIso && 'date de départ valide',
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure) && 'heure de départ',
    (totalPrice === null || totalPrice <= 0) && 'tarif',
  ].filter((part): part is string => typeof part === 'string');

  // Contrôle de cohérence de l'écran UNIQUEMENT.
  // Le backend doit valider le voyage, les gares, le stock et le tarif avant paiement.

  const confirmedItinerary = missingTripFields.length === 0;

  const headerAnim = useRef(new Animated.Value(0)).current;

  const cardAnim = useRef(new Animated.Value(0)).current;

  const formAnim = useRef(new Animated.Value(0)).current;

  const footerAnim = useRef(new Animated.Value(0)).current;

  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {

      if (!active) return;

      setReducedMotion(reduce);

      if (reduce) {

        [headerAnim, cardAnim, formAnim, footerAnim].forEach(value => value.setValue(1));

        return;

      }

      Animated.stagger(100, [headerAnim, cardAnim, formAnim, footerAnim].map(value =>

        Animated.timing(value, {

          toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true,

        })

      )).start();

    }).catch(() => {

      [headerAnim, cardAnim, formAnim, footerAnim].forEach(value => value.setValue(1));

    });

    return () => { active = false; };

  }, [headerAnim, cardAnim, formAnim, footerAnim]);

  const reveal = (value: Animated.Value, offset = 16) => ({

    opacity: value,

    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],

  });

  const validate = (): boolean => {

    if (!validName) {

      Alert.alert('Nom incomplet', 'Renseignez votre nom complet (3 caractères minimum).');

      return false;

    }

    if (!phoneOk) {

      Alert.alert('Téléphone invalide', 'En Côte d’Ivoire, saisissez 10 chiffres (ex. 07 08 12 34 56), ou un numéro international avec indicatif.');

      return false;

    }

    if (!emailOk) {

      Alert.alert('Email invalide', 'Vérifiez votre adresse email, ou laissez le champ vide.');

      return false;

    }

    return true;

  };

  const onNext = () => {

    if (!validate()) return;

    if (!confirmedItinerary) {

      Alert.alert(

        'Voyage incomplet',

        `Informations du départ manquantes : ${missingTripFields.join(', ')}. ` +

        'Revenez à la recherche pour sélectionner un départ réellement programmé.',

      );

      return;

    }

    // Ne pas considérer ces paramètres client comme autorisation de paiement.

    // Le backend doit vérifier horaireId, destinationId, companyId, gare(s), tarif,

    // disponibilités, date de circulation et validation ADMIN avant toute transaction.

    router.push({

      pathname: '/checkout',

      params: {

        affectationId, depart, destination, date, dateIso: departureDateIso,

        heure, heureDepart: heure, heure_arrivee: heureArrivee, duree,

        prix: unitPrice === null ? '' : String(unitPrice),

        prixIndicatif: unitPrice === null ? '' : String(unitPrice),

        company, color: companyColor, companyId, destinationId, horaireId,

        gare: gareDepart, gareId: gareDepartId,

        gare_depart: gareDepart, gare_depart_nom: gareDepart, gare_depart_id: gareDepartId,

        gare_arrivee: gareArrivee, gare_arrivee_nom: gareArrivee, gare_arrivee_id: gareArriveeId,

        gare_arrivee_liee: arrivalIsLinked ? 'true' : 'false',

        seats: String(quantity),

        total: totalPrice === null ? '' : String(totalPrice),

        nom: nom.trim().replace(/\s+/g, ' '), phone: phone.trim(),

        email: email.trim().toLowerCase(), piece: piece.trim().toUpperCase(),

        siege_auto: 'true',

        ...(isThirdParty ? { tier: 'true' } : {}),

      },

    });

  };

  const onPressIn = () => {

    if (!reducedMotion) Animated.spring(buttonScale, { toValue: 0.98, friction: 7, useNativeDriver: true }).start();

  };

  const onPressOut = () => {

    if (!reducedMotion) Animated.spring(buttonScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();

  };

  return (

    <View style={styles.root}>

      <StatusBar barStyle="light-content" />

      <Animated.View style={reveal(headerAnim, -14)}>

        <LinearGradient

          colors={['#111D36', companyColor, '#EA580C']}

          locations={[0, 0.65, 1]}

          style={styles.hero}

        >

          <SafeAreaView edges={['top']}>

            <View style={styles.topRow}>

              <Pressable

                onPress={() => router.canGoBack() ? router.back() : router.replace('/buy-ticket')}

                accessibilityLabel="Retour aux résultats"

                style={styles.backButton}

              >

                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />

              </Pressable>

              <View style={styles.topCopy}>

                <Text style={styles.eyebrow}>MESSAY · BILLETTERIE</Text>

                <Text style={styles.topTitle}>Informations passager</Text>

              </View>

              <View style={styles.topIcon}>

                <Ionicons name="person-outline" size={21} color="#FFFFFF" />

              </View>

            </View>

            <View style={styles.heroCopy}>

              <Text style={styles.heroLead}>Un voyage, en toute sérénité.</Text>

              <Text style={styles.heroSub}>Complétez vos coordonnées pour préparer votre billet.</Text>

            </View>

            <View style={styles.progressRow}>

              <Step number={1} title="Trajet" state="done" accent={companyColor} />

              <View style={styles.progressLine} />

              <Step number={2} title="Passager" state="active" accent={companyColor} />

              <View style={styles.progressLine} />

              <Step number={3} title="Paiement" state="future" accent={companyColor} />

            </View>

          </SafeAreaView>

        </LinearGradient>

      </Animated.View>

      <KeyboardAvoidingView

        style={styles.keyboardArea}

        behavior={Platform.OS === 'ios' ? 'padding' : undefined}

        keyboardVerticalOffset={0}

      >

        <ScrollView

          contentContainerStyle={styles.content}

          keyboardShouldPersistTaps="handled"

          keyboardDismissMode="on-drag"

          showsVerticalScrollIndicator={false}

        >

          <Animated.View style={[styles.summaryCard, reveal(cardAnim, 20)]}>

            <View style={styles.summaryTop}>

              <View style={[styles.summarySmallIcon, { backgroundColor: `${companyColor}12` }]}>

                <Ionicons name="bus" size={22} color={companyColor} />

              </View>

              <View style={styles.summaryMain}>

                <Text style={styles.summaryOverline}>VOTRE VOYAGE</Text>

                <Text style={styles.summaryCompany}>{company || 'Compagnie à confirmer'}</Text>

              </View>

              <View style={styles.summaryBadge}>

                <Ionicons name="ticket-outline" size={14} color="#C2410C" />

                <Text style={styles.summaryBadgeText}>Récapitulatif</Text>

              </View>

            </View>

            <View style={styles.tripRow}>

              <View style={[styles.tripCity, styles.tripCityDeparture]}>

                <Text style={styles.cityLabel}>DÉPART</Text>

                <Text style={styles.cityName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{depart || 'À préciser'}</Text>

                <Text style={styles.stationLabel} numberOfLines={2}>{gareDepart || 'Gare de départ manquante'}</Text>

                <Text style={styles.tripHour}>{heure || '--:--'}</Text>

              </View>

              <View style={styles.tripMiddle}>

                <View style={styles.routeLine} />

                <View style={[styles.routeIcon, { backgroundColor: companyColor }]}>

                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />

                </View>

                <View style={styles.routeLine} />

              </View>

              <View style={[styles.tripCity, styles.tripCityArrival]}>

                <Text style={styles.cityLabel}>ARRIVÉE</Text>

                <Text style={[styles.cityName, styles.cityNameArrival]}

                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>

                  {destination || 'À préciser'}

                </Text>

                <Text style={[styles.stationLabel, { textAlign: 'right' }]} numberOfLines={2}>

                  {gareArrivee || 'Gare d’arrivée manquante'}

                </Text>

                {!!gareArrivee && !arrivalIsLinked && (

                  <Text style={styles.arrivalUnverified} numberOfLines={2}>

                    Gare choisie · à confirmer par la compagnie

                  </Text>

                )}

                <Text style={styles.tripHour}>{heureArrivee || '--:--'}</Text>

              </View>

            </View>

            <View style={styles.metaRow}>

              <Ionicons name="calendar-outline" size={15} color={companyColor} />

              <Text style={styles.metaText}>{date || 'Date à confirmer'}</Text>

              <View style={styles.metaDot} />

              <Ionicons name="time-outline" size={15} color={companyColor} />

              <Text style={styles.metaText}>{duree || 'Durée à confirmer'}</Text>

            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.totalRow}>

              <View style={{ flex: 1 }}>

                <Text style={styles.seatText}>

                  1 place · Siège attribué par la compagnie après paiement

                </Text>

                <Text style={styles.priceNote}>Montant indicatif · vérifié avant paiement</Text>

              </View>

              <Text style={[styles.summaryTotal, { color: companyColor }]}>{money(totalPrice)}</Text>

            </View>

          </Animated.View>

          <Animated.View style={reveal(formAnim, 18)}>

            <View style={styles.formHeading}>

              <View style={[styles.formHeadingIcon, { backgroundColor: `${companyColor}12` }]}>

                <Ionicons name="id-card-outline" size={22} color={companyColor} />

              </View>

              <View style={{ flex: 1 }}>

                <Text style={styles.formHeadingTitle}>Qui voyage ?</Text>

                <Text style={styles.formHeadingSubtitle}>{isThirdParty ? 'Renseignez les informations du bénéficiaire.' : 'Renseignez les informations du passager.'}</Text>

              </View>

            </View>

            <View style={styles.formCard}>

              <ElegantField

                icon="person-outline" label="Nom complet" placeholder="Ex. Kouamé Jean"

                value={nom} onChangeText={setNom} color={companyColor}

                required valid={validName} autoCapitalize="words" autoComplete="name"

              />

              <ElegantField

                icon="logo-whatsapp" label="Numéro de téléphone / WhatsApp" placeholder="07 08 12 34 56"

                value={phone} onChangeText={setPhone} color={companyColor}

                required valid={phoneOk} keyboardType="phone-pad" autoComplete="tel"

                maxLength={22} hint="10 chiffres pour la Côte d’Ivoire ou numéro avec indicatif (+225…)."

              />

              <ElegantField

                icon="mail-outline" label="Adresse email" placeholder="exemple\@email.com"

                value={email} onChangeText={setEmail} color={companyColor}

                valid={Boolean(email.trim()) && emailOk} keyboardType="email-address"

                autoCapitalize="none" autoComplete="email" hint="Optionnel · pour recevoir les informations du voyage."

              />

              <ElegantField

                icon="card-outline" label="N° de pièce d’identité" placeholder="CNI ou passeport (facultatif)"

                value={piece} onChangeText={setPiece} color={companyColor}

                autoCapitalize="characters" maxLength={40}

                hint="À renseigner uniquement si demandé par la compagnie."

              />

            </View>

            <View style={styles.privacyNote}>

              <Ionicons name="shield-checkmark-outline" size={19} color="#047857" />

              <Text style={styles.privacyText}>

                Vos coordonnées sont utilisées pour préparer la réservation et faciliter les communications liées au trajet. Le montant et la disponibilité seront vérifiés avant tout paiement réel.

              </Text>

            </View>

            {!confirmedItinerary ? (

              <View style={styles.missingRouteNote}>

                <Ionicons name="alert-circle-outline" size={19} color="#92400E" />

                <Text style={styles.missingRouteText}>

                  Informations manquantes : {missingTripFields.join(', ')}. Sélectionnez un départ programmé avant de poursuivre.

                </Text>

              </View>

            ) : null}

          </Animated.View>

        </ScrollView>

        <Animated.View style={[styles.footer, reveal(footerAnim, 16), { paddingBottom: Math.max(insets.bottom, 12) }]}>

          <View style={styles.footerTop}>

            <View>

              <Text style={styles.footerOverline}>TOTAL INDICATIF</Text>

              <Text style={[styles.footerPrice, { color: companyColor }]}>{money(totalPrice)}</Text>

            </View>

            <View style={styles.footerSecure}>

              <Ionicons name="lock-closed-outline" size={13} color="#047857" />

              <Text style={styles.footerSecureText}>Étape sécurisée</Text>

            </View>

          </View>

          {!formValid && (

            <Text style={styles.footerValidationText}>

              À compléter : {missingPassengerFields.join(', ')}. Touchez le bouton pour vérifier.

            </Text>

          )}

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>

            <Pressable

              accessibilityRole="button"

              accessibilityLabel="Continuer vers le paiement"

              accessibilityHint={formValid ? 'Vérifier le trajet et continuer' : 'Appuyez pour connaître les champs à corriger'}

              onPress={onNext}

              onPressIn={onPressIn}

              onPressOut={onPressOut}

              style={styles.buttonOuter}

            >

              <LinearGradient

                colors={[companyColor, '#EA580C']}

                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}

                style={styles.buttonGradient}

              >

                <Text style={styles.buttonText}>Continuer vers le paiement</Text>

                <View style={styles.buttonArrow}>

                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />

                </View>

              </LinearGradient>

            </Pressable>

          </Animated.View>

        </Animated.View>

      </KeyboardAvoidingView>

    </View>

  );

}

const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: BACKGROUND },

  hero: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },

  topRow: { paddingHorizontal: 18, paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },

  backButton: { height: 44, width: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' },

  topCopy: { flex: 1, alignItems: 'center' },

  eyebrow: { fontSize: 9, letterSpacing: 2, fontWeight: '900', color: 'rgba(255,255,255,0.75)' },

  topTitle: { fontSize: 17, fontWeight: '900', marginTop: 4, color: '#FFFFFF' },

  topIcon: { height: 44, width: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' },

  heroCopy: { paddingHorizontal: 25, marginTop: 28, alignItems: 'center' },

  heroLead: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'center' },

  heroSub: { color: 'rgba(255,255,255,0.83)', fontSize: 11, fontWeight: '600', marginTop: 7, textAlign: 'center' },

  progressRow: { paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25 },

  progressLine: { width: 38, height: 1, backgroundColor: 'rgba(255,255,255,0.38)', marginHorizontal: 4, marginBottom: 19 },

  step: { alignItems: 'center', gap: 6, minWidth: 61 },

  stepCircle: { height: 31, width: 31, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },

  stepDone: { backgroundColor: '#059669', borderColor: '#059669' },

  stepNumber: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },

  stepLabel: { color: 'rgba(255,255,255,0.68)', fontWeight: '700', fontSize: 10 },

  stepLabelActive: { color: '#FFFFFF', fontWeight: '900' },

  keyboardArea: { flex: 1 },

  content: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 26 },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 17, borderWidth: 1, borderColor: '#E8EDF4', shadowColor: '#12213A', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.065, shadowRadius: 17, elevation: 3 },

  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  summarySmallIcon: { height: 44, width: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  summaryMain: { flex: 1 },

  summaryOverline: { color: '#A0AABC', fontSize: 9, letterSpacing: 1.1, fontWeight: '900' },

  summaryCompany: { fontSize: 14, color: INK, fontWeight: '900', marginTop: 3 },

  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 40, paddingHorizontal: 8, paddingVertical: 7 },

  summaryBadgeText: { fontSize: 9, fontWeight: '900', color: '#C2410C' },

  tripRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 24, paddingBottom: 15 },

  tripCity: { minWidth: 0, flexBasis: 0 },

  tripCityDeparture: { flexGrow: 0.82 },

  tripCityArrival: { flexGrow: 1.18, alignItems: 'flex-end' },

  cityLabel: { color: '#98A4B5', fontWeight: '900', fontSize: 9, letterSpacing: 1 },

  cityName: { color: INK, fontWeight: '900', fontSize: 18, marginTop: 5, minWidth: 0, width: '100%' },

  cityNameArrival: { textAlign: 'right', fontSize: 17, flexShrink: 1 },

  stationLabel: { color: MUTED, fontWeight: '600', fontSize: 10, lineHeight: 15, marginTop: 4, minHeight: 30 },

  tripHour: { color: '#344054', fontWeight: '900', fontSize: 14, marginTop: 7 },

  tripMiddle: { width: 38, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, marginHorizontal: 2 },

  routeLine: { flex: 1, height: 1.5, backgroundColor: '#E2E8F0' },

  routeIcon: { height: 30, width: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 11 },

  metaText: { color: '#64748B', fontWeight: '700', fontSize: 10 },

  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CDD5DF', marginHorizontal: 2 },

  summaryDivider: { height: 1, backgroundColor: '#EDF1F5', marginVertical: 15 },

  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  seatText: { color: INK, fontWeight: '900', fontSize: 11 },

  priceNote: { fontSize: 9, color: '#9AA6B6', marginTop: 4 },

  summaryTotal: { fontSize: 17, fontWeight: '900' },

  formHeading: { flexDirection: 'row', gap: 11, alignItems: 'center', marginTop: 24, marginBottom: 12 },

  formHeadingIcon: { height: 43, width: 43, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },

  formHeadingTitle: { color: INK, fontSize: 19, fontWeight: '900' },

  formHeadingSubtitle: { marginTop: 4, color: MUTED, fontSize: 11 },

  formCard: { borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EEF4' },

  fieldGroup: { marginBottom: 16 },

  fieldTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  fieldTitle: { fontSize: 11, fontWeight: '900', color: '#334155' },

  validBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  validText: { fontSize: 9, color: '#059669', fontWeight: '900' },

  fieldBox: { height: 55, flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 15, borderWidth: 1.5, borderColor: '#E7ECF3', paddingHorizontal: 10, backgroundColor: '#FBFCFE', shadowColor: '#0F172A', shadowOpacity: 0, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },

  fieldIcon: { height: 36, width: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },

  fieldInput: { flex: 1, color: INK, fontWeight: '700', fontSize: 13, paddingVertical: 8 },

  fieldHint: { fontSize: 9, lineHeight: 14, color: '#8A97A9', marginTop: 6, paddingLeft: 3 },

  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 16, marginTop: 13 },

  privacyText: { flex: 1, color: '#047857', fontSize: 10, lineHeight: 16, fontWeight: '600' },

  missingRouteNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, marginTop: 11 },

  missingRouteText: { flex: 1, color: '#92400E', fontSize: 10, lineHeight: 16, fontWeight: '600' },

  footer: { paddingTop: 12, paddingHorizontal: 17, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E9EEF4', shadowColor: '#0F172A', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.045, shadowRadius: 13 },

  footerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },

  footerOverline: { color: '#98A4B5', letterSpacing: 0.9, fontSize: 9, fontWeight: '900' },

  footerPrice: { fontWeight: '900', fontSize: 18, marginTop: 4 },

  footerSecure: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 22 },

  footerSecureText: { color: '#047857', fontSize: 9, fontWeight: '800' },

  buttonOuter: { borderRadius: 16, overflow: 'hidden' },

  buttonDisabled: { opacity: 0.7 },

  footerValidationText: { color: '#92400E', fontSize: 11, lineHeight: 16, marginBottom: 9, fontWeight: '600' },

  arrivalUnverified: { color: '#B45309', textAlign: 'right', fontSize: 9, lineHeight: 13, marginTop: 2, fontWeight: '600' },

  buttonGradient: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 15 },

  buttonText: { flex: 1, color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '900' },

  buttonArrow: { height: 28, width: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.19)', alignItems: 'center', justifyContent: 'center' },

});
