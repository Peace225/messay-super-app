import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * MESSAY Wallet : aucune validation ou simulation de transaction.
 * Le seul paiement interurbain admissible sera effectué par le parcours
 * serveur GeniusPay, après activation et recette complète.
 */
export default function PaiementScreen() {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>MESSAY Wallet indisponible</Text>
        <Text style={styles.description}>
          Les paiements et crédits de ce service ne sont pas encore activés.
          Aucun paiement n’a été effectué et aucun montant n’a été débité depuis cet écran.
        </Text>
        <Text style={styles.notice}>
          Pour les billets interurbains, la confirmation du paiement et du billet
          doit toujours provenir du serveur MESSAY après vérification GeniusPay.
        </Text>
        <Pressable
          onPress={goBack}
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
