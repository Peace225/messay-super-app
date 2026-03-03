# 🔥 OUVRIR LE PARE-FEU WINDOWS POUR MESSAY

## ⚠️ Problème
Votre téléphone ne peut pas se connecter au backend car le pare-feu Windows bloque le port 5000.

## ✅ Solution 1: Ligne de commande (RAPIDE)

1. **Ouvrir PowerShell en tant qu'Administrateur:**
   - Clic droit sur le menu Démarrer
   - Sélectionner "Windows PowerShell (Admin)" ou "Terminal (Admin)"

2. **Exécuter cette commande:**
```powershell
New-NetFirewallRule -DisplayName "MESSAY Backend API" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

3. **Vérifier:**
```powershell
Get-NetFirewallRule -DisplayName "MESSAY Backend API"
```

---

## ✅ Solution 2: Interface graphique (FACILE)

### Étape 1: Ouvrir le Pare-feu
1. Appuyer sur `Windows + R`
2. Taper: `wf.msc`
3. Appuyer sur Entrée

### Étape 2: Créer une règle
1. Cliquer sur "Règles de trafic entrant" (à gauche)
2. Cliquer sur "Nouvelle règle..." (à droite)

### Étape 3: Configuration
1. **Type de règle:** Port → Suivant
2. **Protocole:** TCP
3. **Ports locaux spécifiques:** 5000 → Suivant
4. **Action:** Autoriser la connexion → Suivant
5. **Profil:** Cocher tout (Domaine, Privé, Public) → Suivant
6. **Nom:** MESSAY Backend API
7. **Description:** Autoriser les connexions au serveur MESSAY sur le port 5000
8. Cliquer sur "Terminer"

---

## 🧪 Test de connexion

### Test 1: Depuis votre PC
Ouvrir le navigateur et aller sur:
```
http://localhost:5000/api-docs
```
✅ Devrait afficher la documentation Swagger

### Test 2: Depuis votre téléphone
1. Ouvrir le navigateur du téléphone (Chrome, Safari, etc.)
2. Aller sur:
```
http://192.168.1.10:5000/api-docs
```

**Si ça charge:** ✅ Le pare-feu est ouvert, l'app devrait fonctionner
**Si ça ne charge pas:** ❌ Problème réseau ou pare-feu encore bloqué

---

## 🔍 Vérifications supplémentaires

### 1. Même réseau WiFi
- PC et téléphone doivent être sur le **même réseau WiFi**
- Vérifier le nom du WiFi sur les deux appareils

### 2. IP du PC
Vérifier que l'IP est toujours 192.168.1.10:
```powershell
ipconfig | Select-String "IPv4"
```

Si l'IP a changé, mettre à jour `mobile-app/.env`

### 3. Backend démarré
Vérifier que le backend tourne:
- Voir le logo MESSAY dans le terminal
- Port 5000 doit être affiché

---

## 🆘 Si ça ne fonctionne toujours pas

### Option A: Désactiver temporairement le pare-feu
**⚠️ Attention: Seulement pour tester!**

1. Ouvrir "Pare-feu Windows Defender"
2. Cliquer sur "Activer ou désactiver le Pare-feu Windows Defender"
3. Désactiver pour le réseau privé
4. Tester l'app
5. **Réactiver ensuite!**

### Option B: Utiliser Expo Tunnel
Si le pare-feu est trop restrictif:

1. Arrêter Expo
2. Relancer avec:
```bash
npx expo start --tunnel
```

3. Cela créera un tunnel public (via ngrok)
4. Utiliser l'URL du tunnel dans `.env`

---

## 📱 Après avoir ouvert le pare-feu

1. **Recharger l'app Expo:**
   - Appuyer sur `r` dans le terminal Expo
   - Ou secouer le téléphone et sélectionner "Reload"

2. **Tester la connexion:**
   - Essayer de se connecter avec: admin@messay.com / password123

---

## ✅ Checklist finale

- [ ] Pare-feu ouvert pour le port 5000
- [ ] Backend démarré (logo MESSAY visible)
- [ ] PC et téléphone sur le même WiFi
- [ ] IP correcte dans `.env` (192.168.1.10)
- [ ] Test navigateur téléphone fonctionne
- [ ] App Expo rechargée

---

**Une fois le pare-feu ouvert, l'app devrait se connecter immédiatement!**
