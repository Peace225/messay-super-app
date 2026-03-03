# 🚗 ICÔNES DES VÉHICULES - MESSAY APP

## 📋 Convention des icônes

Pour différencier visuellement les types de véhicules sur les cartes:

---

## 🏍️ CONDUCTEUR (Tricycle)

### Icône
- **FontAwesome5:** `motorcycle`
- **Couleur:** Orange (#FF6B35)
- **Taille:** 24px
- **Fond:** Blanc avec bordure orange

### Utilisation
```tsx
<View style={styles.conducteurMarker}>
  <FontAwesome5 name="motorcycle" size={24} color="#FF6B35" />
</View>
```

### Où l'utiliser
- TricycleScreen (carte des conducteurs disponibles)
- Toute carte montrant des conducteurs de tricycle

---

## 🚚 CHAUFFEUR (Camion BTP)

### Icône
- **FontAwesome5:** `truck`
- **Couleur:** Bleu (#2196F3)
- **Taille:** 24px
- **Fond:** Blanc avec bordure bleue

### Utilisation
```tsx
<View style={styles.chauffeurMarker}>
  <FontAwesome5 name="truck" size={24} color="#2196F3" />
</View>
```

### Où l'utiliser
- BTPScreen (si carte ajoutée pour voir chauffeurs disponibles)
- Toute carte montrant des chauffeurs de camion

---

## 👤 UTILISATEUR (Position actuelle)

### Icône
- **FontAwesome5:** `hand-paper` (main levée)
- **Couleur:** Bleu (#2196F3)
- **Taille:** 20px
- **Fond:** Blanc avec bordure bleue

### Utilisation
```tsx
<View style={styles.currentLocationMarker}>
  <FontAwesome5 name="hand-paper" size={20} color="#2196F3" />
</View>
```

---

## 🎯 DESTINATION

### Icône
- **Marker par défaut** (épingle rouge)
- **Couleur:** Rouge
- **Titre:** "Destination"

---

## 📊 RÉCAPITULATIF

| Type | Icône | Couleur | Utilisation |
|------|-------|---------|-------------|
| Conducteur Tricycle | `motorcycle` | Orange #FF6B35 | TricycleScreen |
| Chauffeur Camion | `truck` | Bleu #2196F3 | BTPScreen (futur) |
| Position utilisateur | `hand-paper` | Bleu #2196F3 | Toutes les cartes |
| Destination | Marker rouge | Rouge | Toutes les cartes |

---

## 🎨 STYLES RECOMMANDÉS

### Marker Conducteur (Tricycle)
```tsx
conducteurMarker: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#FF6B35',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
}
```

### Marker Chauffeur (Camion)
```tsx
chauffeurMarker: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#2196F3',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
}
```

### Marker Position Actuelle
```tsx
currentLocationMarker: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: '#2196F3',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
}
```

---

## 🔄 EXEMPLE: Carte mixte (Conducteurs + Chauffeurs)

Si vous avez besoin d'afficher les deux types sur une même carte:

```tsx
{/* Conducteurs de tricycle */}
{conducteurs.map((conducteur) => (
  <Marker
    key={`conducteur-${conducteur.id}`}
    coordinate={{
      latitude: conducteur.positionLatitude,
      longitude: conducteur.positionLongitude,
    }}
    title={`${conducteur.user.prenom} ${conducteur.user.nom}`}
    description={`Tricycle • Note: ${conducteur.note}/5`}
  >
    <View style={styles.conducteurMarker}>
      <FontAwesome5 name="motorcycle" size={24} color="#FF6B35" />
    </View>
  </Marker>
))}

{/* Chauffeurs de camion */}
{chauffeurs.map((chauffeur) => (
  <Marker
    key={`chauffeur-${chauffeur.id}`}
    coordinate={{
      latitude: chauffeur.positionLatitude,
      longitude: chauffeur.positionLongitude,
    }}
    title={`${chauffeur.user.prenom} ${chauffeur.user.nom}`}
    description={`Camion BTP • Note: ${chauffeur.notation}/5`}
  >
    <View style={styles.chauffeurMarker}>
      <FontAwesome5 name="truck" size={24} color="#2196F3" />
    </View>
  </Marker>
))}
```

---

## 🎯 DIFFÉRENCIATION VISUELLE

### Pourquoi ces choix?

1. **Motorcycle (moto)** = Tricycle
   - Logique: Un tricycle est un véhicule à 3 roues, proche d'une moto
   - Couleur orange: Couleur principale de l'app

2. **Truck (camion)** = Chauffeur BTP
   - Logique: Les chauffeurs conduisent des camions
   - Couleur bleue: Différenciation claire avec les conducteurs

3. **Hand-paper (main levée)** = Utilisateur
   - Logique: L'utilisateur lève la main pour appeler un véhicule
   - Couleur bleue: Neutre et visible

---

## 📱 IMPLÉMENTATION ACTUELLE

### TricycleScreen ✅
- Affiche les conducteurs avec icône `motorcycle` orange
- Position utilisateur avec icône `hand-paper` bleue
- Destination avec marker rouge standard

### BTPScreen ⏳
- Pas encore de carte
- Si ajoutée: utiliser icône `truck` bleue pour les chauffeurs

### ChauffeurLivraisonsScreen ⏳
- Pas encore de carte
- Si ajoutée: pourrait montrer la position du chauffeur et la destination

---

## 🚀 AMÉLIORATIONS FUTURES

1. **Icônes animées** - Rotation selon la direction du véhicule
2. **Badges de statut** - Disponible, En course, Hors ligne
3. **Clusters** - Regrouper les markers proches
4. **Filtres** - Afficher/masquer conducteurs ou chauffeurs
5. **Icônes personnalisées** - Images PNG au lieu de FontAwesome

---

**Dernière mise à jour:** 28 Février 2026  
**Version:** 1.0.0  
**Statut:** ✅ Convention établie
