# 🚀 MESSAY - Super App Mobile

MESSAY est une super application mobile tout-en-un pour la Côte d'Ivoire, offrant des services de mobilité urbaine, transport interurbain, événements et BTP.

## 📁 Structure du Projet

```
messay/
├── backend/              # API Node.js + Express + PostgreSQL
├── mobile-app/           # Application mobile React Native (Expo)
└── admin-dashboard/      # Dashboard administrateur React + Vite
```

## 🛠 Stack Technique

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Base de données**: PostgreSQL + Prisma ORM
- **Authentification**: JWT + bcrypt
- **Temps réel**: Socket.io
- **Paiement**: Stripe + Mobile Money (simulation)
- **Validation**: Zod

### Mobile App
- **Framework**: React Native (Expo)
- **Navigation**: Expo Router
- **State Management**: Zustand
- **API Client**: Axios + React Query
- **Maps**: React Native Maps + Expo Location
- **Paiement**: Stripe React Native
- **Notifications**: Expo Notifications
- **QR Code**: react-native-qrcode-svg

### Admin Dashboard
- **Framework**: React + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State**: Zustand
- **API**: Axios + React Query

## 🚀 Installation

### Prérequis
- Node.js 18+
- PostgreSQL 14+
- Expo CLI
- Git

### 1. Backend

```bash
cd backend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Générer le client Prisma
npm run prisma:generate

# Créer la base de données et exécuter les migrations
npm run prisma:migrate

# Seed les données de test
npm run prisma:seed

# Démarrer le serveur de développement
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

### 2. Mobile App

```bash
cd mobile-app

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec l'URL de votre API

# Démarrer Expo
npm start

# Ou directement sur un émulateur
npm run android  # Android
npm run ios      # iOS
```

### 3. Admin Dashboard

```bash
cd admin-dashboard

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

Le dashboard est accessible sur `http://localhost:3000`

**Identifiants de test:**
- Email: `admin@messay.com`
- Mot de passe: `admin123`

## 📱 Fonctionnalités

### 🛺 Mobilité Urbaine (Tricycles)
- Carte GPS en temps réel
- Recherche de conducteurs à proximité
- Calcul automatique du prix
- Suivi de course en temps réel (Socket.io)
- Notation des conducteurs
- Historique des courses

### 🚌 Transport Interurbain
- Réservation de tickets (UTBS, BTA, RVS)
- Sélection de siège
- Génération de QR code
- Paiement sécurisé
- Notifications de départ

### 🎟️ Loisirs & Événementiel
- Catalogue d'événements
- Achat de billets
- QR code d'entrée
- Notifications de rappel

### 🚜 Module BTP "Lacarrière"
- Location d'engins
- Commande de matériaux (sable, gravier, ciment)
- Choix du type de camion
- Suivi GPS de livraison
- ETA en temps réel

### 💳 Paiement
- Carte bancaire (Stripe)
- Orange Money (simulation)
- MTN MoMo (simulation)
- Wave (simulation)
- Espèces
- Génération de reçus PDF

### 🆘 Support Client
- Chat en temps réel
- Création de tickets
- Gestion des objets perdus
- Médiation de litiges

## 🔐 Authentification

### Inscription
```bash
POST /api/auth/register
{
  "nom": "Kouassi",
  "prenom": "Jean",
  "email": "jean@example.com",
  "telephone": "+2250701234567",
  "password": "password123"
}
```

### Connexion
```bash
POST /api/auth/login
{
  "email": "jean@example.com",
  "password": "password123"
}
```

### Vérification OTP
```bash
POST /api/auth/verify-otp
{
  "telephone": "+2250701234567",
  "otpCode": "123456"
}
```

## 🛣️ API Endpoints

### Courses
- `POST /api/courses` - Créer une demande de course
- `GET /api/courses` - Historique des courses
- `GET /api/courses/:id` - Détails d'une course
- `GET /api/courses/nearby-drivers` - Conducteurs à proximité
- `POST /api/courses/:id/accept` - Accepter une course (conducteur)
- `POST /api/courses/:id/start` - Démarrer une course
- `POST /api/courses/:id/complete` - Terminer une course
- `POST /api/courses/:id/rate` - Noter une course

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/verify-otp` - Vérification OTP
- `GET /api/auth/me` - Profil utilisateur

## 🧪 Données de Test

Après le seed, vous aurez accès à :

**Utilisateurs:**
- User: `jean.kouassi@example.com` / `password123`
- Conducteur: `moussa.traore@example.com` / `password123`
- Chauffeur: `ibrahim.kone@example.com` / `password123`
- Admin: `admin@messay.com` / `password123`

**Téléphones:**
- +2250701234567 (User)
- +2250702345678 (User)
- +2250703456789 (Conducteur)
- +2250704567890 (Chauffeur)

## 🔧 Configuration

### Variables d'environnement Backend

```env
DATABASE_URL="postgresql://user:password@localhost:5432/messay_db"
JWT_SECRET="votre_secret_jwt"
JWT_REFRESH_SECRET="votre_refresh_secret"
PORT=5000
STRIPE_SECRET_KEY="sk_test_..."
```

### Variables d'environnement Mobile

```env
API_URL=http://localhost:5000/api
SOCKET_URL=http://localhost:5000
STRIPE_PUBLISHABLE_KEY=pk_test_...
GOOGLE_MAPS_API_KEY=votre_cle_google_maps
```

## 🌐 Socket.IO Events

### Courses en temps réel
```javascript
// Rejoindre une course
socket.emit('join-course', courseId);

// Mise à jour de position
socket.emit('update-position', { courseId, latitude, longitude });

// Écouter les mises à jour
socket.on('position-updated', (data) => {
  console.log(data.latitude, data.longitude);
});
```

### Support Chat
```javascript
// Envoyer un message
socket.emit('support-message', { ticketId, message, senderId });

// Recevoir un message
socket.on('new-message', (data) => {
  console.log(data.message);
});
```

## 📊 Admin Dashboard

Le dashboard permet de :
- Visualiser les statistiques globales
- Gérer les utilisateurs
- Vérifier les documents des conducteurs
- Suivre les courses en temps réel
- Gérer les partenaires
- Voir les graphiques de revenus

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt (10 rounds)
- JWT avec expiration (24h access, 7j refresh)
- Validation des données avec Zod
- Helmet.js pour les headers de sécurité
- Rate limiting sur les endpoints sensibles
- CORS configuré
- Middleware d'authentification sur toutes les routes protégées

## 🚀 Déploiement

### Backend
```bash
npm run build
npm start
```

### Mobile App
```bash
# Build Android
eas build --platform android

# Build iOS
eas build --platform ios
```

### Admin Dashboard
```bash
npm run build
# Déployer le dossier dist/
```

## 📝 Scripts Disponibles

### Backend
- `npm run dev` - Démarrage en mode développement
- `npm run build` - Build production
- `npm start` - Démarrage production
- `npm run prisma:generate` - Générer le client Prisma
- `npm run prisma:migrate` - Exécuter les migrations
- `npm run prisma:seed` - Seed les données

### Mobile App
- `npm start` - Démarrer Expo
- `npm run android` - Lancer sur Android
- `npm run ios` - Lancer sur iOS
- `npm run web` - Lancer sur web

### Admin Dashboard
- `npm run dev` - Serveur de développement
- `npm run build` - Build production
- `npm run preview` - Prévisualiser le build

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails

## 👥 Équipe

MESSAY Team - Super App pour la Côte d'Ivoire

## 📞 Support

Pour toute question ou support :
- Email: support@messay.com
- Téléphone: +225 00 00 00 00

---

**Fait avec ❤️ en Côte d'Ivoire 🇨🇮**
