# 📡 MESSAY API - Exemples d'Utilisation

## 🔐 Authentification

### 1. Inscription

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Diallo",
    "prenom": "Aminata",
    "email": "aminata@example.com",
    "telephone": "+2250705555555",
    "password": "password123"
  }'
```

**Réponse:**
```json
{
  "user": {
    "id": "uuid",
    "nom": "Diallo",
    "prenom": "Aminata",
    "email": "aminata@example.com",
    "telephone": "+2250705555555",
    "role": "USER",
    "isVerified": false
  },
  "message": "Inscription réussie. Un code OTP a été envoyé à votre téléphone.",
  "otpCode": "123456"
}
```

### 2. Connexion

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jean.kouassi@example.com",
    "password": "password123"
  }'
```

**Réponse:**
```json
{
  "user": {
    "id": "e274ce72-2dc1-4ee8-97e8-a3d8bf9b77a4",
    "nom": "Kouassi",
    "prenom": "Jean",
    "email": "jean.kouassi@example.com",
    "telephone": "+2250701234567",
    "role": "USER",
    "photo": null,
    "isVerified": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Vérification OTP

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "telephone": "+2250705555555",
    "otpCode": "123456"
  }'
```

### 4. Obtenir le Profil (Authentifié)

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🛺 Courses (Tricycles)

### 1. Créer une Demande de Course

```bash
curl -X POST http://localhost:5000/api/courses \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "departLatitude": 5.3599517,
    "departLongitude": -4.0082563,
    "departAdresse": "Cocody, Angré",
    "destinationLatitude": 5.3247,
    "destinationLongitude": -4.0127,
    "destinationAdresse": "Plateau, Centre-ville",
    "partageTrajet": false
  }'
```

**Réponse:**
```json
{
  "course": {
    "id": "uuid",
    "userId": "uuid",
    "departLatitude": 5.3599517,
    "departLongitude": -4.0082563,
    "departAdresse": "Cocody, Angré",
    "destinationLatitude": 5.3247,
    "destinationLongitude": -4.0127,
    "destinationAdresse": "Plateau, Centre-ville",
    "distance": 8.5,
    "dureeEstimee": 25,
    "prix": 2200,
    "statut": "EN_ATTENTE",
    "createdAt": "2026-02-22T12:00:00.000Z"
  },
  "conducteursDisponibles": 3,
  "message": "Recherche de conducteur en cours..."
}
```

### 2. Trouver les Conducteurs à Proximité

```bash
curl -X GET "http://localhost:5000/api/courses/nearby-drivers?latitude=5.3599517&longitude=-4.0082563&rayon=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Réponse:**
```json
{
  "drivers": [
    {
      "id": "uuid",
      "userId": "uuid",
      "vehiculeType": "TRICYCLE",
      "immatriculation": "AB-1234-CI",
      "statut": "DISPONIBLE",
      "positionLatitude": 5.3600000,
      "positionLongitude": -4.0080000,
      "note": 4.8,
      "nombreCourses": 150,
      "user": {
        "id": "uuid",
        "nom": "Traoré",
        "prenom": "Moussa",
        "photo": null,
        "telephone": "+2250703456789"
      }
    }
  ]
}
```

### 3. Historique des Courses

```bash
curl -X GET http://localhost:5000/api/courses \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Réponse:**
```json
{
  "courses": [
    {
      "id": "uuid",
      "departAdresse": "Cocody, Angré",
      "destinationAdresse": "Plateau, Centre-ville",
      "distance": 8.5,
      "prix": 2200,
      "statut": "TERMINEE",
      "noteConducteur": 5,
      "commentaire": "Excellent service",
      "heureDebut": "2026-02-20T08:30:00.000Z",
      "heureFin": "2026-02-20T08:55:00.000Z",
      "conducteur": {
        "user": {
          "nom": "Traoré",
          "prenom": "Moussa",
          "photo": null
        }
      }
    }
  ]
}
```

### 4. Accepter une Course (Conducteur)

```bash
curl -X POST http://localhost:5000/api/courses/COURSE_ID/accept \
  -H "Authorization: Bearer CONDUCTEUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conducteurId": "CONDUCTEUR_UUID"
  }'
```

### 5. Démarrer une Course

```bash
curl -X POST http://localhost:5000/api/courses/COURSE_ID/start \
  -H "Authorization: Bearer CONDUCTEUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conducteurId": "CONDUCTEUR_UUID"
  }'
```

### 6. Terminer une Course

```bash
curl -X POST http://localhost:5000/api/courses/COURSE_ID/complete \
  -H "Authorization: Bearer CONDUCTEUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conducteurId": "CONDUCTEUR_UUID"
  }'
```

### 7. Noter une Course

```bash
curl -X POST http://localhost:5000/api/courses/COURSE_ID/rate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "noteConducteur": 5,
    "commentaire": "Excellent service, très professionnel"
  }'
```

---

## 🔌 Socket.IO - Temps Réel

### Connexion Socket.IO

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connecté au serveur Socket.IO');
});
```

### Rejoindre une Course

```javascript
socket.emit('join-course', 'COURSE_ID');
```

### Mise à Jour de Position (Conducteur)

```javascript
socket.emit('update-position', {
  courseId: 'COURSE_ID',
  latitude: 5.3600000,
  longitude: -4.0080000
});
```

### Écouter les Mises à Jour de Position

```javascript
socket.on('position-updated', (data) => {
  console.log('Nouvelle position:', data.latitude, data.longitude);
  // Mettre à jour la carte
});
```

### Mise à Jour du Statut de Course

```javascript
socket.emit('course-status-update', {
  courseId: 'COURSE_ID',
  statut: 'EN_COURS'
});

socket.on('status-changed', (data) => {
  console.log('Nouveau statut:', data.statut);
});
```

### Support Chat en Temps Réel

```javascript
// Rejoindre un ticket de support
socket.emit('join-support', 'TICKET_ID');

// Envoyer un message
socket.emit('support-message', {
  ticketId: 'TICKET_ID',
  message: 'Bonjour, j\'ai besoin d\'aide',
  senderId: 'USER_ID'
});

// Recevoir un message
socket.on('new-message', (data) => {
  console.log('Nouveau message:', data.message);
});
```

---

## 📊 Exemples de Calculs

### Calcul de Distance (Haversine)

```javascript
// Cocody Angré → Plateau
const distance = calculateDistance(
  5.3599517, -4.0082563,  // Départ
  5.3247, -4.0127          // Destination
);
// Résultat: 8.5 km
```

### Calcul de Prix

```javascript
const tarif = {
  prixBase: 500,        // FCFA
  prixParKm: 200,       // FCFA/km
  prixParMinute: 50,    // FCFA/min
  fraisService: 0.15    // 15%
};

const distance = 8.5;   // km
const duree = 25;       // minutes

// Calcul
const prixDistance = 8.5 * 200 = 1700 FCFA
const prixTemps = 25 * 50 = 1250 FCFA
const sousTotal = 500 + 1700 + 1250 = 3450 FCFA
const total = 3450 * 1.15 = 3968 FCFA (arrondi à 4000 FCFA)
```

### Estimation de Durée

```javascript
// Vitesse moyenne en ville: 30 km/h
const distance = 8.5; // km
const vitesse = 30;   // km/h
const duree = (8.5 / 30) * 60 = 17 minutes
// Avec trafic: ~25 minutes
```

---

## 🧪 Tests avec PowerShell

### Créer un fichier JSON pour les tests

```powershell
# login.json
@"
{
  "email": "jean.kouassi@example.com",
  "password": "password123"
}
"@ | Out-File -Encoding utf8 login.json

# Tester la connexion
curl -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  --data "@login.json"
```

### Créer une course

```powershell
# course.json
@"
{
  "departLatitude": 5.3599517,
  "departLongitude": -4.0082563,
  "departAdresse": "Cocody, Angré",
  "destinationLatitude": 5.3247,
  "destinationLongitude": -4.0127,
  "destinationAdresse": "Plateau, Centre-ville"
}
"@ | Out-File -Encoding utf8 course.json

# Envoyer la requête
curl -X POST http://localhost:5000/api/courses `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  --data "@course.json"
```

---

## 🎯 Scénarios d'Utilisation

### Scénario 1: Demander une Course

1. **Utilisateur se connecte**
   ```bash
   POST /api/auth/login
   ```

2. **Utilisateur demande une course**
   ```bash
   POST /api/courses
   ```

3. **Système recherche des conducteurs**
   ```bash
   GET /api/courses/nearby-drivers
   ```

4. **Conducteur accepte la course**
   ```bash
   POST /api/courses/:id/accept
   ```

5. **Conducteur démarre la course**
   ```bash
   POST /api/courses/:id/start
   ```

6. **Suivi en temps réel (Socket.IO)**
   ```javascript
   socket.on('position-updated', ...)
   ```

7. **Conducteur termine la course**
   ```bash
   POST /api/courses/:id/complete
   ```

8. **Utilisateur note le conducteur**
   ```bash
   POST /api/courses/:id/rate
   ```

### Scénario 2: Inscription et Vérification

1. **Inscription**
   ```bash
   POST /api/auth/register
   ```

2. **Réception du code OTP** (simulé dans les logs)

3. **Vérification OTP**
   ```bash
   POST /api/auth/verify-otp
   ```

4. **Connexion**
   ```bash
   POST /api/auth/login
   ```

---

## 📱 Intégration Mobile (React Native)

### Configuration Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 30000,
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = getToken(); // Depuis AsyncStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Exemple d'Appel

```typescript
// Connexion
const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// Créer une course
const createCourse = async (data: CreateCourseData) => {
  const response = await api.post('/courses', data);
  return response.data;
};
```

---

## 🔒 Sécurité

### Headers Requis

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Gestion des Erreurs

```javascript
try {
  const response = await api.post('/courses', data);
} catch (error) {
  if (error.response?.status === 401) {
    // Token expiré, refresh ou déconnexion
  } else if (error.response?.status === 400) {
    // Erreur de validation
    console.log(error.response.data.error);
  }
}
```

---

**Documentation complète disponible dans README.md**
