import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Dimensions, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// --- 5 COMPAGNIES x 5 TRAJETS = 25 VOYAGES ---
const BUS_TRIPS = [
  // 1. MESSAY EXPRESS (Orange)
  { id: 'm1', company: 'Messay Express', route: 'Abidjan - Yamoussoukro', departTime: '08:00', arriveTime: '11:15', price: '5000', type: 'VIP (Climatisé)', seatsLeft: 12, rating: 4.9, logoColor: '#FF6B35' },
  { id: 'm2', company: 'Messay Express', route: 'Abidjan - Bouaké', departTime: '10:30', arriveTime: '15:45', price: '7000', type: 'Standard', seatsLeft: 25, rating: 4.8, logoColor: '#FF6B35' },
  { id: 'm3', company: 'Messay Express', route: 'Yamoussoukro - Korhogo', departTime: '13:00', arriveTime: '19:30', price: '9000', type: 'VIP', seatsLeft: 8, rating: 4.9, logoColor: '#FF6B35' },
  { id: 'm4', company: 'Messay Express', route: 'Abidjan - San Pedro', departTime: '21:00', arriveTime: '03:30', price: '8500', type: 'Premium Nuit', seatsLeft: 3, rating: 4.7, logoColor: '#FF6B35' },
  { id: 'm5', company: 'Messay Express', route: 'Bouaké - Daloa', departTime: '09:00', arriveTime: '13:00', price: '4500', type: 'Standard', seatsLeft: 40, rating: 4.6, logoColor: '#FF6B35' },

  // 2. UTB TRANSPORTS (Bleu)
  { id: 'u1', company: 'UTB Transports', route: 'Abidjan - Bouaké', departTime: '07:00', arriveTime: '12:30', price: '7000', type: 'Standard', seatsLeft: 15, rating: 4.5, logoColor: '#3B82F6' },
  { id: 'u2', company: 'UTB Transports', route: 'Yamoussoukro - Abidjan', departTime: '14:00', arriveTime: '17:30', price: '5000', type: 'Climatisé', seatsLeft: 5, rating: 4.4, logoColor: '#3B82F6' },
  { id: 'u3', company: 'UTB Transports', route: 'Abidjan - Korhogo', departTime: '06:00', arriveTime: '16:00', price: '12000', type: 'Longue Distance', seatsLeft: 22, rating: 4.3, logoColor: '#3B82F6' },
  { id: 'u4', company: 'UTB Transports', route: 'Bouaké - Man', departTime: '08:30', arriveTime: '15:00', price: '8000', type: 'Standard', seatsLeft: 30, rating: 4.2, logoColor: '#3B82F6' },
  { id: 'u5', company: 'UTB Transports', route: 'Abidjan - Daloa', departTime: '11:00', arriveTime: '17:00', price: '7500', type: 'Climatisé', seatsLeft: 10, rating: 4.5, logoColor: '#3B82F6' },

  // 3. ARALIA TRANSPORT (Vert)
  { id: 'a1', company: 'Aralia Transport', route: 'Abidjan - San Pedro', departTime: '22:00', arriveTime: '04:30', price: '8500', type: 'Premium Nuit', seatsLeft: 20, rating: 4.7, logoColor: '#10B981' },
  { id: 'a2', company: 'Aralia Transport', route: 'San Pedro - Soubré', departTime: '08:00', arriveTime: '10:30', price: '3000', type: 'Express', seatsLeft: 12, rating: 4.6, logoColor: '#10B981' },
  { id: 'a3', company: 'Aralia Transport', route: 'Abidjan - Gagnoa', departTime: '09:30', arriveTime: '14:00', price: '6000', type: 'Standard', seatsLeft: 4, rating: 4.5, logoColor: '#10B981' },
  { id: 'a4', company: 'Aralia Transport', route: 'Gagnoa - San Pedro', departTime: '15:00', arriveTime: '18:30', price: '4500', type: 'Climatisé', seatsLeft: 28, rating: 4.4, logoColor: '#10B981' },
  { id: 'a5', company: 'Aralia Transport', route: 'Abidjan - Sassandra', departTime: '13:00', arriveTime: '17:45', price: '7000', type: 'VIP', seatsLeft: 9, rating: 4.8, logoColor: '#10B981' },

  // 4. GARE NORD EXPRESS (Violet)
  { id: 'g1', company: 'Gare Nord Express', route: 'Abidjan - Korhogo', departTime: '05:30', arriveTime: '15:30', price: '12000', type: 'VIP+', seatsLeft: 2, rating: 4.6, logoColor: '#8B5CF6' },
  { id: 'g2', company: 'Gare Nord Express', route: 'Korhogo - Ferké', departTime: '16:30', arriveTime: '17:45', price: '2000', type: 'Navette', seatsLeft: 18, rating: 4.3, logoColor: '#8B5CF6' },
  { id: 'g3', company: 'Gare Nord Express', route: 'Abidjan - Ouangolo', departTime: '05:00', arriveTime: '16:30', price: '14000', type: 'Standard', seatsLeft: 35, rating: 4.2, logoColor: '#8B5CF6' },
  { id: 'g4', company: 'Gare Nord Express', route: 'Bouaké - Korhogo', departTime: '10:00', arriveTime: '14:30', price: '5500', type: 'Climatisé', seatsLeft: 14, rating: 4.5, logoColor: '#8B5CF6' },
  { id: 'g5', company: 'Gare Nord Express', route: 'Abidjan - Boundiali', departTime: '06:00', arriveTime: '17:00', price: '13500', type: 'VIP', seatsLeft: 6, rating: 4.7, logoColor: '#8B5CF6' },

  // 5. IVOIRE RAPIDE (Rouge)
  { id: 'i1', company: 'Ivoire Rapide', route: 'Abidjan - Daloa', departTime: '07:30', arriveTime: '13:30', price: '7500', type: 'Express', seatsLeft: 21, rating: 4.4, logoColor: '#EF4444' },
  { id: 'i2', company: 'Ivoire Rapide', route: 'Daloa - Man', departTime: '14:30', arriveTime: '17:30', price: '4000', type: 'Standard', seatsLeft: 8, rating: 4.3, logoColor: '#EF4444' },
  { id: 'i3', company: 'Ivoire Rapide', route: 'Abidjan - Duékoué', departTime: '08:00', arriveTime: '15:00', price: '8500', type: 'Climatisé', seatsLeft: 11, rating: 4.5, logoColor: '#EF4444' },
  { id: 'i4', company: 'Ivoire Rapide', route: 'Yamoussoukro - Daloa', departTime: '11:30', arriveTime: '14:30', price: '3500', type: 'Navette', seatsLeft: 2, rating: 4.1, logoColor: '#EF4444' },
  { id: 'i5', company: 'Ivoire Rapide', route: 'Abidjan - Touba', departTime: '06:30', arriveTime: '18:00', price: '11000', type: 'Longue Distance', seatsLeft: 19, rating: 4.2, logoColor: '#EF4444' },
];

export default function TicketsScreen() {
  const router = useRouter();
  const [depart, setDepart] = useState('Abidjan');
  const [arrivee, setArrivee] = useState('');
  const [date, setDate] = useState("Aujourd'hui");

  // 🌟 FONCTION D'ACHAT DU BILLET
  const handleBooking = (trip: any) => {
    Alert.alert(
      "Confirmation d'achat",
      `Voulez-vous réserver un billet pour le trajet ${trip.route} avec ${trip.company} au prix de ${trip.price} FCFA ?\n\nDépart à ${trip.departTime}.`,
      [
        {
          text: "Annuler",
          style: "cancel"
        },
        {
          text: "Payer",
          onPress: () => {
            // Ici tu mettras plus tard l'appel API vers ton système de paiement (Wave, Orange Money...)
            Alert.alert(
              "Succès 🎉", 
              `Votre billet pour ${trip.route} a été généré avec succès ! Vous le retrouverez dans l'onglet Profil.`
            );
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billets de Bus</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.searchCard}>
          <View style={styles.inputGroup}>
            <Ionicons name="location-outline" size={20} color="#86868B" />
            <TextInput 
              style={styles.input} 
              value={depart} 
              onChangeText={setDepart} 
              placeholder="Ville de départ" 
              placeholderTextColor="#86868B"
            />
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.inputGroup}>
            <Ionicons name="flag-outline" size={20} color="#FF6B35" />
            <TextInput 
              style={styles.input} 
              value={arrivee} 
              onChangeText={setArrivee} 
              placeholder="Où allez-vous ?" 
              placeholderTextColor="#86868B"
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.inputGroup}>
            <Ionicons name="calendar-outline" size={20} color="#86868B" />
            <Text style={styles.dateText}>{date}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.searchBtn}>
            <Text style={styles.searchBtnTxt}>Rechercher un trajet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Départs disponibles ({BUS_TRIPS.length})</Text>
          
          {BUS_TRIPS.map((trip) => (
            <TouchableOpacity key={trip.id} activeOpacity={0.8} style={styles.tripCard}>
              
              <View style={styles.tripHeader}>
                <View style={styles.companyRow}>
                  <View style={[styles.companyLogo, { backgroundColor: trip.logoColor + '15' }]}>
                    <FontAwesome5 name="bus-alt" size={16} color={trip.logoColor} />
                  </View>
                  <View>
                    <Text style={styles.companyName}>{trip.company}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.ratingTxt}>{trip.rating}</Text>
                      <Text style={styles.typeTxt}> • {trip.type}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.price}>
                  {trip.price} <Text style={styles.currency}>FCFA</Text>
                </Text>
              </View>

              <View style={styles.dashedLine} />

              <View style={styles.routeRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.time}>{trip.departTime}</Text>
                  <Text style={styles.city}>{trip.route.split(' - ')[0]}</Text>
                </View>
                
                <View style={styles.routeVisual}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeLine} />
                  <View style={[styles.routeDot, { backgroundColor: '#FF6B35', borderColor: '#FF6B35' }]} />
                </View>

                <View style={styles.timeColumnRight}>
                  <Text style={styles.time}>{trip.arriveTime}</Text>
                  <Text style={styles.city}>{trip.route.split(' - ')[1]}</Text>
                </View>
              </View>

              <View style={styles.tripFooter}>
                <Text style={[styles.seatsTxt, trip.seatsLeft <= 5 && { color: '#EF4444' }]}>
                  {trip.seatsLeft} {trip.seatsLeft > 1 ? 'places restantes' : 'place restante'}
                </Text>
                
                {/* 🌟 APPEL DE LA FONCTION D'ACHAT AU CLIC SUR LE BOUTON */}
                <TouchableOpacity 
                  style={styles.bookBtn}
                  onPress={() => handleBooking(trip)}
                >
                  <Text style={styles.bookBtnTxt}>Acheter</Text>
                </TouchableOpacity>
              </View>

            </TouchableOpacity>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  headerSafeArea: { backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1D1D1F' },
  scrollContent: { paddingBottom: 120 },
  searchCard: { margin: 20, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 4 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  input: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#1D1D1F' },
  dateText: { marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#1D1D1F' },
  divider: { height: 1, backgroundColor: '#F5F5F7', marginLeft: 32 },
  searchBtn: { backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  searchBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  resultsSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1D1D1F', marginBottom: 15 },
  tripCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  companyRow: { flexDirection: 'row', alignItems: 'center' },
  companyLogo: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  companyName: { fontSize: 16, fontWeight: '800', color: '#1D1D1F' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingTxt: { fontSize: 12, fontWeight: '700', color: '#86868B', marginLeft: 4 },
  typeTxt: { fontSize: 12, fontWeight: '500', color: '#86868B' },
  price: { fontSize: 18, fontWeight: '900', color: '#FF6B35' },
  currency: { fontSize: 12, fontWeight: '700' },
  dashedLine: { height: 1, borderBottomWidth: 1, borderColor: '#E5E5EA', borderStyle: 'dashed', marginVertical: 16 },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeColumn: { flex: 1, alignItems: 'flex-start' },
  timeColumnRight: { flex: 1, alignItems: 'flex-end' },
  time: { fontSize: 18, fontWeight: '900', color: '#1D1D1F' },
  city: { fontSize: 13, fontWeight: '600', color: '#86868B', marginTop: 2 },
  routeVisual: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  routeLine: { flex: 1, height: 2, backgroundColor: '#E5E5EA', marginHorizontal: 4 },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  seatsTxt: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  bookBtn: { backgroundColor: '#1D1D1F', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  bookBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});