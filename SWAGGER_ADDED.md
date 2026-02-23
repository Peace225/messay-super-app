# 📚 Swagger Documentation Ajoutée !

## ✅ Ce qui a été fait

### 1. Installation des packages
```bash
npm install swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

### 2. Configuration Swagger
Fichier créé : `backend/src/config/swagger.ts`
- Configuration OpenAPI 3.0
- Schémas de données (User, Course, Error)
- Authentification JWT
- Tags et descriptions

### 3. Annotations ajoutées
Routes documentées :
- ✅ `/api/auth/register` - Inscription
- ✅ `/api/auth/login` - Connexion
- ✅ `/api/auth/verify-otp` - Vérification OTP
- ✅ `/api/auth/me` - Profil utilisateur
- ✅ `/api/courses` (POST) - Créer une course
- ✅ `/api/courses` (GET) - Historique
- ✅ `/api/courses/nearby-drivers` - Conducteurs proches
- ✅ `/api/courses/:id` - Détails
- ✅ `/api/courses/:id/accept` - Accepter
- ✅ `/api/courses/:id/start` - Démarrer
- ✅ `/api/courses/:id/complete` - Terminer
- ✅ `/api/courses/:id/rate` - Noter
- ✅ `/api/health` - Santé de l'API

### 4. Intégration au serveur
Le serveur affiche maintenant :
```
╔═══════════════════════════════════════════╗
║   🚀 MESSAY API Server                    ║
║   📡 Port: 5000                           ║
║   📚 Swagger: http://localhost:5000/api-docs ║
╚═══════════════════════════════════════════╝
```

---

## 🚀 Accéder à Swagger

### URL
```
http://localhost:5000/api-docs
```

### Fonctionnalités

1. **Documentation Interactive**
   - Tous les endpoints documentés
   - Schémas de requêtes/réponses
   - Exemples de données

2. **Test Direct**
   - Testez les endpoints depuis l'interface
   - Pas besoin de Postman ou curl

3. **Authentification JWT**
   - Cliquez sur "Authorize" en haut à droite
   - Entrez votre token JWT
   - Format: `Bearer <votre_token>`

---

## 📖 Comment utiliser

### 1. Obtenir un token JWT

**Via Swagger:**
1. Ouvrez http://localhost:5000/api-docs
2. Allez à `POST /api/auth/login`
3. Cliquez sur "Try it out"
4. Entrez les credentials:
   ```json
   {
     "email": "jean.kouassi@example.com",
     "password": "password123"
   }
   ```
5. Cliquez sur "Execute"
6. Copiez le `accessToken` de la réponse

### 2. Authentifier dans Swagger

1. Cliquez sur le bouton "Authorize" 🔒 en haut
2. Entrez: `Bearer <votre_token>`
3. Cliquez sur "Authorize"
4. Fermez la fenêtre

### 3. Tester les endpoints protégés

Maintenant vous pouvez tester tous les endpoints qui nécessitent une authentification !

---

## 🎯 Exemples de Tests

### Créer une course

1. Allez à `POST /api/courses`
2. Cliquez sur "Try it out"
3. Modifiez le JSON:
   ```json
   {
     "departLatitude": 5.3599517,
     "departLongitude": -4.0082563,
     "departAdresse": "Cocody, Angré",
     "destinationLatitude": 5.3247,
     "destinationLongitude": -4.0127,
     "destinationAdresse": "Plateau, Centre-ville",
     "partageTrajet": false
   }
   ```
4. Cliquez sur "Execute"
5. Voir la réponse avec le prix calculé !

### Trouver des conducteurs

1. Allez à `GET /api/courses/nearby-drivers`
2. Cliquez sur "Try it out"
3. Entrez:
   - latitude: `5.3599517`
   - longitude: `-4.0082563`
   - rayon: `5`
4. Cliquez sur "Execute"

---

## 📊 État des Serveurs

| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:5000 | 🟢 Running |
| Swagger Docs | http://localhost:5000/api-docs | 🟢 Running |
| Admin Dashboard | http://localhost:3000 | 🟢 Running |
| Mobile App | - | ⚠️ Problème SDK |

---

## 🔧 Problème Mobile App

**Erreur:** SDK 50 vs SDK 54 incompatibilité

**Solutions:**
1. Installer Expo Go SDK 50 sur votre téléphone
2. Utiliser un émulateur (Android Studio / Xcode)
3. Utiliser le web: `npx expo start --web`

Voir `mobile-app/MOBILE_START.md` pour plus de détails.

---

## 🎨 Personnalisation Swagger

Pour ajouter plus d'endpoints, ajoutez des annotations JSDoc dans vos routes :

```typescript
/**
 * @swagger
 * /api/votre-route:
 *   get:
 *     summary: Description
 *     tags: [Nom du tag]
 *     responses:
 *       200:
 *         description: Succès
 */
router.get('/votre-route', handler);
```

---

## 📚 Documentation Complète

- **Swagger UI**: http://localhost:5000/api-docs
- **API Examples**: `API_EXAMPLES.md`
- **README**: `README.md`
- **Quick Start**: `QUICK_START.md`

---

**Date d'ajout**: 23 février 2026  
**Version Swagger**: OpenAPI 3.0  
**Status**: ✅ Opérationnel
