import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function FeedbackScreen() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#10B981', '#059669']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.title}>Retours client</Text>
            <View style={{width:24}} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.question}>Comment était votre voyage ?</Text>
          <View style={styles.stars}>
            {[1,2,3,4,5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={40} color="#F59E0B" style={{marginHorizontal: 4}} />
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Votre commentaire</Text>
          <TextInput value={comment} onChangeText={setComment} placeholder="Dites-nous tout..." multiline style={styles.textarea} placeholderTextColor="#9CA3AF" />
          
          <TouchableOpacity style={styles.sendBtn} onPress={() => Alert.alert('Merci', 'Votre avis a été envoyé')}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.sendGrad}>
              <Text style={styles.sendTxt}>Envoyer mon avis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 20 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 24 },
  content: { flex: 1, marginTop: -10, padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  question: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20, textAlign: 'center' },
  stars: { flexDirection: 'row', marginBottom: 30 },
  label: { alignSelf: 'flex-start', fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  textarea: { width: '100%', height: 120, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15, marginBottom: 20 },
  sendBtn: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  sendGrad: { paddingVertical: 14, alignItems: 'center' },
  sendTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});