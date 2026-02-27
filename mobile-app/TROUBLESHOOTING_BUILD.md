# 🔧 Dépannage Build APK

## Erreur actuelle : "Bundle JavaScript build phase"

Cette erreur indique un problème lors de la compilation du code JavaScript/TypeScript.

## Solutions à essayer

### 1. Vérifier les logs détaillés

Allez sur le lien fourni par EAS Build et consultez la section "Bundle JavaScript" pour voir l'erreur exacte.

### 2. Tester localement

```bash
cd mobile-app

# Vérifier les erreurs TypeScript
npx tsc --noEmit

# Tester le bundling
npx expo export

# Si ça fonctionne localement, le problème vient d'EAS
```

### 3. Nettoyer et réinstaller

```bash
# Supprimer les caches
rm -rf node_modules
rm package-lock.json
rm -rf .expo

# Réinstaller
npm install

# Relancer la build
eas build --platform android --profile preview --clear-cache
```

### 4. Vérifier les dépendances problématiques

Les dépendances suivantes peuvent causer des problèmes :
- `react-native-maps` - Nécessite une configuration Google Maps
- `@stripe/stripe-react-native` - Nécessite une configuration Stripe
- `expo-notifications` - Nécessite des permissions

### 5. Build sans certaines fonctionnalités

Si le problème persiste, on peut temporairement désactiver certaines fonctionnalités :

**Option A : Sans carte (temporaire)**
- Commenter l'import de `react-native-maps` dans `TricycleScreen.tsx`
- Utiliser une liste simple au lieu de la carte

**Option B : Sans notifications**
- Retirer `expo-notifications` du `package.json`

### 6. Vérifier app.json

Assurez-vous que `app.json` est valide :

```json
{
  "expo": {
    "name": "MESSAY",
    "slug": "messay-super-app",
    "version": "1.0.0",
    "android": {
      "package": "com.messay.app",
      "versionCode": 1
    }
  }
}
```

### 7. Vérifier .npmrc

Le fichier `.npmrc` doit contenir :
```
legacy-peer-deps=true
```

### 8. Variables d'environnement

Vérifiez que `.env` est correct :
```env
EXPO_PUBLIC_API_URL=http://192.168.1.14:5000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.14:5000
```

## Commandes utiles

```bash
# Voir les logs de build
eas build:list

# Voir une build spécifique
eas build:view [build-id]

# Build avec logs verbeux
eas build --platform android --profile preview --clear-cache

# Tester le bundle localement
npx expo export --platform android
```

## Erreurs communes

### "Cannot find module"
- Vérifiez que toutes les dépendances sont installées
- Vérifiez les imports dans les fichiers

### "Duplicate module"
- Nettoyez node_modules et réinstallez

### "Out of memory"
- Réduisez la taille des assets
- Optimisez les images

### "Gradle build failed"
- Problème de configuration Android
- Vérifiez `android.package` dans `app.json`

## Dernière solution : Build locale

Si EAS Build continue d'échouer, vous pouvez build localement :

```bash
# Prérequis : Android Studio installé

# Générer les fichiers natifs
npx expo prebuild --platform android

# Build avec Gradle
cd android
./gradlew assembleRelease

# L'APK sera dans : android/app/build/outputs/apk/release/
```

## Support

- Logs EAS : https://expo.dev/accounts/nflorent/projects/messay-super-app/builds
- Forum Expo : https://forums.expo.dev/
- Discord Expo : https://chat.expo.dev/
