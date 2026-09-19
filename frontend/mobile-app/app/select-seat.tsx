import { supabase } from '../src/services/supabase';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Seat = { n:number; status:'free'|'busy'|'selected' };

export default function SelectSeatScreen(){
  const { depart, destination, date, heure, duree, prix, company, color, companyId, destinationId, gare } = useLocalSearchParams();
  const companyColor = (color as string) || '#FF6B35';
  const price = parseInt(prix as string) || 5000;
  const router = useRouter();

  const [seats,setSeats] = useState<Seat[]>([]);
  const [loading,setLoading]=useState(true);

  // Génère 40 sièges 2+2
  const initSeats = useMemo(()=> Array.from({length:40},(_,i)=>({ n:i+1, status:'free' as const })),[]);

  useEffect(()=>{ (async()=>{
    let busyNumbers:number[] = [];
    try{
      // Essaie de charger les places déjà vendues si tu as une table tickets/reservations
      // Adapte le nom de la table si c'est 'billets'
      const { data } = await supabase.from('tickets').select('sieges').eq('destination_id', destinationId as string).eq('date_voyage', date as string).eq('heure_depart', (heure as string)?.slice(0,5));
      if(data && data.length>0){
        data.forEach((r:any)=>{ const s = Array.isArray(r.sieges)? r.sieges : String(r.sieges||'').split(',').map(Number); busyNumbers.push(...s); });
      }else{
        // Fallback random 30% occupé pour demo
        busyNumbers = Array.from({length:12},()=>Math.floor(Math.random()*40)+1);
      }
    }catch{ busyNumbers = [3,4,9,12,18,22,27,33]; }

    const mapped = initSeats.map(s=> ({ ...s, status: busyNumbers.includes(s.n) ? 'busy' as const : 'free' as const }));
    setSeats(mapped); setLoading(false);
  })(); },[]);

  const toggle = (n:number)=>{
    setSeats(prev=> prev.map(s=>{
      if(s.n!==n) return s;
      if(s.status==='busy') return s;
      if(s.status==='selected') return { ...s, status:'free' as const };
      const selectedCount = prev.filter(x=>x.status==='selected').length;
      if(selectedCount>=5){ Alert.alert('Max 5 places'); return s; }
      return { ...s, status:'selected' as const };
    }));
  };

  const selected = seats.filter(s=>s.status==='selected').map(s=>s.n);
  const total = selected.length * price;

  const onContinue = ()=>{
    if(selected.length===0) return Alert.alert('Choisis au moins 1 place');
    router.push({
      pathname: '/passenger-info',
      params:{
        depart: depart as string,
        destination: destination as string,
        date: date as string,
        heure: heure as string,
        duree: duree as string,
        prix: String(price),
        company: company as string,
        color: companyColor,
        companyId: companyId as string,
        destinationId: destinationId as string,
        gare: gare as string,
        seats: selected.join(','),
        total: String(total)
      }
    });
  };

  const renderRow = (rowIndex:number)=>{
    const start = rowIndex*4;
    const rowSeats = seats.slice(start, start+4);
    if(rowSeats.length===0) return null;
    return (
      <View key={`row-${rowIndex}`} style={s.row}>
        <View style={s.side}>
          <SeatItem s={rowSeats[0]} onPress={toggle} color={companyColor}/>
          <SeatItem s={rowSeats[1]} onPress={toggle} color={companyColor}/>
        </View>
        <View style={s.aisle}><Text style={s.rowNum}>{rowIndex+1}</Text></View>
        <View style={s.side}>
          <SeatItem s={rowSeats[2]} onPress={toggle} color={companyColor}/>
          <SeatItem s={rowSeats[3]} onPress={toggle} color={companyColor}/>
        </View>
      </View>
    );
  };

  return (
    <View style={s.c}>
      <StatusBar barStyle="light-content" backgroundColor={companyColor}/>
      <LinearGradient colors={[companyColor,companyColor]} style={s.h}>
        <SafeAreaView edges={['top']}>
          <View style={s.hb}>
            <TouchableOpacity onPress={()=>router.back()}><Ionicons name="chevron-back" size={24} color="#FFF"/></TouchableOpacity>
            <Text style={s.ht}>Choisir vos places</Text>
            <View style={{width:24}}/>
          </View>
          <View style={s.info}><Text style={s.infoT}>{depart} → {destination}</Text><Text style={s.infoSub}>{date} • {heure} • {duree} • {gare as string}</Text></View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{padding:16, paddingBottom:140}}>
        {/* Légende */}
        <View style={s.legend}>
          <View style={s.leg}><View style={[s.boxLeg,{backgroundColor:'#FFF',borderColor:'#E5E7EB'}]}/><Text style={s.legT}>Libre</Text></View>
          <View style={s.leg}><View style={[s.boxLeg,{backgroundColor:companyColor}]}/><Text style={s.legT}>Sélectionné</Text></View>
          <View style={s.leg}><View style={[s.boxLeg,{backgroundColor:'#D1D5DB'}]}/><Text style={s.legT}>Occupé</Text></View>
        </View>

        {/* Bus */}
        <View style={s.bus}>
          <View style={s.driverRow}><View style={s.steering}><Ionicons name="car-sport" size={18} color="#6B7280"/></View><Text style={s.driverTxt}>Chauffeur</Text><MaterialCommunityIcons name="door" size={18} color="#9CA3AF"/></View>
          <View style={s.divider}/>
          {!loading && Array.from({length:10}).map((_,i)=>renderRow(i))}
        </View>
      </ScrollView>

      {/* Bottom */}
      <View style={s.bottom}>
        <View><Text style={s.selTxt}>{selected.length? `${selected.length} place(s): ${selected.join(', ')}` : 'Aucune place sélectionnée'}</Text><Text style={s.total}>{total>0? `${total.toLocaleString()} FCFA` : '0 FCFA'}</Text></View>
        <TouchableOpacity style={[s.btn,{backgroundColor:companyColor, opacity: selected.length?1:0.4}]} disabled={selected.length===0} onPress={onContinue}><Text style={s.btnT}>Continuer</Text><Ionicons name="arrow-forward" size={16} color="#FFF" style={{marginLeft:6}}/></TouchableOpacity>
      </View>
    </View>
  );
}

function SeatItem({s,onPress,color}:{s:Seat,onPress:(n:number)=>void,color:string}){
  const isBusy = s.status==='busy'; const isSel = s.status==='selected';
  return (
    <TouchableOpacity disabled={isBusy} onPress={()=>onPress(s.n)} style={[st.seat, isBusy&&st.busy, isSel&&{backgroundColor:color, borderColor:color}]}>
      <Ionicons name={isBusy?'close':'person'} size={14} color={isSel? '#FFF' : isBusy? '#9CA3AF' : '#6B7280'}/>
      <Text style={[st.num, isSel&&{color:'#FFF'}, isBusy&&{color:'#9CA3AF'}]}>{s.n}</Text>
    </TouchableOpacity>
  );
}

const s=StyleSheet.create({
  c:{flex:1,backgroundColor:'#F8F9FA'}, h:{paddingBottom:12}, hb:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:8}, ht:{color:'#FFF',fontWeight:'800',fontSize:16}, info:{alignItems:'center',marginTop:8}, infoT:{color:'#FFF',fontWeight:'700',fontSize:13}, infoSub:{color:'rgba(255,255,255,0.85)',fontSize:11,marginTop:2},
  legend:{flexDirection:'row',justifyContent:'center',gap:16,marginBottom:12}, leg:{flexDirection:'row',alignItems:'center',gap:6}, boxLeg:{width:14,height:14,borderRadius:4,borderWidth:1}, legT:{fontSize:11,color:'#6B7280'},
  bus:{backgroundColor:'#FFF',borderRadius:20,padding:16,borderWidth:1,borderColor:'#E5E7EB',elevation:3}, driverRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}, steering:{width:32,height:32,borderRadius:8,backgroundColor:'#F3F4F6',justifyContent:'center',alignItems:'center'}, driverTxt:{fontSize:11,color:'#6B7280',fontWeight:'600'}, divider:{height:1,backgroundColor:'#F3F4F6',marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}, side:{flexDirection:'row',gap:8}, aisle:{width:30,alignItems:'center'}, rowNum:{fontSize:10,color:'#9CA3AF'},
  bottom:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#E5E7EB',padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, selTxt:{fontSize:12,color:'#6B7280'}, total:{fontSize:16,fontWeight:'900',marginTop:2}, btn:{flexDirection:'row',paddingHorizontal:22,paddingVertical:12,borderRadius:12,alignItems:'center'}, btnT:{color:'#FFF',fontWeight:'800'}
});
const st=StyleSheet.create({
  seat:{width:52,height:44,borderRadius:10,borderWidth:1.5,borderColor:'#E5E7EB',backgroundColor:'#FFF',flexDirection:'row',justifyContent:'center',alignItems:'center',gap:4}, busy:{backgroundColor:'#F3F4F6',borderColor:'#E5E7EB'}, num:{fontSize:11,fontWeight:'700',color:'#374151'}
});