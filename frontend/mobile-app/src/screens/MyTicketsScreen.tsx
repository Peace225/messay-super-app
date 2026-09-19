import { supabase } from '../services/supabase';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ImageBackground, RefreshControl, Modal, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const TABS = [
  { id: 'pending', label: 'EN ATTENTES', key: 'à venir' },
  { id: 'used', label: 'UTILISÉS', key: 'utilisé' },
  { id: 'expired', label: 'EXPIRÉS', key: 'expiré' },
];
const COLORS:any = { 'UTB':'#7C3AED','UTB CI':'#7C3AED','Messay':'#FF6B35','SBTA':'#F59E0B','AVS':'#10B981' };

export default function MyTicketsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrTicket, setQrTicket] = useState<any>(null);

  const fetchTickets = async()=>{
    setLoading(true);
    try{
      const { data, error } = await supabase
      .from('tickets')
      .select(`
          id, depart, destination, date_voyage, heure_depart, sieges, prix_total, statut, ref, code, company_id,
          company:companies ( name ),
          gare:gare_id ( nom, ville, adresse, latitude, longitude, telephone )
        `)
      .order('created_at',{ascending:false});
      if(error) throw error;
      if(!data){ setTickets([]); return; }

      const mapped = data.map((t:any)=>{
        const d = new Date(t.date_voyage);
        const today = new Date(); today.setHours(0,0,0,0);
        const isPast = d < today;
        const compName = t.company?.name || 'UTB';
        return {
          id: t.id,
          company: compName,
          from: t.depart || 'Abidjan',
          to: t.destination || 'Yamoussoukro',
          date: new Date(t.date_voyage).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}),
          time: t.heure_depart?.slice(0,5) || '07:00',
          seat: Array.isArray(t.sieges)? t.sieges.join(', ') : String(t.sieges||''),
          price: String(t.prix_total||'5000'),
          status: isPast? 'expiré' : (t.statut==='utilisé'?'utilisé':'à venir'),
          code: t.ref || t.code || `${compName.slice(0,3).toUpperCase()}-${String(t.id).slice(0,5).toUpperCase()}`,
          color: COLORS[compName]||'#FF6B35',
          gare: t.gare?.nom || 'Gare Gesco',
          gareAdresse: t.gare?.adresse || 'Yopougon Gesco, Autoroute du Nord',
          gareLat: t.gare?.latitude?? 5.348,
          gareLng: t.gare?.longitude?? -4.071,
        };
      });
      setTickets(mapped);
    }catch(e){ console.log('tickets fetch',e); setTickets([]); }
    finally{ setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(()=>{ fetchTickets(); },[]));
  const onRefresh = ()=>{ setRefreshing(true); fetchTickets(); };

  const openMap = async (ticket:any)=>{
    const url = `https://www.google.com/maps/search/?api=1&query=${ticket.gareLat},${ticket.gareLng}`;
    const can = await Linking.canOpenURL(url);
    if(can) Linking.openURL(url); else Alert.alert('Gare', `${ticket.gare}\n${ticket.gareAdresse}`);
  };

  const currentStatus = TABS.find(t=>t.id===activeTab)?.key || 'à venir';
  const filtered = tickets.filter(t=>t.status===currentStatus);

  const downloadTicket = async(ticket:any)=>{
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(ticket.code+'|'+ticket.from+'-'+ticket.to+'|'+ticket.seat)}`;
    const html = `<html><body style="font-family:Helvetica;padding:20px;background:#F9FAFB"><div style="background:#FFF;border:2px dashed ${ticket.color};border-radius:20px;padding:20px;text-align:center"><h1 style="color:${ticket.color};margin:0">${ticket.company}</h1><p style="letter-spacing:2px;color:#6B7280">${ticket.code}</p><h2>${ticket.from} → ${ticket.to}</h2><p>${ticket.date} - ${ticket.time} - Siège ${ticket.seat}</p><div style="background:#F9FAFB;border-radius:10px;padding:10px;margin:12px 0;text-align:left"><b style="font-size:10px;color:#9CA3AF">GARE DEPART</b><br/><b>${ticket.gare}</b><br/><span style="font-size:12px;color:#6B7280">${ticket.gareAdresse}</span></div><img src="${qrUrl}" width="220" height="220"/><p style="font-size:10px;color:#999;margin-top:12px">Présente ce QR à l'embarquement • ${ticket.price} FCFA</p></div></body></html>`;
    try{
      const { uri } = await Print.printToFileAsync({ html });
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert('PDF créé', uri);
    }catch{ Alert.alert('Erreur','Impossible de générer le PDF'); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#6D28D9', '#7C3AED']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}><TouchableOpacity onPress={()=>router.back()}><Ionicons name="chevron-back" size={24} color="#FFF"/></TouchableOpacity><Text style={styles.headerTitle}>Mes Tickets</Text><TouchableOpacity onPress={onRefresh}><Ionicons name="refresh" size={20} color="#FFF"/></TouchableOpacity></View>
          <View style={styles.tabs}>{TABS.map(tab=>(<TouchableOpacity key={tab.id} onPress={()=>setActiveTab(tab.id)} style={styles.tab}><Text style={[styles.tabText, activeTab===tab.id && styles.tabActive]}>{tab.label}</Text>{activeTab===tab.id && <View style={styles.tabLine}/>}</TouchableOpacity>))}</View>
        </SafeAreaView>
      </LinearGradient>

      <ImageBackground source={require('../../assets/images/bus.jpg')} style={styles.bg} imageStyle={{opacity:0.04}}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}>
          {loading? <ActivityIndicator color="#7C3AED" style={{marginTop:80}}/> : filtered.length===0? (
            <View style={styles.empty}><View style={styles.emptyIcon}><View style={styles.emptyRing}/><Ionicons name="navigate" size={32} color="#DC2626" style={styles.emptyArrow}/></View><Text style={styles.emptyTitle}>Aucun ticket {currentStatus}</Text><Text style={styles.emptySub}>Après paiement, ton billet apparaît ici automatiquement avec QR et gare.</Text><TouchableOpacity style={styles.buyBtn} onPress={()=>router.push('/(tabs)/home' as any)}><LinearGradient colors={['#FF6B35','#F97316']} style={styles.buyBtnGrad}><Text style={styles.buyBtnTxt}>Acheter un ticket</Text></LinearGradient></TouchableOpacity></View>
          ) : filtered.map(ticket=>(
            <View key={ticket.id} style={styles.ticketCard}>
              <LinearGradient colors={[ticket.color, `${ticket.color}DD`]} style={styles.ticketHeader}><View style={styles.ticketTop}><View><Text style={styles.companyName}>{ticket.company}</Text><Text style={styles.ticketCode}>{ticket.code}</Text></View><View style={[styles.statusBadge,{backgroundColor: ticket.status==='à venir'?'rgba(16,185,129,0.28)':'rgba(0,0,0,0.18)'}]}><View style={[styles.statusDot,{backgroundColor:ticket.status==='à venir'?'#10B981':'#FFF'}]}/><Text style={styles.statusTxt}>{ticket.status.toUpperCase()}</Text></View></View></LinearGradient>
              <View style={styles.ticketBody}>
                <View style={styles.route}><View style={styles.city}><Text style={styles.cityLabel}>DE</Text><Text style={styles.cityName}>{ticket.from}</Text><Text style={styles.gare}>{ticket.gare}</Text></View><View style={styles.routeLine}><View style={styles.dot}/><View style={styles.line}/><MaterialCommunityIcons name="bus" size={20} color={ticket.color}/><View style={styles.line}/><View style={[styles.dot,{backgroundColor:ticket.color}]}/></View><View style={styles.city}><Text style={styles.cityLabel}>À</Text><Text style={styles.cityName}>{ticket.to}</Text><Text style={styles.gare}>Gare routière</Text></View></View>
                <View style={styles.gareBox}><View style={{flex:1}}><Text style={styles.gareLabel}>GARE DÉPART</Text><Text style={styles.gareName}>{ticket.gare}</Text><Text style={styles.gareAddr} numberOfLines={1}>{ticket.gareAdresse}</Text></View><TouchableOpacity onPress={()=>openMap(ticket)} style={styles.mapBtn}><Ionicons name="map-outline" size={14} color={ticket.color}/><Text style={[styles.mapBtnT,{color:ticket.color}]}>Carte</Text></TouchableOpacity></View>
                <View style={styles.divider}><View style={styles.hole}/><View style={styles.dashLine}/><View style={styles.hole}/></View>
                <View style={styles.details}><View style={styles.detail}><Ionicons name="calendar-outline" size={16} color="#6B7280"/><Text style={styles.detailTxt}>{ticket.date}</Text></View><View style={styles.detail}><Ionicons name="time-outline" size={16} color="#6B7280"/><Text style={styles.detailTxt}>{ticket.time}</Text></View><View style={styles.detail}><MaterialCommunityIcons name="seat" size={16} color="#6B7280"/><Text style={styles.detailTxt}>{ticket.seat}</Text></View><View style={styles.price}><Text style={styles.priceTxt}>{ticket.price}</Text><Text style={styles.priceCur}>FCFA</Text></View></View>
              </View>
              <View style={styles.actions}><TouchableOpacity style={styles.actionBtn} onPress={()=>setQrTicket(ticket)}><Ionicons name="qr-code" size={18} color={ticket.color}/><Text style={[styles.actionTxt,{color:ticket.color}]}>QR</Text></TouchableOpacity><TouchableOpacity style={styles.actionBtn} onPress={()=>downloadTicket(ticket)}><Ionicons name="download-outline" size={18} color="#6B7280"/><Text style={styles.actionTxt}>PDF</Text></TouchableOpacity><TouchableOpacity style={styles.actionBtn} onPress={()=>openMap(ticket)}><Ionicons name="navigate-outline" size={16} color="#6B7280"/><Text style={styles.actionTxt}>Itinéraire</Text></TouchableOpacity><TouchableOpacity style={[styles.actionBtn,styles.primaryAction]} onPress={()=>setQrTicket(ticket)}><Text style={styles.primaryTxt}>Détails</Text></TouchableOpacity></View>
            </View>
          ))}
        </ScrollView>
      </ImageBackground>

      <Modal visible={!!qrTicket} transparent animationType="fade" onRequestClose={()=>setQrTicket(null)}>
        <View style={styles.modalBg}><View style={styles.modal}><TouchableOpacity style={styles.close} onPress={()=>setQrTicket(null)}><Ionicons name="close" size={20} color="#111"/></TouchableOpacity><Text style={styles.modalTitle}>{qrTicket?.from} → {qrTicket?.to}</Text><Text style={styles.modalSub}>{qrTicket?.code} • {qrTicket?.date} {qrTicket?.time}</Text><View style={styles.modalGare}><Text style={styles.modalGareLabel}>Gare</Text><Text style={styles.modalGareName}>{qrTicket?.gare}</Text><Text style={styles.modalGareAddr}>{qrTicket?.gareAdresse}</Text></View>{qrTicket && <Image source={{uri:`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrTicket.code}`}} style={{width:220,height:220,borderRadius:12,marginVertical:14}}/>}<View style={{flexDirection:'row',gap:10}}><TouchableOpacity onPress={()=>qrTicket && downloadTicket(qrTicket)} style={[styles.buyBtn,{flex:1}]}><LinearGradient colors={['#7C3AED','#6D28D9']} style={styles.buyBtnGrad}><Ionicons name="download" size={16} color="#FFF"/><Text style={[styles.buyBtnTxt,{marginLeft:6}]}>PDF</Text></LinearGradient></TouchableOpacity><TouchableOpacity onPress={()=>qrTicket && openMap(qrTicket)} style={[styles.buyBtn,{flex:1,backgroundColor:'#F3F4F6'}]}><View style={[styles.buyBtnGrad,{backgroundColor:'#F3F4F6'}]}><Ionicons name="map" size={16} color="#111"/><Text style={[styles.buyBtnTxt,{color:'#111',marginLeft:6}]}>Carte</Text></View></TouchableOpacity></View></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' }, header: { paddingBottom: 0 }, headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }, headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 }, tabs: { flexDirection: 'row', paddingHorizontal: 20 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' }, tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }, tabActive: { color: '#FFF' }, tabLine: { position: 'absolute', bottom: 0, width: '70%', height: 3, backgroundColor: '#FFF', borderTopLeftRadius: 2, borderTopRightRadius: 2 }, bg: { flex: 1 }, scroll: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }, emptyIcon: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, emptyRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#E5E7EB', borderTopColor: '#DC2626', borderRightColor: '#DC2626', transform: [{rotate: '-45deg'}] }, emptyArrow: { transform: [{rotate: '45deg'}] }, emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 }, emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 30 }, buyBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' }, buyBtnGrad: { paddingHorizontal: 18, paddingVertical: 12, flexDirection:'row', alignItems:'center', justifyContent:'center' }, buyBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  ticketCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' }, ticketHeader: { padding: 16 }, ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, companyName: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }, ticketCode: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 1 }, statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusTxt: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }, ticketBody: { padding: 16 }, route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, city: { flex: 1 }, cityLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 }, cityName: { fontSize: 16, fontWeight: '800', color: '#111827' }, gare: { fontSize: 11, color: '#6B7280', marginTop: 2 }, routeLine: { alignItems: 'center', paddingHorizontal: 12 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' }, line: { width: 1, height: 18, backgroundColor: '#E5E7EB', marginVertical: 2 },
  gareBox:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#F9FAFB',borderWidth:1,borderColor:'#F3F4F6',borderRadius:10,padding:10,marginTop:12}, gareLabel:{fontSize:9,color:'#9CA3AF',fontWeight:'700',letterSpacing:0.5}, gareName:{fontSize:12,fontWeight:'800',marginTop:2}, gareAddr:{fontSize:11,color:'#6B7280',marginTop:1}, mapBtn:{flexDirection:'row',gap:4,backgroundColor:'#FFF',borderWidth:1,borderColor:'#E5E7EB',paddingHorizontal:10,paddingVertical:6,borderRadius:8,alignItems:'center'}, mapBtnT:{fontSize:11,fontWeight:'700'},
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, marginHorizontal: -16 }, hole: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F9FAFB' }, dashLine: { flex: 1, height: 1, borderStyle: 'dashed', borderTopWidth: 1, borderColor: '#E5E7EB' }, details: { flexDirection: 'row', alignItems: 'center', gap: 12 }, detail: { flexDirection: 'row', alignItems: 'center', gap: 4 }, detailTxt: { fontSize: 12, color: '#374151', fontWeight: '600' }, price: { marginLeft: 'auto', alignItems: 'flex-end' }, priceTxt: { fontSize: 16, fontWeight: '900', color: '#111827' }, priceCur: { fontSize: 9, color: '#6B7280', fontWeight: '600' }, actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 10, gap: 6 }, actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F9FAFB' }, actionTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' }, primaryAction: { backgroundColor: '#7C3AED15', marginLeft: 'auto' }, primaryTxt: { color: '#7C3AED', fontWeight: '700', fontSize: 12 },
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'center',alignItems:'center',padding:20}, modal:{backgroundColor:'#FFF',borderRadius:20,padding:18,width:'100%',alignItems:'center'}, close:{position:'absolute',top:10,right:10,width:32,height:32,borderRadius:16,backgroundColor:'#F3F4F6',justifyContent:'center',alignItems:'center'}, modalTitle:{fontWeight:'800',fontSize:15,marginTop:8}, modalSub:{color:'#6B7280',fontSize:11,marginTop:4,textAlign:'center'}, modalGare:{backgroundColor:'#F9FAFB',borderRadius:10,padding:10,width:'100%',marginTop:10,borderWidth:1,borderColor:'#F3F4F6'}, modalGareLabel:{fontSize:9,color:'#9CA3AF',fontWeight:'700'}, modalGareName:{fontWeight:'800',fontSize:13,marginTop:2}, modalGareAddr:{fontSize:11,color:'#6B7280',marginTop:1}
});