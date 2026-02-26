# Guide de génération de l'APK MESSAY

## Prérequis

1. Compte Expo (gratuit) : https://expo.dev/signup
2. EAS CLI installé globalement

## Étape 1 : Installer EAS CLI

```bash
npm install -g eas-cli
```

## Étape 2 : Se connecter à Expo

```bash
cd mobile-app
eas login
```

Entrez vos identifiants Expo.

## Étape 3 : Configurer le projet pour EAS Build

```bash
eas build:configure
```

Cette commande va créer un fichier `eas.json` avec la configuration de build.

## Étape 4 : Mettre à jour app.json (déjà fait)

Le fichier `app.json` contient déjà :
- `android.package`: "com.messay.app"
- `ios.bundleIdentifier`: "com.messay.app"
- Permissions nécessaires

## Étape 5 : Générer l'APK

### Option A : APK pour développement (recommandé pour test)

```bash
eas build --platform android --profile preview
```

Cela génère un APK que vous pouvez installer directement sur n'importe quel appareil Android.

### Option B : AAB pour Google Play Store

```bash
eas build --platform android --profile production
```

Cela génère un fichier AAB (Android App Bundle) pour publication sur le Play Store.

## Étape 6 : Suivre la progression

- La build se fait sur les serveurs Expo (cloud)
- Vous recevrez un lien pour télécharger l'APK une fois terminé
- Le processus prend environ 10-20 minutes

## Étape 7 : Télécharger l'APK

Une fois la build terminée :
1. Cliquez sur le lien fourni dans le terminal
2. Ou allez sur https://expo.dev/accounts/[votre-compte]/projects/messay-super-app/builds
3. Téléchargez l'APK

## Alternative : Build locale (plus rapide mais plus complexe)

Si vous voulez générer l'APK localement sans passer par les serveurs Expo :

### Prérequis supplémentaires :
- Android Studio installé
- Java JDK 11 ou supérieur
- Variables d'environnement Android configurées

### Commandes :

```bash
# Installer les dépendances
npm install

# Générer le bundle natif
npx expo prebuild --platform android

# Build avec Gradle
cd android
./gradlew assembleRelease

# L'APK sera dans : android/app/build/outputs/apk/release/app-release.apk
```

## Configuration EAS recommandée (eas.json)

Créez un fichier `eas.json` à la racine de `mobile-app` :

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## Profils de build expliqués

- **development** : Pour développement avec Expo Go
- **preview** : Génère un APK pour tests internes (recommandé)
- **production** : Génère un AAB pour le Play Store

## Commandes utiles

```bash
# Voir l'historique des builds
eas build:list

# Annuler une build en cours
eas build:cancel

# Voir les détails d'une build
eas build:view [build-id]

# Soumettre au Play Store (après avoir configuré les credentials)
eas submit --platform android
```

## Tester l'APK

1. Transférez l'APK sur votre téléphone Android
2. Activez "Sources inconnues" dans les paramètres
3. Installez l'APK
4. Lancez l'application

## Important : Configuration de l'API

Avant de générer l'APK, assurez-vous que le fichier `.env` contient la bonne URL de l'API :

```env
# Pour un serveur de production
EXPO_PUBLIC_API_URL=https://api.messay.com/api

# Pour un serveur local (développement uniquement)
EXPO_PUBLIC_API_URL=http://VOTRE_IP:5000/api
```

⚠️ **Note** : Pour une APK de production, vous devez utiliser une URL publique accessible depuis Internet, pas `localhost` ou une IP locale.

## Dépannage

### Erreur "No bundle identifier"
- Vérifiez que `android.package` est défini dans `app.json`

### Erreur de credentials
```bash
eas credentials
```
Suivez les instructions pour configurer les credentials Android.

### Build échoue
- Vérifiez les logs sur https://expo.dev
- Assurez-vous que toutes les dépendances sont compatibles avec Expo

## Ressources

- Documentation EAS Build : https://docs.expo.dev/build/introduction/
- Forum Expo : https://forums.expo.dev/
- Discord Expo : https://chat.expo.dev/
