import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AccountScreen() {
  const router = useRouter();
  const transactions = [
    {id:1, type:'recharge', amount:'+10 000', date:'05 Juil', desc:'Orange Money'},
    {id:2, type:'achat', amount:'-5 000', date:'03 Juil', desc:'UTB Abidjan-Yakro'},
    {id:3, type:'achat', amount:'-8 000', date:'28 Juin', desc:'Messay Bouaké'},
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.title}>Mon compte</Text>
            <View style={{width:24}} />
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balance}>2 500 <Text style={styles.cur}>FCFA</Text></Text>
            <TouchableOpacity style={styles.rechargeBtn}>
              <Ionicons name="add" size={20} color="#EF4444" />
              <Text style={styles.rechargeTxt}>Recharger</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.methods}>
          {[
            {name:'Orange Money', icon:'phone-portrait', color:'#FF7900'},
            {name:'MTN MoMo', icon:'phone-portrait', color:'#FFCC00'},
            {name:'Wave', icon:'water', color:'#00AEEF'},
            {name:'Carte', icon:'card', color:'#6B7280'},
          ].map((m,i) => (
            <TouchableOpacity key={i} style={styles.method}>
              <View style={[styles.methodIcon, {backgroundColor: m.color+'15'}]}>
                <Ionicons name={m.icon as any} size={22} color={m.color} />
              </View>
              <Text style={styles.methodTxt}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Transactions récentes</Text>
          {transactions.map(t => (
            <View key={t.id} style={styles.tx}>
              <View style={[styles.txIcon, {backgroundColor: t.type==='recharge' ? '#D1FAE5' : '#FEE2E2'}]}>
                <Ionicons name={t.type==='recharge' ? 'arrow-down' : 'arrow-up'} size={18} color={t.type==='recharge' ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{t.desc}</Text>
                <Text style={styles.txDate}>{t.date}</Text>
              </View>
              <Text style={[styles.txAmount, {color: t.type==='recharge' ? '#10B981' : '#111827'}]}>{t.amount}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 30 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  balanceBox: { alignItems: 'center', paddingTop: 20 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balance: { color: '#FFF', fontSize: 36, fontWeight: '900', marginTop: 4 },
  cur: { fontSize: 18, fontWeight: '600' },
  rechargeBtn: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 16, gap: 6, alignItems: 'center' },
  rechargeTxt: { color: '#EF4444', fontWeight: '700' },
  content: { flex: 1, marginTop: -20, paddingHorizontal: 20 },
  methods: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  method: { alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 14, width: '23%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  methodIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  methodTxt: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 20 },
  section: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { fontWeight: '600', color: '#111827' },
  txDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontWeight: '800', fontSize: 15 },
});