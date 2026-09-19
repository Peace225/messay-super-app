import { View, Text, TouchableOpacity, Share, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ShareScreen() {
  const router = useRouter();
  const share = async () => {
    try { await Share.share({message:'Découvre TicketCI - Réserve tes billets de bus facilement ! https://ticketci.app'}); } catch {}
  };
  return (
    <View style={{flex:1, backgroundColor:'#F9FAFB'}}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0EA5E9','#0284C7']} style={{paddingBottom:30}}>
        <SafeAreaView><View style={{flexDirection:'row', padding:20}}><TouchableOpacity onPress={()=>router.back()}><Ionicons name="arrow-back" size={24} color="#FFF"/></TouchableOpacity><Text style={{color:'#FFF',fontSize:18,fontWeight:'700',flex:1,textAlign:'center',marginRight:24}}>Partager</Text></View></SafeAreaView>
      </LinearGradient>
      <View style={{padding:20, marginTop:-10}}><View style={{backgroundColor:'#FFF',borderRadius:20,padding:30,alignItems:'center'}}><View style={{width:80,height:80,borderRadius:40,backgroundColor:'#E0F2FE',justifyContent:'center',alignItems:'center',marginBottom:16}}><Ionicons name="gift" size={36} color="#0EA5E9"/></View><Text style={{fontSize:20,fontWeight:'800',marginBottom:8}}>Parraine tes amis</Text><Text style={{color:'#6B7280',textAlign:'center',marginBottom:24}}>Gagne 500 FCFA parrainage</Text><TouchableOpacity onPress={share} style={{width:'100%'}}><LinearGradient colors={['#0EA5E9','#0284C7']} style={{paddingVertical:14,borderRadius:12,alignItems:'center'}}><Text style={{color:'#FFF',fontWeight:'800'}}>Partager l'application</Text></LinearGradient></TouchableOpacity></View></View>
    </View>
  );
}