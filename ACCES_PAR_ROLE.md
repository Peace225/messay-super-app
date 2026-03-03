# 🔐 CONTRÔLE D'ACCÈS PAR RÔLE - MESSAY APP

## 📋 Vue d'ensemble

Système de contrôle d'accès basé sur les rôles (RBAC) pour adapter l'interface et les fonctionnalités selon le type d'utilisateur.

---

## 👥 RÔLES DISPONIBLES

### 1. USER (Client)
Utilisateur standard qui utilise les services de transport

### 2. CONDUCTEUR
Conducteur de tricycle qui accepte et effectue des courses

### 3. CHAUFFEUR
Chauffeur de camion qui effectue des livraisons BTP

### 4. ADMIN
Administrateur avec accès complet au système

---

## 📱 NAVIGATION (Onglets du bas)

### 👤 USER (Clients)
- ✅ 🏠 Accueil
- ✅ 🛺 Tricycle
- ✅ 🚌 Transport (Tickets)
- ✅ 🎟️ Événements
- ✅ 🚜 Lacarrière (BTP)

### 🏍️ CONDUCTEUR
- ✅ 🏠 Accueil
- ✅ 🛺 Mes Courses
- ✅ 👤 Profil
- ❌ Transport (masqué)
- ❌ Événements (masqué)
- ❌ BTP (masqué)

### 🚚 CHAUFFEUR
- ✅ 🏠 Accueil
- ✅ 🚚 Mes Livraisons
- ✅ 👤 Profil
- ❌ Tricycle (masqué)
- ❌ Transport (masqué)
- ❌ Événements (masqué)

---

## 👤 PAGE PROFIL - ACCÈS PAR RÔLE

### Section "Mon compte"

#### ✏️ Modifier le profil
- ✅ USER - Accessible
- ✅ CONDUCTEUR - Accessible
- ✅ CHAUFFEUR - Accessible
- ✅ ADMIN - Accessible

#### 🚗 Mes courses
- ✅ USER - Accessible (historique des courses commandées)
- ✅ CONDUCTEUR - Accessible (historique des courses effectuées)
- ❌ CHAUFFEUR - Masqué (ne fait pas de courses tricycle)
- ✅ ADMIN - Accessible

#### 💳 Moyens de paiement
- ✅ USER - Accessible
- ✅ CONDUCTEUR - Accessible (pour recevoir paiements)
- ✅ CHAUFFEUR - Accessible (pour recevoir paiements)
- ✅ ADMIN - Accessible

#### 🎫 Mes tickets
- ✅ USER - Accessible (peut acheter des tickets)
- 🔒 CONDUCTEUR - Grisé + cadenas (ne peut pas acheter de tickets)
- 🔒 CHAUFFEUR - Grisé + cadenas (ne peut pas acheter de tickets)
- ✅ ADMIN - Accessible

#### 🚚 Mes commandes BTP
- ✅ USER - Accessible (peut commander du matériel) → `/btp-historique`
- 🔒 CONDUCTEUR - Grisé + cadenas (ne fait pas de livraisons BTP)
- ✅ CHAUFFEUR - Accessible (historique des livraisons) → `/chauffeur-livraisons`
- ✅ ADMIN - Accessible

**Note importante:** 
- Pour les **USER**: Affiche "Mes commandes BTP" et redirige vers l'historique des commandes passées
- Pour les **CHAUFFEUR**: Affiche "Mes livraisons BTP" et redirige vers l'interface chauffeur avec les livraisons assignées

### Section "Paramètres"

#### 🔔 Notifications
- ✅ Tous les rôles - Accessible

#### 🌐 Langue
- ✅ Tous les rôles - Accessible

#### ❓ Aide & Support
- ✅ Tous les rôles - Accessible

---

## 🎨 INTERFACE VISUELLE

### Éléments accessibles
- Icône en couleur (#FF6B35)
- Texte en noir (#333)
- Flèche de navigation visible
- Cliquable

### Éléments grisés (non accessibles)
- Icône en gris (#ccc)
- Texte en gris (#999)
- Icône cadenas 🔒 à droite
- Opacité réduite (50%)
- Fond légèrement grisé (#f9f9f9)
- Non cliquable

---

## 🔧 IMPLÉMENTATION TECHNIQUE

### Fichiers modifiés

#### 1. `mobile-app/app/(tabs)/_layout.tsx`
Navigation adaptative selon le rôle:
```typescript
const userRole = user?.role || 'USER';

if (userRole === 'CONDUCTEUR') {
  // Afficher uniquement: Accueil, Mes Courses, Profil
}

if (userRole === 'CHAUFFEUR') {
  // Afficher uniquement: Accueil, Mes Livraisons, Profil
}

// Sinon afficher navigation complète pour USER
```

#### 2. `mobile-app/src/screens/ProfileScreen.tsx`
Contrôle d'accès conditionnel:
```typescript
const isUser = userRole === 'USER';
const isConducteur = userRole === 'CONDUCTEUR';
const isChauffeur = userRole === 'CHAUFFEUR';

// Affichage conditionnel
{isUser ? (
  <TouchableOpacity>...</TouchableOpacity>
) : (
  <View style={styles.menuItemDisabled}>
    <FontAwesome5 name="lock" />
  </View>
)}
```

---

## 📊 MATRICE D'ACCÈS COMPLÈTE

| Fonctionnalité | USER | CONDUCTEUR | CHAUFFEUR | ADMIN |
|----------------|------|------------|-----------|-------|
| **Navigation** |
| Accueil | ✅ | ✅ | ✅ | ✅ |
| Tricycle | ✅ | ❌ | ❌ | ✅ |
| Transport | ✅ | ❌ | ❌ | ✅ |
| Événements | ✅ | ❌ | ❌ | ✅ |
| BTP | ✅ | ❌ | ❌ | ✅ |
| Mes Courses | ✅ | ✅ | ❌ | ✅ |
| Mes Livraisons | ❌ | ❌ | ✅ | ✅ |
| **Profil** |
| Modifier profil | ✅ | ✅ | ✅ | ✅ |
| Mes courses | ✅ | ✅ | 🔒 | ✅ |
| Paiement | ✅ | ✅ | ✅ | ✅ |
| Mes tickets | ✅ | 🔒 | 🔒 | ✅ |
| Commandes BTP | ✅ | 🔒 | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Langue | ✅ | ✅ | ✅ | ✅ |
| Support | ✅ | ✅ | ✅ | ✅ |

**Légende:**
- ✅ = Accessible et fonctionnel
- 🔒 = Grisé avec cadenas (visible mais non cliquable)
- ❌ = Complètement masqué

---

## 🎯 LOGIQUE MÉTIER

### Pourquoi ces restrictions?

#### CONDUCTEUR (Tricycle)
- ❌ **Tickets transport**: Ne prend pas le bus, il conduit un tricycle
- ❌ **BTP**: Ne fait pas de livraisons de matériaux
- ❌ **Événements**: Travaille, n'achète pas de billets pendant le service
- ✅ **Mes courses**: Besoin de voir son historique de courses
- ✅ **Paiement**: Besoin de gérer ses revenus

#### CHAUFFEUR (BTP)
- ❌ **Tricycle**: Conduit un camion, pas un tricycle
- ❌ **Tickets transport**: Ne prend pas le bus
- ❌ **Événements**: Travaille, n'achète pas de billets
- ❌ **Mes courses**: Ne fait pas de courses tricycle
- ✅ **Commandes BTP**: Besoin de voir ses livraisons
- ✅ **Paiement**: Besoin de gérer ses revenus

#### USER (Client)
- ✅ **Tout accessible**: Peut utiliser tous les services

---

## 🔄 CHANGEMENT DE RÔLE

### Scénario: Un USER devient CONDUCTEUR

1. L'admin change le rôle dans la base de données
2. L'utilisateur se déconnecte et se reconnecte
3. La navigation change automatiquement
4. Les sections du profil sont adaptées
5. L'historique précédent reste accessible (courses en tant que client)

### Gestion des données
- Les données historiques sont conservées
- Un conducteur peut voir ses anciennes courses en tant que client
- Un chauffeur peut voir ses anciennes commandes BTP en tant que client

---

## 🧪 TESTS

### Test 1: Connexion USER
```
Email: jean.kouassi@example.com
Password: password123
```
**Vérifier:**
- ✅ 5 onglets visibles (Accueil, Tricycle, Transport, Événements, BTP)
- ✅ Toutes les sections du profil accessibles

### Test 2: Connexion CONDUCTEUR
```
Email: moussa.traore@example.com
Password: password123
```
**Vérifier:**
- ✅ 3 onglets visibles (Accueil, Mes Courses, Profil)
- ✅ "Mes courses" accessible
- 🔒 "Mes tickets" grisé avec cadenas
- 🔒 "Mes commandes BTP" grisé avec cadenas

### Test 3: Connexion CHAUFFEUR
```
Email: ibrahim.kone@example.com
Password: password123
```
**Vérifier:**
- ✅ 3 onglets visibles (Accueil, Mes Livraisons, Profil)
- 🔒 "Mes courses" masqué
- 🔒 "Mes tickets" grisé avec cadenas
- ✅ "Mes commandes BTP" accessible

---

## 🚀 AMÉLIORATIONS FUTURES

### Court terme
- [ ] Tooltip explicatif au survol des éléments grisés
- [ ] Message personnalisé selon le rôle ("En tant que conducteur, vous ne pouvez pas...")
- [ ] Badge de rôle visible sur le profil

### Moyen terme
- [ ] Permissions granulaires (sous-rôles)
- [ ] Rôles multiples (ex: USER + CONDUCTEUR)
- [ ] Historique de changement de rôle
- [ ] Mode "bascule" entre rôles

### Long terme
- [ ] Système de permissions dynamique (base de données)
- [ ] Rôles personnalisables par l'admin
- [ ] Audit trail des accès
- [ ] Gestion des permissions par API

---

## 📝 NOTES IMPORTANTES

1. **Sécurité**: Le contrôle d'accès est aussi implémenté côté backend
2. **UX**: Les éléments grisés restent visibles pour la cohérence de l'interface
3. **Évolutivité**: Facile d'ajouter de nouveaux rôles ou permissions
4. **Performance**: Pas d'impact sur les performances (vérifications simples)

---

**Dernière mise à jour:** 28 Février 2026  
**Version:** 1.0.0  
**Statut:** ✅ Implémenté et fonctionnel
