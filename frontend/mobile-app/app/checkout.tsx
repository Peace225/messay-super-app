import { supabase } from '../src/services/supabase';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Checkout(){
  const p = useLocalSearchParams(); const router=useRouter();
  const color = (p.color as string)||'#FF6B35';
  const [method,setMethod]=useState('wave'); const [loading,setLoading]=useState(false);

  const pay = async()=>{
    setLoading(true);
    try{
      // 1. Crée le billet dans Supabase (adapte le nom de table si 'reservations')
      const { data, error } = await supabase.from('tickets').insert({
        company_id: p.companyId || null,
        destination_id: p.destinationId || null,
        depart: p.depart, destination: p.destination,
        date_voyage: p.date, heure_depart: p.heure,
        sieges: (p.seats as string)?.split(',').map(Number),
        prix_total: parseInt(p.total as string),
        nom_passager: p.nom, telephone: p.phone, email: p.email,
        statut: 'payé'
      }).select().single();
      if(error) throw error;

      router.replace({ pathname:'/ticket', params:{ ...p, ticketId: data?.id || 'MESS-'+Date.now(), ref: 'UTB'+Math.floor(100000+Math.random()*900000) }});
    }catch(e:any){
      // Fallback demo sans DB
      router.replace({ pathname:'/ticket', params:{ ...p, ticketId:'DEMO-'+Date.now(), ref:'UTB'+Math.floor(100000+Math.random()*900000) }});
    }finally{ setLoading(false); }
  };

  return(
    <View style={s.c}>
      <StatusBar barStyle="light-content" backgroundColor={color}/>
      <LinearGradient colors={[color,color]} style={s.h}><SafeAreaView edges={['top']}><View style={s.hb}><TouchableOpacity onPress={()=>router.back()}><Ionicons name="chevron-back" size={24} color="#FFF"/></TouchableOpacity><Text style={s.ht}>Paiement</Text><View style={{width:24}}/></View></SafeAreaView></LinearGradient>
      <ScrollView contentContainerStyle={{padding:16}}>
        <View style={s.card}><Text style={s.row}><Text style={s.bold}>Trajet:</Text> {p.depart} → {p.destination}</Text><Text style={s.row}><Text style={s.bold}>Date:</Text> {p.date} {p.heure}</Text><Text style={s.row}><Text style={s.bold}>Places:</Text> {p.seats}</Text><Text style={s.row}><Text style={s.bold}>Passager:</Text> {p.nom} ({p.phone})</Text><View style={s.div}/><Text style={s.total}>{p.total} FCFA</Text></View>

        <Text style={s.title}>Méthode de paiement</Text>
        {[
          {id:'wave',label:'Wave',icon:'phone-portrait'},
          {id:'orange',label:'Orange Money',icon:'wallet'},
          {id:'mtn',label:'MTN MoMo',icon:'cash'},
          {id:'moov',label:'Moov Money',icon:'card'},
        ].map(m=>(
          <TouchableOpacity key={m.id} onPress={()=>setMethod(m.id)} style={[s.meth, method===m.id&&{borderColor:color,backgroundColor:color+'12'}]}><Ionicons name={m.icon as any} size={18} color={method===m.id?color:'#6B7280'}/><Text style={[s.methT, method===m.id&&{color}]}>{m.label}</Text>{method===m.id&&<Ionicons name="checkmark-circle" size={18} color={color} style={{marginLeft:'auto'}}/>}</TouchableOpacity>
        ))}
      </ScrollView>
      <View style={s.bottom}><TouchableOpacity disabled={loading} onPress={pay} style={[s.btn,{backgroundColor:color}]}>{loading?<ActivityIndicator color="#FFF"/>:<Text style={s.btnT}>Payer {p.total} FCFA</Text>}</TouchableOpacity></View>
    </View>
  );
}
const s=StyleSheet.create({
  c:{flex:1,backgroundColor:'#F8F9FA'}, h:{paddingBottom:14}, hb:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:16,paddingTop:8}, ht:{color:'#FFF',fontWeight:'800'},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:14,borderWidth:1,borderColor:'#E5E7EB'}, row:{marginBottom:6}, bold:{fontWeight:'700'}, div:{height:1,backgroundColor:'#F3F4F6',marginVertical:10}, total:{fontWeight:'900',fontSize:18},
  title:{fontWeight:'800',marginTop:16,marginBottom:8}, meth:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#FFF',borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:12,padding:14,marginBottom:8}, methT:{fontWeight:'600'},
  bottom:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFF',padding:16,borderTopWidth:1,borderTopColor:'#E5E7EB'}, btn:{height:50,borderRadius:12,justifyContent:'center',alignItems:'center'}, btnT:{color:'#FFF',fontWeight:'800'}
});