# 📱 Génération de l'APK MESSAY

## 🚀 Méthode rapide (Recommandée)

### Windows
```powershell
cd mobile-app
.\build-apk.ps1
```

### Mac/Linux
```bash
cd mobile-app
chmod +x build-apk.sh
./build-apk.sh
```

## 📋 Méthode manuelle

### 1. Installer EAS CLI
```bash
npm install -g eas-cli
```

### 2. Se connecter
```bash
cd mobile-app
eas login
```

### 3. Configurer le projet (première fois seulement)
```bash
eas build:configure
```

### 4. Générer l'APK
```bash
# Pour tests (APK)
eas build --platform android --profile preview

# Pour production (AAB)
eas build --platform android --profile production
```

## 📦 Télécharger l'APK

Une fois la build terminée (10-20 minutes) :

1. Le terminal affichera un lien de téléchargement
2. Ou allez sur https://expo.dev et connectez-vous
3. Naviguez vers votre projet → Builds
4. Téléchargez l'APK

## 🔧 Configuration importante

### Avant de générer l'APK de production

Modifiez `mobile-app/.env` :

```env
# ⚠️ Remplacez par votre URL de production
EXPO_PUBLIC_API_URL=https://api.messay.com/api
EXPO_PUBLIC_SOCKET_URL=https://api.messay.com
```

⚠️ **Important** : N'utilisez pas `localhost` ou une IP locale pour une APK de production !

## 📱 Installer l'APK sur Android

1. Téléchargez l'APK sur votre téléphone
2. Ouvrez le fichier APK
3. Autorisez l'installation depuis des sources inconnues si demandé
4. Installez l'application

## 🐛 Dépannage

### "No bundle identifier"
Vérifiez que `android.package` est dans `app.json`

### "Not logged in"
```bash
eas login
```

### Build échoue
Consultez les logs sur https://expo.dev

### Erreur de credentials
```bash
eas credentials
```

## 📊 Suivre vos builds

```bash
# Liste des builds
eas build:list

# Détails d'une build
eas build:view [build-id]

# Annuler une build
eas build:cancel
```

## 🎯 Profils de build

- **development** : Pour développement avec Expo Go
- **preview** : APK pour tests (recommandé pour partager)
- **production** : AAB pour Google Play Store

## 📚 Documentation

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Documentation](https://docs.expo.dev/)
- [Guide complet](../BUILD_APK_GUIDE.md)
