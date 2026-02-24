# Configuration de l'application mobile MESSAY

## Problème de connexion au backend

Si vous rencontrez l'erreur `Network Error` lors de la connexion, suivez ces étapes :

### 1. Vérifier l'adresse IP du backend

L'application mobile doit pouvoir accéder au serveur backend. L'adresse dépend de votre environnement :

#### Pour un émulateur Android :
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
```

#### Pour un appareil physique ou iOS Simulator :
Utilisez votre adresse IP locale. Pour la trouver :

**Windows :**
```bash
ipconfig
```
Cherchez "IPv4 Address" (exemple: 192.168.1.14)

**Mac/Linux :**
```bash
ifconfig | grep "inet "
```

Puis configurez :
```
EXPO_PUBLIC_API_URL=http://VOTRE_IP:5000/api
```

### 2. Mettre à jour le fichier .env

Éditez `mobile-app/.env` avec la bonne adresse :

```env
# API Backend
EXPO_PUBLIC_API_URL=http://192.168.1.14:5000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.14:5000
```

### 3. Redémarrer l'application

Après avoir modifié le `.env`, vous DEVEZ redémarrer complètement l'application :

```bash
# Arrêter le serveur Expo (Ctrl+C)
# Puis relancer
cd mobile-app
npm start
```

Appuyez sur `r` dans le terminal Expo pour recharger l'app.

### 4. Vérifier que le backend est démarré

Assurez-vous que le serveur backend tourne :

```bash
cd backend
npm run dev
```

Vous devriez voir :
```
╔═══════════════════════════════════════════╗
║   🚀 MESSAY API Server                    ║
║   📡 Port: 5000                         ║
╚═══════════════════════════════════════════╝
```

### 5. Tester la connexion

Ouvrez votre navigateur et testez :
```
http://VOTRE_IP:5000/api-docs
```

Si Swagger s'affiche, le backend est accessible.

### 6. Vérifier le pare-feu

Sur Windows, assurez-vous que le port 5000 est autorisé :
- Ouvrez "Pare-feu Windows Defender"
- Cliquez sur "Paramètres avancés"
- Créez une règle entrante pour le port 5000

## Comptes de test

### Utilisateur normal
- Email: `jean.kouassi@example.com`
- Mot de passe: `password123`

### Conducteur
- Email: `moussa.traore@example.com`
- Mot de passe: `password123`

### Chauffeur
- Email: `ibrahim.kone@example.com`
- Mot de passe: `password123`

### Admin
- Email: `admin@messay.com`
- Mot de passe: `password123`

## Dépannage

### L'app ne se connecte toujours pas

1. Vérifiez que votre téléphone et votre PC sont sur le même réseau WiFi
2. Désactivez temporairement le pare-feu pour tester
3. Essayez avec l'émulateur Android (utilisez `10.0.2.2`)
4. Vérifiez les logs du backend pour voir si les requêtes arrivent

### Erreur "Unable to resolve module"

```bash
cd mobile-app
rm -rf node_modules
npm install
```

### L'app ne recharge pas après modification du .env

Arrêtez complètement Expo (Ctrl+C) et relancez avec :
```bash
npm start --clear
```
