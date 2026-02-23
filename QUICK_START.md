# ⚡ MESSAY - Guide de Démarrage Rapide

## 🎯 Tout est Déjà Installé et Configuré !

### ✅ Services Actifs

| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:5000 | 🟢 Running |
| Admin Dashboard | http://localhost:3000 | 🟢 Running |
| Mobile App | - | 🟡 Ready to start |

---

## 🚀 Démarrer le Mobile App

```bash
cd messay/mobile-app
npm start
```

Ensuite:
- Scannez le QR code avec **Expo Go** sur votre téléphone
- Ou appuyez sur `a` pour Android / `i` pour iOS / `w` pour Web

---

## 🔐 Comptes de Test

### Utilisateur Standard
```
Email: jean.kouassi@example.com
Mot de passe: password123
```

### Admin Dashboard
```
URL: http://localhost:3000
Email: admin@messay.com
Mot de passe: admin123
```

### Conducteur
```
Email: moussa.traore@example.com
Mot de passe: password123
```

---

## 🧪 Tester l'API

### 1. Vérifier que l'API fonctionne
```bash
curl http://localhost:5000/api/health
```

### 2. Se connecter
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  --data "@test-login.json"
```

### 3. Créer une course (avec token)
```bash
curl -X POST http://localhost:5000/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "departLatitude": 5.3599517,
    "departLongitude": -4.0082563,
    "departAdresse": "Cocody",
    "destinationLatitude": 5.3247,
    "destinationLongitude": -4.0127,
    "destinationAdresse": "Plateau"
  }'
```

---

## 📱 Ouvrir les Interfaces

### Admin Dashboard
```bash
start http://localhost:3000
```

### API Documentation
```bash
start http://localhost:5000/api/health
```

---

## 🛑 Arrêter les Services

Les services backend et admin dashboard tournent en arrière-plan.

Pour les arrêter:
1. Ouvrez le gestionnaire de processus Kiro
2. Ou utilisez Ctrl+C dans les terminaux correspondants

---

## 📊 Base de Données

### Accéder à Prisma Studio (Interface visuelle)
```bash
cd messay/backend
npx prisma studio
```

Cela ouvrira une interface web sur http://localhost:5555 pour visualiser et modifier les données.

---

## 🔄 Commandes Utiles

### Backend
```bash
cd messay/backend

# Redémarrer le serveur
npm run dev

# Voir les logs
# (déjà en cours d'exécution)

# Réinitialiser la base de données
npm run prisma:migrate reset
npm run prisma:seed
```

### Mobile App
```bash
cd messay/mobile-app

# Démarrer Expo
npm start

# Nettoyer le cache
npm start -- --clear

# Build Android
npm run android

# Build iOS (Mac uniquement)
npm run ios
```

### Admin Dashboard
```bash
cd messay/admin-dashboard

# Démarrer le serveur
npm run dev

# Build production
npm run build
```

---

## 🎨 Personnalisation

### Changer le logo de l'app mobile
1. Remplacer `mobile-app/assets/icon.png`
2. Remplacer `mobile-app/assets/splash.png`
3. Redémarrer Expo

### Modifier les couleurs
- Mobile: `mobile-app/src/constants/colors.ts` (à créer)
- Admin: `admin-dashboard/tailwind.config.js`

### Ajouter une clé Google Maps
1. Obtenir une clé sur [Google Cloud Console](https://console.cloud.google.com/)
2. Ajouter dans `mobile-app/.env`:
   ```
   GOOGLE_MAPS_API_KEY=votre_cle_ici
   ```

---

## 🐛 Dépannage Rapide

### Le backend ne démarre pas
```bash
cd messay/backend
npm run dev
```

### L'admin dashboard ne s'ouvre pas
```bash
cd messay/admin-dashboard
npm run dev
```

### Erreur de base de données
```bash
cd messay/backend
npx prisma migrate reset
npm run prisma:seed
```

### Expo ne démarre pas
```bash
cd messay/mobile-app
npm start -- --clear
```

---

## 📚 Documentation Complète

- **README.md** - Vue d'ensemble et architecture
- **INSTALLATION.md** - Guide d'installation détaillé
- **STATUS.md** - État actuel du système
- **API_EXAMPLES.md** - Exemples d'utilisation de l'API

---

## 🎯 Fonctionnalités Disponibles

### ✅ Implémenté
- Authentification JWT
- Module Tricycles (GPS, matching conducteurs)
- Calcul automatique des prix
- Socket.IO temps réel
- Admin Dashboard
- Base de données complète

### 🚧 À Développer
- Transport interurbain (UTBS, BTA, RVS)
- Événements (concerts, sports)
- Module BTP Lacarrière
- Paiements (Stripe, Mobile Money)
- Support client (chat)
- Notifications push

---

## 💡 Conseils

1. **Gardez les serveurs en cours d'exécution** pendant le développement
2. **Utilisez Prisma Studio** pour visualiser les données
3. **Consultez les logs** en cas d'erreur
4. **Testez l'API** avec curl ou Postman avant d'intégrer au mobile
5. **Commitez régulièrement** vos changements

---

## 🎉 Vous êtes Prêt !

Tout est configuré et prêt à l'emploi. Commencez par:

1. ✅ Ouvrir http://localhost:3000 (Admin Dashboard)
2. ✅ Tester l'API avec les exemples fournis
3. ✅ Démarrer le mobile app: `cd mobile-app && npm start`

**Bon développement ! 🚀**
