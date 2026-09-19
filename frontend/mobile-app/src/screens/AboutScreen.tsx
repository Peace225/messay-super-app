import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AboutScreen() {
  const router = useRouter();
  return (
    <View style={{flex:1, backgroundColor:'#F9FAFB'}}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#14B8A6','#0D9488']} style={{paddingBottom:40}}>
        <SafeAreaView>
          <View style={{flexDirection:'row', padding:20}}><TouchableOpacity onPress={()=>router.back()}><Ionicons name="arrow-back" size={24} color="#FFF"/></TouchableOpacity></View>
          <View style={{alignItems:'center'}}><View style={{width:80,height:80,borderRadius:20,backgroundColor:'rgba(255,255,255,0.2)',justifyContent:'center',alignItems:'center'}}><FontAwesome5 name="bus" size={36} color="#FFF"/></View><Text style={{color:'#FFF',fontSize:24,fontWeight:'900',marginTop:12}}>TicketCI</Text><Text style={{color:'rgba(255,255,255,0.8)'}}>Version 1.0.0</Text></View>
        </SafeAreaView>
      </LinearGradient>
      <View style={{padding:20, marginTop:-20}}><View style={{backgroundColor:'#FFF',borderRadius:16,padding:20}}><Text style={{textAlign:'center',color:'#6B7280',lineHeight:22}}>Application officielle de réservation de tickets de bus en Côte d'Ivoire.</Text></View></View>
    </View>
  );
}