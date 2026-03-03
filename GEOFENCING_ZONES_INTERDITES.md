# 🚫 GEOFENCING - ZONES INTERDITES AUX TRICYCLES

## 📋 Vue d'ensemble

Système de geofencing implémenté pour respecter l'arrêté du Ministre-Gouverneur du District d'Abidjan interdisant la circulation des tricycles sur certaines artères majeures de la ville.

---

## 🗺️ ZONES INTERDITES

Selon l'arrêté officiel, les zones suivantes sont interdites aux tricycles:

### 1. Boulevard Félix Houphouët-Boigny (ex-VGE)
- Du carrefour Akwaba au pont FHB
- Buffer: 50m de chaque côté

### 2. Boulevard Lagunaire
- Du pont Général De Gaulle au Monument aux Martyrs
- Buffer: 50m de chaque côté

### 3. Boulevard de la République
- Place de la République → Cité Policière du Plateau → INHP
- Buffer: 50m de chaque côté

### 4. Boulevard Latrille
- Du Sofitel Hôtel Ivoire à Angré Petro Ivoire
- Buffer: 50m de chaque côté

### 5. Avenue Robert Beugré Mambé (ex-Attoban)
- Terminus 81/82 au rond-point Marie-Thérèse Houphouët-Boigny
- Buffer: 50m de chaque côté

### 6. Boulevard Marie-Thérèse Houphouët-Boigny (ex-Boulevard de France)
- Église Saint-Jean → Université FHB → Riviera Golf
- Buffer: 50m de chaque côté

### 7. Boulevard Germain Coffi Gadeau (ex-Mitterrand)
- Lycée Technique au rond-point Feh Kessé
- Buffer: 50m de chaque côté

### 8. Rue des Jardins
- CHU de Cocody au Zoo d'Abidjan
- Buffer: 50m de chaque côté

### 9. Voie CIAD - M'Pouto
- Rond-point CIAD M'Pouto au carrefour Mitterrand
- Buffer: 50m de chaque côté

### 10. Pont Henri-Konan Bédié (3ème pont)
- Buffer: 100m de chaque côté

### 11. Pont Alassane Ouattara
- Buffer: 100m de chaque côté

### 12. 4ème Pont
- Buffer: 100m de chaque côté

---

## 🎯 FONCTIONNALITÉS IMPLÉMENTÉES

### Pour les UTILISATEURS (Clients)

#### 1. Vérification au départ
- ✅ Alerte si la position actuelle est en zone interdite
- ✅ Blocage de la commande si départ en zone rouge
- ✅ Message explicatif avec le nom de la zone

#### 2. Vérification à la destination
- ✅ Alerte si la destination sélectionnée est en zone interdite
- ✅ Blocage de la sélection avec popup modal
- ✅ Affichage du nom de la zone et de la description

#### 3. Vérification du trajet
- ✅ Analyse du trajet entre départ et destination
- ✅ Détection si le trajet traverse des zones interdites
- ✅ Avertissement avec liste des zones traversées
- ✅ Option de continuer (itinéraire alternatif) ou annuler

#### 4. Affichage visuel sur la carte
- ✅ Zones interdites affichées en rouge sur la carte
- ✅ Lignes en pointillés pour meilleure visibilité
- ✅ Mise à jour en temps réel

### Pour les CONDUCTEURS

#### 1. Surveillance en temps réel
- ✅ Tracking GPS toutes les 5 secondes ou tous les 50 mètres
- ✅ Détection automatique d'entrée en zone interdite
- ✅ Alerte immédiate avec popup modal

#### 2. Alerte visuelle
- ✅ Modal rouge avec icône d'avertissement
- ✅ Message clair avec nom de la zone
- ✅ Référence à l'arrêté officiel
- ✅ Instruction de changer d'itinéraire

#### 3. Prévention des amendes
- ✅ Avertissement avant verbalisation
- ✅ Suggestion d'itinéraire alternatif
- ✅ Rappel des conséquences légales

---

## 🔧 ARCHITECTURE TECHNIQUE

### Fichiers créés

#### 1. `mobile-app/src/config/restrictedZones.ts`
Configuration centrale des zones interdites:
- Liste des 12 zones avec coordonnées GPS
- Fonctions de calcul de distance
- Algorithmes de détection (point dans zone, trajet traversant zone)
- Formule de Haversine pour calculs géographiques

#### 2. Modifications dans `TricycleScreen.tsx`
- Import du système de geofencing
- Vérification au clic sur la carte
- Vérification avant commande
- Modal d'alerte pour zones interdites
- Affichage des zones sur la carte (Polyline rouge)

#### 3. Modifications dans `ConducteurCoursesScreen.tsx`
- Surveillance GPS en temps réel
- Alerte automatique en zone interdite
- Modal d'avertissement conducteur

---

## 📐 ALGORITHMES UTILISÉS

### 1. Distance point-à-ligne
Calcule la distance minimale d'un point GPS à une ligne (route):
- Projection du point sur chaque segment
- Calcul de distance avec formule de Haversine
- Comparaison avec le buffer (50m ou 100m)

### 2. Point dans polygone
Algorithme ray-casting pour zones polygonales:
- Trace un rayon depuis le point
- Compte les intersections avec les bords
- Impair = dedans, Pair = dehors

### 3. Trajet traversant zone
Échantillonnage du trajet:
- 10 points intermédiaires entre départ et arrivée
- Vérification de chaque point
- Liste des zones traversées

### 4. Formule de Haversine
Calcul de distance entre deux points GPS:
```
a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
c = 2 ⋅ atan2(√a, √(1−a))
d = R ⋅ c
```
Où R = 6371km (rayon de la Terre)

---

## 🎨 INTERFACE UTILISATEUR

### Modal d'alerte (Utilisateur)
- Fond semi-transparent noir (70%)
- Card blanc arrondi
- Icône triangle d'avertissement (rouge)
- Titre "Zone Interdite"
- Message détaillé scrollable
- Bouton "Compris" (rouge)

### Modal d'alerte (Conducteur)
- Fond semi-transparent noir (80%)
- Card blanc arrondi
- Icône triangle d'avertissement (rouge, 50px)
- Titre "ZONE INTERDITE!" (rouge, gras)
- Message d'avertissement
- Bouton "J'ai compris" (rouge)

### Affichage carte
- Polylines rouges en pointillés
- Épaisseur: 4px
- Opacité: 60%
- Pattern: [10, 5] (10px trait, 5px espace)

---

## ⚙️ CONFIGURATION

### Buffer zones
- Routes normales: 50 mètres de chaque côté
- Ponts: 100 mètres de chaque côté

### Fréquence de vérification (Conducteurs)
- Temps: Toutes les 5 secondes
- Distance: Tous les 50 mètres
- Précision GPS: High accuracy

### Échantillonnage trajet
- 10 points intermédiaires
- Vérification départ + arrivée + 10 points = 12 vérifications

---

## 📱 EXPÉRIENCE UTILISATEUR

### Scénario 1: Utilisateur en zone interdite
1. Ouvre l'app tricycle
2. GPS détecte position en zone rouge
3. Alerte immédiate au chargement
4. Impossible de commander depuis cette position

### Scénario 2: Destination en zone interdite
1. Utilisateur clique sur la carte
2. Point sélectionné est en zone rouge
3. Modal s'affiche avec détails
4. Sélection annulée, doit choisir autre destination

### Scénario 3: Trajet traversant zone interdite
1. Utilisateur sélectionne départ et destination valides
2. Système détecte que le trajet traverse une zone rouge
3. Avertissement avec liste des zones
4. Option: Continuer (itinéraire alternatif) ou Annuler

### Scénario 4: Conducteur entre en zone interdite
1. Conducteur roule normalement
2. Entre dans une zone interdite
3. Modal d'alerte s'affiche immédiatement
4. Doit changer d'itinéraire

---

## 🔒 SÉCURITÉ ET CONFORMITÉ

### Légal
- ✅ Respect de l'arrêté du Ministre-Gouverneur
- ✅ Prévention des infractions
- ✅ Protection des conducteurs contre les amendes
- ✅ Référence explicite à la réglementation

### Technique
- ✅ Calculs côté client (pas de latence réseau)
- ✅ Fonctionnement offline (coordonnées en dur)
- ✅ Précision GPS haute
- ✅ Vérifications multiples (départ, arrivée, trajet)

### UX
- ✅ Messages clairs et explicites
- ✅ Pas de jargon technique
- ✅ Actions évidentes (boutons clairs)
- ✅ Prévention plutôt que blocage brutal

---

## 🚀 AMÉLIORATIONS FUTURES

### Court terme
- [ ] Suggestions d'itinéraires alternatifs
- [ ] Calcul automatique du détour
- [ ] Historique des alertes pour statistiques

### Moyen terme
- [ ] Intégration avec API de routing (Google Maps Directions)
- [ ] Zones interdites par horaires (rush hours)
- [ ] Zones temporaires (travaux, événements)

### Long terme
- [ ] Machine learning pour prédire les zones à risque
- [ ] Intégration avec autorités pour mises à jour en temps réel
- [ ] Système de signalement communautaire
- [ ] Gamification (conducteurs respectueux récompensés)

---

## 📊 MÉTRIQUES À SUIVRE

### Utilisateurs
- Nombre d'alertes départ en zone interdite
- Nombre d'alertes destination en zone interdite
- Nombre de trajets avec zones traversées
- Taux d'annulation après alerte

### Conducteurs
- Nombre d'alertes en temps réel
- Zones les plus fréquemment traversées
- Temps moyen avant sortie de zone
- Récidives par conducteur

### Système
- Performance des calculs géographiques
- Précision GPS moyenne
- Faux positifs/négatifs
- Temps de réponse des alertes

---

## 🧪 TESTS RECOMMANDÉS

### Tests unitaires
- [ ] Calcul distance point-ligne
- [ ] Détection point dans polygone
- [ ] Formule de Haversine
- [ ] Échantillonnage trajet

### Tests d'intégration
- [ ] Alerte au chargement de la carte
- [ ] Alerte au clic sur zone interdite
- [ ] Alerte avant commande
- [ ] Surveillance GPS conducteur

### Tests utilisateurs
- [ ] Compréhension des messages
- [ ] Facilité de sélection alternative
- [ ] Réaction aux alertes conducteur
- [ ] Performance sur différents appareils

---

## 📞 SUPPORT

### Pour les utilisateurs
"Si vous pensez qu'une alerte est erronée, contactez le support avec votre position GPS exacte."

### Pour les conducteurs
"En cas d'alerte répétée sur une zone que vous pensez autorisée, signalez-le immédiatement au support avec captures d'écran."

---

**Dernière mise à jour:** 27 Février 2026  
**Version:** 1.0.0  
**Statut:** ✅ Implémenté et fonctionnel
