/**
 * MESSAY — Calendrier de consultation des horaires publiés.
 * Aucune affectation, réservation, disponibilité ou paiement n'est créé ici.
 * Une date sélectionnée relance la recherche existante via onSelectDate.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ScheduleItem = {
  id: string;
  heure: string;
  destination: string;
  prix: number | null;
};
type Props = {
  selectedDate: string;
  horaires: ScheduleItem[];
  onSelectDate: (date: string) => void;
};

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function dateInfo(iso: string): { year: number; month: number; day: number } | null {
  if (!DATE_RE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.toISOString().slice(0, 10) !== iso) return null;
  return { year, month, day };
}
function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function todayAbidjan(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function ScheduleCard({ item, index }: { item: ScheduleItem; index: number }) {
  const animation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    animation.setValue(0);
    const transition = Animated.timing(animation, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 9) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [animation, item.id, index]);

  return (
    <Animated.View style={[styles.scheduleCard, {
      opacity: animation,
      transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    }]}>
      <View style={styles.timeChip}><Ionicons name="time-outline" size={15} color="#C2410C" />
        <Text style={styles.timeText}>{item.heure}</Text>
      </View>
      <View style={styles.scheduleBody}>
        <Text style={styles.destination} numberOfLines={1}>{item.destination}</Text>
        <Text style={styles.price}>{item.prix !== null && Number.isFinite(item.prix)
          ? `${item.prix.toLocaleString('fr-FR')} FCFA` : 'Tarif à confirmer'}</Text>
      </View>
      <View style={styles.pendingDot} accessibilityLabel="Bus non confirmé" />
    </Animated.View>
  );
}

export default function PublishedScheduleCalendar({ selectedDate, horaires, onSelectDate }: Props) {
  const selected = dateInfo(selectedDate);
  const [shown, setShown] = useState(() => selected
    ? { year: selected.year, month: selected.month }
    : { year: 2026, month: 12 });
  const isSelectedMonth = !!selected && shown.year === selected.year && shown.month === selected.month;

  useEffect(() => {
    if (selected) setShown({ year: selected.year, month: selected.month });
  }, [selectedDate]);

  const firstDay = (new Date(Date.UTC(shown.year, shown.month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(shown.year, shown.month, 0)).getUTCDate();
  const days = useMemo(() => [
    ...Array.from({ length: firstDay }, () => 0),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ], [firstDay, daysInMonth]);
  const today = todayAbidjan();
  const sorted = useMemo(() => [...horaires].sort((a, b) => a.heure.localeCompare(b.heure)), [horaires]);

  const changeMonth = (step: number) => {
    const value = new Date(Date.UTC(shown.year, shown.month - 1 + step, 1));
    setShown({ year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.head}>
        <View style={styles.headIcon}><Ionicons name="calendar-outline" size={21} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CALENDRIER DES HORAIRES</Text>
          <Text style={styles.title}>Voyages prévus</Text>
        </View>
        <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>Non confirmés</Text></View>
      </View>

      <View style={styles.calendar}>
        <View style={styles.monthHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent"
            hitSlop={12} onPress={() => changeMonth(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={20} color="#334155" />
          </Pressable>
          <Text style={styles.monthLabel}>{MONTHS[shown.month - 1]} {shown.year}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois suivant"
            hitSlop={12} onPress={() => changeMonth(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
            <Ionicons name="chevron-forward" size={20} color="#334155" />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {DAYS.map((day, index) => (
            <View key={`header-${index}`} style={styles.cell}>
              <Text style={styles.weekday}>{day}</Text>
            </View>
          ))}
          {days.map((day, index) => {
            if (day === 0) return <View key={`blank-${index}`} style={styles.cell} />;
            const iso = isoDate(shown.year, shown.month, day);
            const active = isSelectedMonth && day === selected?.day;
            const past = iso < today;
            return (
              <View key={iso} style={styles.cell}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={`${day} ${MONTHS[shown.month - 1]} ${shown.year}${active ? ', sélectionné' : ''}`}
                  accessibilityState={{ selected: active, disabled: past }}
                  disabled={past} onPress={() => { if (!active) onSelectDate(iso); }}
                  style={({ pressed }) => [styles.day, active && styles.dayActive, pressed && !past && styles.pressed]}>
                  <Text style={[styles.dayLabel, past && styles.dayPast, active && styles.dayLabelActive]}>{day}</Text>
                  {active && <View style={styles.selectedMarker} />}
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendDot} /><Text style={styles.legendText}>Date consultée</Text>
          <Text style={styles.legendNote}>Sélectionnez un jour pour actualiser la recherche</Text>
        </View>
      </View>

      <View style={styles.scheduleSection}>
        <View style={styles.scheduleHeading}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>HORAIRES HABITUELS PUBLIÉS</Text>
            <Text style={styles.sectionTitle}>
              {isSelectedMonth && selected ? `${selected.day} ${MONTHS[selected.month - 1].toLowerCase()}` : 'Choisissez une date'}
            </Text>
          </View>
          {isSelectedMonth && <Text style={styles.count}>{sorted.length} horaire{sorted.length > 1 ? 's' : ''}</Text>}
        </View>
        {isSelectedMonth ? (
          sorted.length > 0 ? sorted.map((item, index) => <ScheduleCard key={item.id} item={item} index={index} />)
            : <Text style={styles.noSchedule}>Aucun horaire publié à venir pour cette sélection.</Text>
        ) : <Text style={styles.noSchedule}>Sélectionnez une date du calendrier pour consulter ses horaires.</Text>}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={19} color="#92400E" />
        <Text style={styles.footerText}>
          Les horaires sont indicatifs. Aucun bus ni siège n'est confirmé. La réservation sera disponible uniquement après affectation d'un bus réel et validation du parcours de paiement.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1D9C7', overflow: 'hidden' },
  head: { backgroundColor: '#FFF4EA', paddingHorizontal: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 42, height: 42, backgroundColor: '#F97316', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, letterSpacing: 1.4, color: '#9A3412', fontWeight: '800' },
  title: { color: '#422006', fontSize: 19, fontWeight: '800', marginTop: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFEDD5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706' },
  statusText: { color: '#92400E', fontSize: 10, fontWeight: '700' },
  calendar: { marginHorizontal: 13, marginTop: 14, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 19, backgroundColor: '#FAFBFD' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13 },
  monthLabel: { fontSize: 17, fontWeight: '800', color: '#0F172A', textTransform: 'capitalize' },
  arrow: { width: 35, height: 35, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', height: 43, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  day: { width: 35, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: '#F97316', shadowColor: '#F97316', shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  dayLabel: { color: '#334155', fontSize: 13, fontWeight: '700' },
  dayPast: { color: '#CBD5E1' },
  dayLabelActive: { color: '#FFFFFF', fontWeight: '900' },
  selectedMarker: { position: 'absolute', bottom: 3, height: 3, width: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5, flexWrap: 'wrap' },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F97316' },
  legendText: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  legendNote: { color: '#94A3B8', fontSize: 10, marginLeft: 5, flexShrink: 1 },
  scheduleSection: { paddingHorizontal: 15, paddingTop: 19, paddingBottom: 8 },
  scheduleHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionEyebrow: { color: '#C2410C', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  count: { color: '#9A3412', backgroundColor: '#FFF7ED', borderRadius: 20, overflow: 'hidden', paddingVertical: 7, paddingHorizontal: 10, fontWeight: '700', fontSize: 11 },
  scheduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EDF4', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 13, marginBottom: 8, gap: 10 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#FFF3E8', borderRadius: 10 },
  timeText: { fontSize: 14, fontWeight: '900', color: '#9A3412' },
  scheduleBody: { flex: 1 },
  destination: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  price: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#64748B' },
  pendingDot: { width: 7, height: 7, backgroundColor: '#F59E0B', borderRadius: 4 },
  noSchedule: { color: '#64748B', paddingVertical: 18, fontSize: 13 },
  footer: { backgroundColor: '#FFFBEB', marginHorizontal: 14, marginTop: 10, marginBottom: 14, borderRadius: 15, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  footerText: { flex: 1, color: '#92400E', fontSize: 11, lineHeight: 17 },
});
