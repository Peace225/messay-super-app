import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CallCenterScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#EC4899', '#DB2777']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.title}>Centre d'appel</Text>
            <View style={{width:24}} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconCircle}><Ionicons name="call" size={32} color="#EC4899" /></View>
          <Text style={styles.bigNum}>+225 07 89 66 39 26</Text>
          <Text style={styles.sub}>Disponible 24h/7j</Text>
          
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:+2250789663926')}>
            <LinearGradient colors={['#EC4899', '#DB2777']} style={styles.callGrad}>
              <Ionicons name="call" size={20} color="#FFF" />
              <Text style={styles.callTxt}>Appeler maintenant</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 20 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 24 },
  content: { flex: 1, padding: 20, marginTop: -10 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 30, alignItems: 'center', elevation: 4 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FCE7F3', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  bigNum: { fontSize: 24, fontWeight: '900', color: '#111827' },
  sub: { color: '#6B7280', marginTop: 4, marginBottom: 24 },
  callBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  callGrad: { flexDirection: 'row', paddingVertical: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  callTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});