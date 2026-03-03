# 👥 UTILISATEURS DE TEST - MESSAY APP

## 🔑 Mot de passe universel
**Tous les utilisateurs ont le même mot de passe:** `password123`

---

## 📱 UTILISATEURS CLIENTS

### 1. Jean Kouassi (Client Standard)
- **Email:** jean.kouassi@example.com
- **Mot de passe:** password123
- **Téléphone:** +2250701234567
- **Rôle:** USER
- **Moyen de paiement:** Orange Money
- **Statut:** Vérifié ✅
- **Utilisation:** Tester les réservations de courses, tickets, événements

### 2. Fatou Diallo (Cliente Standard)
- **Email:** fatou.diallo@example.com
- **Mot de passe:** password123
- **Téléphone:** +2250702345678
- **Rôle:** USER
- **Moyen de paiement:** MTN Mobile Money
- **Statut:** Vérifié ✅
- **Utilisation:** Tester les réservations de courses, tickets, événements

---

## 🏍️ CONDUCTEUR (Tricycle)

### 3. Moussa Traoré (Conducteur)
- **Email:** moussa.traore@example.com
- **Mot de passe:** password123
- **Téléphone:** +2250703456789
- **Rôle:** CONDUCTEUR
- **Permis:** PERMIS_A
- **Numéro permis:** CI-A-123456
- **Véhicule:** Tricycle
- **Immatriculation:** AB-1234-CI
- **Statut:** Disponible
- **Position:** Abidjan (5.3599517, -4.0082563)
- **Note:** 4.8/5 ⭐
- **Courses effectuées:** 150
- **Statut:** Vérifié ✅
- **Utilisation:** Tester l'interface conducteur, accepter/refuser des courses

---

## 🚚 CHAUFFEUR (BTP/Livraisons)

### 4. Ibrahim Koné (Chauffeur BTP)
- **Email:** ibrahim.kone@example.com
- **Mot de passe:** password123
- **Téléphone:** +2250704567890
- **Rôle:** CHAUFFEUR
- **Permis:** PERMIS_C
- **Numéro permis:** CI-C-789012
- **Expérience:** 8 ans
- **Statut:** Disponible
- **Position:** Abidjan (5.3599517, -4.0082563)
- **Note:** 4.7/5 ⭐
- **Livraisons effectuées:** 200
- **Statut:** Vérifié ✅
- **Utilisation:** Tester l'interface chauffeur, gérer les livraisons BTP

---

## 👨‍💼 ADMINISTRATEUR

### 5. MESSAY Admin (Administrateur)
- **Email:** admin@messay.com
- **Mot de passe:** password123
- **Téléphone:** +2250700000000
- **Rôle:** ADMIN
- **Statut:** Vérifié ✅
- **Utilisation:** Accéder au dashboard admin, gérer tous les utilisateurs et services

---

## 🎯 SCÉNARIOS DE TEST

### Scénario 1: Réserver une course (Client)
1. Se connecter avec: **jean.kouassi@example.com** / password123
2. Aller sur l'onglet "Tricycle"
3. Sélectionner une destination sur la carte
4. Demander une course
5. Le conducteur Moussa Traoré devrait apparaître comme disponible

### Scénario 2: Accepter une course (Conducteur)
1. Se connecter avec: **moussa.traore@example.com** / password123
2. Voir les courses disponibles dans l'onglet "Mes Courses"
3. Accepter ou refuser les demandes
4. Mettre à jour le statut de la course

### Scénario 3: Commander du matériel BTP (Client)
1. Se connecter avec: **fatou.diallo@example.com** / password123
2. Aller sur l'onglet "BTP"
3. Sélectionner le type de matériau (sable, gravier, etc.)
4. Choisir la quantité et l'adresse de livraison
5. Confirmer la commande

### Scénario 4: Gérer une livraison (Chauffeur)
1. Se connecter avec: **ibrahim.kone@example.com** / password123
2. Voir les livraisons assignées dans l'onglet "Mes Livraisons"
3. Accepter la livraison
4. Mettre à jour le statut (en cours, livrée)

### Scénario 5: Réserver un événement (Client)
1. Se connecter avec n'importe quel compte USER
2. Aller sur l'onglet "Événements"
3. Rechercher un événement (ex: "Concert Zouglou")
4. Cliquer sur "Réserver"
5. Procéder au paiement

### Scénario 6: Administration (Admin)
1. Se connecter avec: **admin@messay.com** / password123
2. Accéder au dashboard admin
3. Gérer les utilisateurs, conducteurs, courses
4. Voir les statistiques

---

## 📊 DONNÉES PRÉCHARGÉES

### Courses
- 1 course terminée entre Jean Kouassi et Moussa Traoré
- Trajet: Cocody Angré → Plateau Centre-ville
- Prix: 2,200 FCFA
- Note: 5/5 ⭐

### Tickets Transport
- 1 ticket UTBS pour Fatou Diallo
- Trajet: Abidjan → Yamoussoukro
- Date: 01/03/2026 à 07:00
- Siège: A12
- Prix: 5,000 FCFA

### Commandes BTP
- 1 commande de sable pour Jean Kouassi
- Quantité: 5 tonnes
- Livraison: Cocody, Riviera Golf
- Prix: 75,000 FCFA
- Chauffeur: Ibrahim Koné
- Statut: Confirmée

### Événements
- Concert Zouglou Night (15/03/2026)
- Match ASEC vs Africa Sports (20/03/2026)

### Camions Disponibles
- Mercedes Actros (Benne, 10T) - CD-5678-CI
- Volvo FH16 (Citerne, 15T) - EF-9012-CI

---

## 🔄 RÉINITIALISER LES DONNÉES

Pour réinitialiser la base de données avec les données de test:

```bash
cd backend
npx prisma migrate reset
npm run seed
```

Cela supprimera toutes les données et recréera les utilisateurs de test.

---

## 📝 NOTES IMPORTANTES

1. **Tous les utilisateurs sont déjà vérifiés** (pas besoin de vérification email/SMS)
2. **Les positions GPS** sont centrées sur Abidjan
3. **Les paiements** sont en mode simulation (pas de vraies transactions)
4. **Le mot de passe** est le même pour tous: `password123`
5. **Les numéros de téléphone** sont fictifs mais au format ivoirien

---

## 🆘 EN CAS DE PROBLÈME

Si vous ne pouvez pas vous connecter:
1. Vérifiez que le backend est démarré (port 5000)
2. Vérifiez l'URL dans mobile-app/.env (actuellement: http://192.168.1.10:5000/api)
3. Réinitialisez la base de données avec `npx prisma migrate reset`
4. Relancez le seed avec `npm run seed`

---

**Dernière mise à jour:** 27 Février 2026
