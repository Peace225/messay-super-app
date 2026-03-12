# Script PowerShell pour générer l'APK MESSAY

Write-Host "🚀 MESSAY - Génération de l'APK" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si EAS CLI est installé
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue

if (-not $easInstalled) {
    Write-Host "❌ EAS CLI n'est pas installé" -ForegroundColor Red
    Write-Host "📦 Installation en cours..." -ForegroundColor Yellow
    npm install -g eas-cli
}

Write-Host "✅ EAS CLI est installé" -ForegroundColor Green
Write-Host ""

# Vérifier la connexion
Write-Host "🔐 Vérification de la connexion Expo..." -ForegroundColor Yellow
$whoami = eas whoami 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vous n'êtes pas connecté à Expo" -ForegroundColor Red
    Write-Host "🔑 Connexion en cours..." -ForegroundColor Yellow
    eas login
}

Write-Host ""
Write-Host "📱 Quelle version voulez-vous générer ?" -ForegroundColor Cyan
Write-Host "1) APK de développement (pour tests)"
Write-Host "2) APK de prévisualisation (recommandé)"
Write-Host "3) AAB de production (pour Play Store)"
Write-Host ""

$choice = Read-Host "Votre choix (1-3)"

switch ($choice) {
    "1" {
        Write-Host "🔨 Génération de l'APK de développement..." -ForegroundColor Yellow
        eas build --platform android --profile development
    }
    "2" {
        Write-Host "🔨 Génération de l'APK de prévisualisation..." -ForegroundColor Yellow
        eas build --platform android --profile preview
    }
    "3" {
        Write-Host "🔨 Génération de l'AAB de production..." -ForegroundColor Yellow
        eas build --platform android --profile production
    }
    default {
        Write-Host "❌ Choix invalide" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Build lancée !" -ForegroundColor Green
Write-Host "📊 Suivez la progression sur : https://expo.dev" -ForegroundColor Cyan
Write-Host "⏱️  Temps estimé : 10-20 minutes" -ForegroundColor Yellow
