# 🔍 DIAGNOSTIC DE CONNEXION - MESSAY APP

## ❌ Problème actuel
**Erreur:** AxiosError: Network Error lors de la connexion

## 🎯 Solutions à tester dans l'ordre

### Solution 1: Émulateur Android (RECOMMANDÉ)
Si vous utilisez un **émulateur Android**, l'adresse IP doit être `10.0.2.2`:

**Fichier:** `mobile-app/.env`
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

**Actions:**
1. Modifiez le fichier `.env` avec l'adresse ci-dessus
2. Arrêtez l'app Expo (Ctrl+C)
3. Relancez avec `npx expo start --clear`
4. Appuyez sur `r` pour recharger l'app

---

### Solution 2: Appareil physique Android/iOS
Si vous utilisez un **téléphone physique**, utilisez l'IP de votre PC:

**Fichier:** `mobile-app/.env`
```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.10:5000
```

**Vérifications importantes:**
- ✅ Le téléphone et le PC sont sur le **même réseau WiFi**
- ✅ Le pare-feu Windows autorise le port 5000
- ✅ L'IP du PC est bien 192.168.1.10 (vérifier avec `ipconfig`)

---

### Solution 3: Vérifier le pare-feu Windows

Le pare-feu peut bloquer les connexions entrantes sur le port 5000.

**Ouvrir le port 5000:**
```powershell
# Exécuter en tant qu'administrateur
New-NetFirewallRule -DisplayName "MESSAY Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

Ou manuellement:
1. Ouvrir "Pare-feu Windows Defender"
2. Règles de trafic entrant > Nouvelle règle
3. Type: Port > TCP > Port 5000
4. Action: Autoriser la connexion
5. Nom: "MESSAY Backend"

---

### Solution 4: Tester la connexion backend

**Test 1: Depuis votre navigateur**
Ouvrez: http://localhost:5000/api-docs

Si ça fonctionne, le backend est OK.

**Test 2: Depuis votre téléphone**
Ouvrez le navigateur du téléphone et allez sur:
- http://192.168.1.10:5000/api-docs

Si ça ne charge pas, c'est un problème réseau/pare-feu.

---

### Solution 5: Vérifier l'IP actuelle du PC

```powershell
ipconfig | Select-String "IPv4"
```

Résultat actuel: **192.168.1.10**

Si l'IP a changé, mettez à jour le fichier `.env`.

---

### Solution 6: Redémarrer complètement

1. **Arrêter le backend:**
   - Aller dans le terminal backend
   - Ctrl+C

2. **Arrêter Expo:**
   - Aller dans le terminal Expo
   - Ctrl+C

3. **Nettoyer le cache:**
   ```bash
   cd mobile-app
   npx expo start --clear
   ```

4. **Redémarrer le backend:**
   ```bash
   cd backend
   npm run dev
   ```

5. **Attendre 10 secondes** que tout démarre

6. **Recharger l'app** (appuyer sur `r` dans Expo)

---

## 🔧 Configuration actuelle

### Backend
- **Port:** 5000
- **Status:** ✅ Démarré
- **URL locale:** http://localhost:5000
- **URL réseau:** http://192.168.1.10:5000

### Mobile App (.env)
- **API_URL:** http://10.0.2.2:5000/api (émulateur)
- **Alternative:** http://192.168.1.10:5000/api (physique)

### CORS Backend
- **Origin:** * (accepte toutes les origines)
- **Methods:** GET, POST
- **Credentials:** true

---

## 📱 Identifier votre environnement

### Vous utilisez un ÉMULATEUR si:
- Vous avez lancé l'app avec Android Studio
- Vous voyez "Android Emulator" dans le titre
- L'app tourne dans une fenêtre sur votre PC

➡️ **Utilisez:** `http://10.0.2.2:5000/api`

### Vous utilisez un APPAREIL PHYSIQUE si:
- Vous avez scanné le QR code Expo
- L'app tourne sur votre téléphone réel
- Vous êtes connecté au même WiFi que votre PC

➡️ **Utilisez:** `http://192.168.1.10:5000/api`

---

## 🐛 Debug avancé

### Voir les logs backend en temps réel
Le backend devrait afficher les requêtes entrantes. Si vous ne voyez rien quand vous tentez de vous connecter, c'est que la requête n'arrive pas au serveur.

### Tester avec curl (depuis le PC)
```bash
curl http://localhost:5000/api/auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"admin@messay.com\",\"password\":\"password123\"}"
```

Si ça fonctionne, le backend est OK et c'est un problème de connexion mobile.

### Vérifier les variables d'environnement dans l'app
Ajoutez temporairement dans `LoginScreen.tsx`:
```typescript
console.log('API_URL:', process.env.EXPO_PUBLIC_API_URL);
```

Cela affichera l'URL utilisée dans les logs Expo.

---

## ✅ Checklist de vérification

- [ ] Backend démarré (voir le logo MESSAY dans le terminal)
- [ ] Port 5000 ouvert dans le pare-feu
- [ ] Fichier `.env` avec la bonne IP
- [ ] Cache Expo nettoyé (`--clear`)
- [ ] App rechargée après modification du `.env`
- [ ] Même réseau WiFi (si appareil physique)
- [ ] Test navigateur fonctionne (http://localhost:5000/api-docs)

---

## 🆘 Si rien ne fonctionne

**Option de secours: Utiliser Expo Tunnel**

1. Arrêter Expo
2. Relancer avec tunnel:
   ```bash
   npx expo start --tunnel
   ```

3. Modifier `.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://votre-url-tunnel.ngrok.io/api
   ```

Cela créera un tunnel public vers votre backend, contournant les problèmes réseau.

---

**Dernière mise à jour:** 27 Février 2026, 16:15
