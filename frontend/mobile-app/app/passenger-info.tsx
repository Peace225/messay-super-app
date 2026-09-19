import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PassengerInfo(){
  const { depart, destination, date, heure, duree, prix, company, color, companyId, destinationId, gare, gareId, seats, total, siege_auto } = useLocalSearchParams();
  const companyColor = (color as string)||'#0B4DA1';
  const router = useRouter();

  const [nom,setNom]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [piece,setPiece]=useState('');

  const isAutoSeat = String(siege_auto)==='true';
  const seatList = useMemo(()=>{
    const s = String(seats||'1').trim();
    if(!s || s==='auto') return ['1'];
    return s.split(',').map(x=>x.trim()).filter(Boolean);
  },[seats]);

  const totalNum = useMemo(()=> parseInt(String(total||prix||'0').replace(/[^0-9]/g,''))||0,[total,prix]);
  const unitPrice = useMemo(()=> parseInt(String(prix||'0').replace(/[^0-9]/g,''))|| totalNum,[prix,totalNum]);

  const validate = ()=>{
    const n = nom.trim();
    if(n.length<3) { Alert.alert('Nom invalide','Entre ton nom complet (min 3 lettres)'); return false; }
    const ph = phone.replace(/\s/g,'');
    if(ph.length<10 || !/^[0-9+]+$/.test(ph)){ Alert.alert('Téléphone invalide','Ex: 07 08 12 34 56 / +225...'); return false; }
    if(email.trim().length>0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){ Alert.alert('Email invalide','Vérifie ton email'); return false; }
    return true;
  };

  const onNext=()=>{
    if(!validate()) return;
    router.push({
      pathname:'/checkout',
      params:{
        depart: String(depart||''),
        destination: String(destination||''),
        date: String(date||''),
        heure: String(heure||''),
        duree: String(duree||''),
        prix: String(unitPrice),
        company: String(company||''),
        color: companyColor,
        companyId: String(companyId||''),
        destinationId: String(destinationId||''),
        gare: String(gare||''),
        gareId: String(gareId||''),
        seats: seatList.join(','),
        total: String(totalNum),
        nom: nom.trim(),
        phone: phone.trim(),
        email: email.trim(),
        piece: piece.trim(),
        siege_auto: isAutoSeat ? 'true' : 'false'
      }
    } as any);
  };

  const canContinue = nom.trim().length>=3 && phone.trim().length>=10;

  return(
    <View style={s.c}>
      <StatusBar barStyle="light-content" backgroundColor={companyColor}/>
      <LinearGradient colors={[companyColor,companyColor]} style={s.h}>
        <SafeAreaView edges={['top']}>
          <View style={s.hb}>
            <TouchableOpacity onPress={()=>router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color="#FFF"/></TouchableOpacity>
            <Text style={s.ht}>Infos passager</Text>
            <View style={{width:24}}/>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={{padding:16, paddingBottom:140}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Résumé */}
        <View style={s.summary}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={s.sumTitle}>{depart} → {destination}</Text>
            <View style={[s.badge,{backgroundColor:companyColor+'18',borderColor:companyColor+'30'}]}><Text style={[s.badgeT,{color:companyColor}]}>{company as string}</Text></View>
          </View>
          <Text style={s.sumSub}>{date} • {heure} • {duree||'Trajet direct'}</Text>
          <Text style={s.sumSub} numberOfLines={1}><Ionicons name="location" size={11} color="#6B7280"/> {gare as string}</Text>
          <View style={s.divider}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={s.placeTxt}>
              {isAutoSeat ? '1 place • Placement libre' : `${seatList.length} place(s) • Sièges ${seatList.join(', ')}`}
            </Text>
            <Text style={[s.total,{color:companyColor}]}>{totalNum.toLocaleString('fr-FR')} F</Text>
          </View>
          {unitPrice!==totalNum && <Text style={s.unit}>Prix unitaire {unitPrice.toLocaleString('fr-FR')} F</Text>}
        </View>

        <Text style={s.label}>Nom complet *</Text>
        <TextInput value={nom} onChangeText={setNom} placeholder="Kouamé Jean" placeholderTextColor="#9CA3AF" autoCapitalize="words" returnKeyType="next" style={[s.input, nom.trim().length>=3 && s.inputOk]}/>

        <Text style={s.label}>Téléphone WhatsApp *</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="07 08 12 34 56" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={16} style={[s.input, phone.trim().length>=10 && s.inputOk]}/>

        <Text style={s.label}>Email (optionnel, pour reçu)</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="jean@email.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={s.input}/>

        <Text style={s.label}>N° Pièce d'identité (optionnel)</Text>
        <TextInput value={piece} onChangeText={setPiece} placeholder="CNI / Passeport" placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={s.input}/>

        <View style={s.infoBox}><Ionicons name="shield-checkmark" size={14} color="#059669"/><Text style={s.infoBoxT}>Tes infos servent uniquement pour le billet et la vérification à l'embarquement.</Text></View>
      </ScrollView>

      <View style={s.bottom}>
        <View style={{flex:1}}>
          <Text style={s.bottomLabel}>Total à payer</Text>
          <Text style={[s.bottomTotal,{color:companyColor}]}>{totalNum.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <TouchableOpacity style={[s.btn,{backgroundColor:companyColor, opacity: canContinue?1:0.45}]} disabled={!canContinue} onPress={onNext} activeOpacity={0.9}>
          <Text style={s.btnT}>Continuer vers paiement</Text><Ionicons name="arrow-forward" size={16} color="#FFF"/>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s=StyleSheet.create({
  c:{flex:1,backgroundColor:'#F8F9FA'}, h:{paddingBottom:14,borderBottomLeftRadius:18,borderBottomRightRadius:18}, hb:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:8}, ht:{color:'#FFF',fontWeight:'900',fontSize:16},
  summary:{backgroundColor:'#FFF',borderRadius:18,padding:16,borderWidth:1,borderColor:'#E5E7EB',marginBottom:18,elevation:2,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:8}, sumTitle:{fontWeight:'900',fontSize:16,color:'#111'}, badge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8,borderWidth:1}, badgeT:{fontSize:10,fontWeight:'800'}, sumSub:{fontSize:12,color:'#6B7280',marginTop:5}, divider:{height:1,backgroundColor:'#F3F4F6',marginVertical:12}, placeTxt:{fontSize:12,color:'#374151',fontWeight:'600'}, total:{fontWeight:'900',fontSize:18}, unit:{fontSize:10,color:'#9CA3AF',marginTop:2,textAlign:'right'},
  label:{fontSize:12,fontWeight:'800',marginTop:14,marginBottom:7,color:'#111827'}, input:{backgroundColor:'#FFF',borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:14,height:50,paddingHorizontal:14,fontWeight:'600',fontSize:14,color:'#111'}, inputOk:{borderColor:'#10B981',backgroundColor:'#F0FDF4'},
  infoBox:{flexDirection:'row',gap:8,backgroundColor:'#ECFDF5',borderWidth:1,borderColor:'#BBF7D0',padding:10,borderRadius:12,marginTop:16,alignItems:'flex-start'}, infoBoxT:{flex:1,fontSize:11,color:'#065F46',lineHeight:15},
  bottom:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFF',padding:16,borderTopWidth:1,borderTopColor:'#E5E7EB',flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12}, bottomLabel:{fontSize:10,color:'#9CA3AF',fontWeight:'700',textTransform:'uppercase'}, bottomTotal:{fontSize:18,fontWeight:'900'}, btn:{height:52,borderRadius:14,justifyContent:'center',alignItems:'center',flexDirection:'row',gap:8,paddingHorizontal:20,elevation:2}, btnT:{color:'#FFF',fontWeight:'900',fontSize:14}
});