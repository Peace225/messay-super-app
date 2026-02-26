#!/bin/bash

echo "🚀 MESSAY - Génération de l'APK"
echo "================================"
echo ""

# Vérifier si EAS CLI est installé
if ! command -v eas &> /dev/null
then
    echo "❌ EAS CLI n'est pas installé"
    echo "📦 Installation en cours..."
    npm install -g eas-cli
fi

echo "✅ EAS CLI est installé"
echo ""

# Vérifier la connexion
echo "🔐 Vérification de la connexion Expo..."
eas whoami

if [ $? -ne 0 ]; then
    echo "❌ Vous n'êtes pas connecté à Expo"
    echo "🔑 Connexion en cours..."
    eas login
fi

echo ""
echo "📱 Quelle version voulez-vous générer ?"
echo "1) APK de développement (pour tests)"
echo "2) APK de prévisualisation (recommandé)"
echo "3) AAB de production (pour Play Store)"
echo ""
read -p "Votre choix (1-3): " choice

case $choice in
    1)
        echo "🔨 Génération de l'APK de développement..."
        eas build --platform android --profile development
        ;;
    2)
        echo "🔨 Génération de l'APK de prévisualisation..."
        eas build --platform android --profile preview
        ;;
    3)
        echo "🔨 Génération de l'AAB de production..."
        eas build --platform android --profile production
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo ""
echo "✅ Build lancée !"
echo "📊 Suivez la progression sur : https://expo.dev"
echo "⏱️  Temps estimé : 10-20 minutes"
