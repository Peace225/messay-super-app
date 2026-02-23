# 🚀 Démarrer le Backend MESSAY

## Problème: Port 5000 Occupé

Le backend ne peut pas démarrer car le port 5000 est déjà utilisé.

---

## Solution Rapide

### Option 1: Libérer le Port (Recommandé)

#### Windows PowerShell
```powershell
# 1. Trouver le processus qui utilise le port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess

# 2. Arrêter le processus (remplacer <PID> par le numéro obtenu)
Stop-Process -Id <PID> -Force

# 3. Démarrer le backend
cd messay/backend
npm run dev
```

#### Windows CMD
```cmd
# 1. Trouver le processus
netstat -ano | findstr :5000

# 2. Arrêter le processus (remplacer <PID> par le numéro dans la dernière colonne)
taskkill /PID <PID> /F

# 3. Démarrer le backend
cd messay\backend
npm run dev
```

### Option 2: Changer le Port

Si vous ne pouvez pas libérer le port 5000:

1. **Modifier le fichier .env du backend**
```env
PORT=5001
```

2. **Modifier le fichier .env du mobile app**
```env
API_URL=http://192.168.1.4:5001/api
SOCKET_URL=http://192.168.1.4:5001
```

3. **Modifier le fichier .env du dashboard**
```env
VITE_API_URL=http://localhost:5001/api
```

4. **Démarrer le backend**
```bash
cd messay/backend
npm run dev
```

---

## Vérification

### Backend Démarré
Vous devriez voir:
```
╔═══════════════════════════════════════════╗
║                                           ║
║   🚀 MESSAY API Server                    ║
║                                           ║
║   📡 Port: 5000                         ║
║   🌍 Environment: development           ║
║   ⚡ Socket.IO: Activé                    ║
║                                           ║
╚═══════════════════════════════════════════╝
```

### Tester l'API
```bash
# Dans un nouveau terminal
curl http://localhost:5000/api/health
```

Réponse attendue:
```json
{
  "status": "OK",
  "message": "MESSAY API is running",
  "timestamp": "2026-02-23T..."
}
```

### Swagger Documentation
Ouvrez dans votre navigateur:
```
http://localhost:5000/api-docs
```

---

## Démarrage Complet

### 1. Backend
```bash
cd messay/backend
npm run dev
```

### 2. Admin Dashboard
```bash
cd messay/admin-dashboard
npm run dev
```

### 3. Mobile App
```bash
cd messay/mobile-app
npm start
```

---

## Connexion Admin Dashboard

Une fois le backend démarré:

1. **Ouvrir le dashboard**
   ```
   http://localhost:3000
   ```

2. **Se connecter**
   ```
   Email: admin@messay.com
   Password: password123
   ```

3. **Vérifier les données**
   - Dashboard: Statistiques en temps réel
   - Utilisateurs: Liste depuis la base de données
   - Courses: Historique complet

---

## Dépannage

### Erreur: "Cannot connect to database"
```bash
# Vérifier que PostgreSQL est démarré
# Windows: Services → PostgreSQL

# Vérifier la connexion
cd messay/backend
npx prisma studio
```

### Erreur: "Module not found"
```bash
cd messay/backend
npm install
```

### Erreur: "Port already in use"
Suivez l'Option 1 ou 2 ci-dessus

---

## Logs Utiles

### Voir les logs du backend
Les logs s'affichent directement dans le terminal où vous avez lancé `npm run dev`

### Logs importants à surveiller
- ✅ Connexion à la base de données
- ✅ Démarrage du serveur
- ✅ Requêtes API
- ❌ Erreurs d'authentification
- ❌ Erreurs de validation

---

## État des Serveurs

### Backend API
- Port: 5000
- URL: http://localhost:5000
- Swagger: http://localhost:5000/api-docs
- Status: ⏳ À démarrer

### Admin Dashboard
- Port: 3000
- URL: http://localhost:3000
- Status: 🟢 Running

### Mobile App
- Port: 8081 (Metro Bundler)
- Status: 🟢 Running

---

## Commandes Utiles

### Backend
```bash
# Démarrer en mode développement
npm run dev

# Voir la base de données
npx prisma studio

# Recharger les données de test
npm run prisma:seed

# Créer une nouvelle migration
npx prisma migrate dev --name nom_migration
```

### Vérifier les Ports
```bash
# Windows
netstat -ano | findstr :5000
netstat -ano | findstr :3000
netstat -ano | findstr :8081

# Voir tous les ports utilisés
netstat -ano
```

---

## 🎯 Checklist de Démarrage

- [ ] PostgreSQL est démarré
- [ ] Port 5000 est libre
- [ ] Backend démarré (`npm run dev`)
- [ ] API répond sur http://localhost:5000/api/health
- [ ] Swagger accessible sur http://localhost:5000/api-docs
- [ ] Dashboard accessible sur http://localhost:3000
- [ ] Mobile app démarrée (`npm start`)
- [ ] Connexion admin fonctionne

---

**Une fois tous les serveurs démarrés, l'application MESSAY est complètement opérationnelle !**
