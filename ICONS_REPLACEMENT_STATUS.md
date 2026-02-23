# Remplacement des Emojis par des Icônes FontAwesome

## Date : 23 février 2026

## ✅ Fichiers complétés

### 1. HomeScreen.tsx
- ✅ Logo 🚀 → FontAwesome5 "rocket"
- ✅ Étoile ✨ → FontAwesome5 "star"
- ✅ Salutations (☀️🌤️🌙) → FontAwesome5 "sun", "cloud-sun", "moon"
- ✅ Bouton connexion 👤 → Ionicons "person"
- ✅ Tricycle 🛺 → FontAwesome5 "motorcycle"
- ✅ Nuages ☁️ → Ionicons "cloud"
- ✅ Services:
  - Tricycle 🛺 → FontAwesome5 "motorcycle"
  - Transport 🚌 → FontAwesome5 "bus"
  - Événements 🎟️ → FontAwesome5 "ticket-alt"
  - BTP 🚜 → FontAwesome5 "truck"
- ✅ Promotion 🎉 → FontAwesome5 "gift"

### 2. ProfileScreen.tsx
- ✅ Mode invité 👤 → FontAwesome5 "user-circle"
- ✅ Modifier profil 📝 → FontAwesome5 "edit"
- ✅ Mes courses 🚗 → FontAwesome5 "car"
- ✅ Paiement 💳 → FontAwesome5 "credit-card"
- ✅ Tickets 🎟️ → FontAwesome5 "ticket-alt"
- ✅ BTP 🚜 → FontAwesome5 "truck"
- ✅ Notifications 🔔 → FontAwesome5 "bell"
- ✅ Langue 🌍 → FontAwesome5 "globe"
- ✅ Support ❓ → FontAwesome5 "question-circle"
- ✅ Flèches › → MaterialIcons "chevron-right"

### 3. TicketsScreen.tsx (Partiel)
- ✅ Compagnies:
  - UTB 🚌 → FontAwesome5 "bus"
  - STA 🚍 → FontAwesome5 "bus-alt"
  - RVS 🚐 → FontAwesome5 "shuttle-van"

### 4. Composant Icon.tsx
- ✅ Créé un composant réutilisable pour gérer les icônes

## 🔄 Fichiers à compléter

### SupportScreen.tsx
Types de demande à remplacer :
- 🔧 → FontAwesome5 "wrench"
- 🔍 → FontAwesome5 "search"
- ⚖️ → FontAwesome5 "balance-scale"
- ❓ → FontAwesome5 "question-circle"
- 💬 → FontAwesome5 "comments"
- Chat 💬 → FontAwesome5 "comments"

### PaiementScreen.tsx
Moyens de paiement à remplacer :
- 💳 → FontAwesome5 "credit-card"
- 🟠 → FontAwesome5 "circle" (couleur orange)
- 🟡 → FontAwesome5 "circle" (couleur jaune)
- 🌊 → FontAwesome5 "water"
- 💵 → FontAwesome5 "money-bill-wave"

### BTPScreen.tsx
Matériaux à remplacer :
- 🏖️ → FontAwesome5 "mountain"
- 🪨 → FontAwesome5 "cube"
- 🏗️ → FontAwesome5 "building"
- ⚙️ → FontAwesome5 "cog"

Camions à remplacer :
- 🚛 → FontAwesome5 "truck"
- 🚚 → FontAwesome5 "truck-moving"
- 🚐 → FontAwesome5 "shuttle-van"

### CoursesHistoriqueScreen.tsx
- 🛺 → FontAwesome5 "motorcycle" (empty state)

### TicketsHistoriqueScreen.tsx
- 🎟️ → FontAwesome5 "ticket-alt" (empty state)

### BTPHistoriqueScreen.tsx
- 🚜 → FontAwesome5 "truck" (empty state)

### LoginScreen.tsx & RegisterScreen.tsx
- 👁️ / 👁️‍🗨️ → Ionicons "eye" / "eye-off"

## 📝 Modifications nécessaires

### Imports à ajouter
```typescript
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
```

### Remplacement des Text par des icônes
Avant :
```typescript
<Text style={styles.icon}>🚌</Text>
```

Après :
```typescript
<FontAwesome5 name="bus" size={24} color="#FF6B35" />
```

### Styles à supprimer
Tous les styles d'icônes emoji (fontSize) peuvent être supprimés car les icônes FontAwesome utilisent la prop `size`.

## 🎯 Avantages du remplacement

1. **Cohérence visuelle** - Toutes les icônes ont le même style
2. **Personnalisation** - Couleur et taille facilement modifiables
3. **Performance** - Meilleur rendu que les emojis
4. **Compatibilité** - Fonctionne sur tous les appareils
5. **Professionnalisme** - Look plus professionnel et moderne

## 📦 Bibliothèques utilisées

- `@expo/vector-icons` (inclus par défaut avec Expo)
  - FontAwesome5
  - MaterialIcons
  - Ionicons

## 🚀 Prochaines étapes

1. Compléter le remplacement dans tous les fichiers restants
2. Supprimer tous les styles d'icônes emoji inutilisés
3. Tester sur différents appareils
4. Vérifier la cohérence des tailles et couleurs
5. Documenter les icônes utilisées pour chaque contexte
