# 🚀 Guide Rapide - Générer l'APK MESSAY

## ✅ Configuration terminée !

Votre projet est maintenant configuré sur EAS Build.

## 📱 Générer l'APK maintenant

### Étape 1 : Lancer la build

```bash
cd mobile-app
eas build --platform android --profile preview
```

### Étape 2 : Répondre aux questions

Quand on vous demande :

**"Generate a new Android Keystore?"**
- Répondez : `Y` (Oui)

**"Would you like to upload a Keystore or have us generate one for you?"**
- Répondez : `Generate new keystore`

### Étape 3 : Attendre la build

- La build se lance sur les serveurs Expo
- Durée : 10-20 minutes
- Vous pouvez fermer le terminal, la build continue

### Étape 4 : Télécharger l'APK

Une fois terminé, vous verrez :

```
✔ Build finished
🔗 https://expo.dev/accounts/[votre-compte]/projects/messay-super-app/builds/[build-id]
```

Cliquez sur le lien ou allez sur https://expo.dev pour télécharger l'APK.

## 🎯 Commandes utiles

```bash
# Voir l'état de la build en cours
eas build:list

# Voir les détails d'une build
eas build:view [build-id]

# Annuler une build
eas build:cancel
```

## 📦 Installer l'APK

1. Téléchargez l'APK sur votre téléphone Android
2. Ouvrez le fichier
3. Autorisez l'installation depuis des sources inconnues
4. Installez l'application

## 🔄 Builds futures

Pour les prochaines builds, c'est encore plus simple :

```bash
eas build --platform android --profile preview
```

Pas besoin de reconfigurer, le keystore est sauvegardé sur Expo.

## 🌐 Accéder au dashboard

https://expo.dev/accounts/nflorent/projects/messay-super-app

## ⚠️ Important

Avant de partager l'APK, assurez-vous que le fichier `.env` contient la bonne URL de l'API :

```env
# Pour production
EXPO_PUBLIC_API_URL=https://votre-api.com/api

# Pour développement local
EXPO_PUBLIC_API_URL=http://192.168.1.14:5000/api
```

## 🐛 Problèmes ?

### Build échoue
- Consultez les logs sur https://expo.dev
- Vérifiez que toutes les dépendances sont installées

### Erreur de credentials
```bash
eas credentials
```

### Besoin d'aide
- Documentation : https://docs.expo.dev/build/introduction/
- Forum : https://forums.expo.dev/
