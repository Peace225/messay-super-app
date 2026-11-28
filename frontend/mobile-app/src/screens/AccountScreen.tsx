import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * L'ancien écran affichait un solde et des opérations bancaires fictifs.
 * Tant qu'un compte financier utilisateur vérifié côté serveur n'existe pas,
 * il est interdit d'afficher des montants comme s'ils étaient réels.
 */
export default function AccountScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Mon compte MESSAY</Text>
        <Text style={styles.description}>
          Le solde et l’historique des transactions ne sont pas encore disponibles.
          Les anciens montants de démonstration ont été retirés.
        </Text>
        <Text style={styles.notice}>
          Aucun paiement ni recharge ne peut être effectué depuis cette page.
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Retourner à l’application MESSAY"
        >
          <Text style={styles.buttonText}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  description: { fontSize: 16, lineHeight: 24, color: '#334155' },
  notice: { fontSize: 14, lineHeight: 21, color: '#64748B' },
  button: { backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
