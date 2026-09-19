import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <View style={{flex:1, backgroundColor:'#F9FAFB'}}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#6366F1','#4F46E5']} style={{paddingBottom:20}}>
        <SafeAreaView>
          <View style={{flexDirection:'row', alignItems:'center', padding:20}}>
            <TouchableOpacity onPress={()=>router.back()}><Ionicons name="arrow-back" size={24} color="#FFF"/></TouchableOpacity>
            <Text style={{color:'#FFF', fontSize:18, fontWeight:'700', flex:1, textAlign:'center', marginRight:24}}>Termes et conditions</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView style={{padding:20}}>
        <View style={{backgroundColor:'#FFF', borderRadius:16, padding:20}}>
          <Text style={{fontSize:15, lineHeight:24, color:'#374151'}}>
            1. Réservation{'\n'}Les billets sont nominatifs et non remboursables.{'\n\n'}2. Annulation{'\n'}Possible jusqu'à 24h avant départ.{'\n\n'}3. Bagages{'\n'}20kg maximum par passager.{'\n\n'}4. Retard{'\n'}Présentez-vous 30min avant.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}