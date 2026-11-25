/** MESSAY mobile — carte de QR billet après confirmation réelle du paiement. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = Readonly<{
  qrPayload: string;
  compagnie: string;
  depart: string;
  destination: string;
  dateDepart: string;
  heureDepart: string;
  siegeAffichage?: string | null;
}>;

export default function MessayBilletQrCard(props: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Billet MESSAY confirmé</Text>
      <Text style={styles.trip}>{props.compagnie}</Text>
      <Text style={styles.trip}>{props.depart} → {props.destination}</Text>
      <Text style={styles.meta}>{props.dateDepart} à {props.heureDepart}</Text>
      <View style={styles.qrBox}>
        <QRCode value={props.qrPayload} size={210} ecl="H" backgroundColor="#FFFFFF" color="#101828" />
      </View>
      <Text style={styles.meta}>Présentez ce QR code à l’agent de votre compagnie.</Text>
      <Text style={styles.seat}>Siège : {props.siegeAffichage || 'En attente d’attribution par la compagnie'}</Text>
      <Text style={styles.note}>Ne partagez pas ce QR code publiquement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  title: { color: '#0B4DA1', fontSize: 20, fontWeight: '800' },
  trip: { color: '#101828', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  meta: { color: '#475467', fontSize: 13, textAlign: 'center' },
  qrBox: { backgroundColor: '#FFFFFF', padding: 14, marginVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC' },
  seat: { color: '#0B4DA1', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  note: { color: '#667085', fontSize: 12, textAlign: 'center' },
});
