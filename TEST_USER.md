# 🔑 Identifiants de Test MESSAY

## Utilisateurs de Test

### Utilisateur Standard (Jean Kouassi)
```
Email: jean.kouassi@example.com
Password: password123
Téléphone: +2250701234567
Rôle: USER
```

### Conducteur (Moussa Traoré)
```
Email: moussa.traore@example.com
Password: password123
Téléphone: +2250703456789
Rôle: CONDUCTEUR
```

### Admin
```
Email: admin@messay.com
Password: password123
Téléphone: +2250700000000
Rôle: ADMIN
```

## Configuration Mobile App

L'URL de l'API est configurée dans `mobile-app/.env`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.4:5000/api
```

Assurez-vous que:
1. Le backend est démarré sur le port 5000
2. Votre téléphone et ordinateur sont sur le même WiFi
3. L'adresse IP 192.168.1.4 correspond à votre ordinateur

## Test avec Swagger

1. Ouvrir: http://localhost:5000/api-docs
2. Tester POST /api/auth/login
3. Utiliser un des comptes ci-dessus

## Test avec Mobile App

1. Ouvrir l'app (mode invité activé)
2. Pour se connecter, cliquer sur "Connexion" en haut à droite
3. Utiliser: jean.kouassi@example.com / password123

## Test avec Dashboard Admin

1. Ouvrir: http://localhost:3000
2. Se connecter avec: admin@messay.com / password123
3. Fonctionnalités disponibles:
   - Voir tous les utilisateurs
   - Voir détails d'un utilisateur
   - Bloquer/Débloquer un utilisateur
   - Ajouter un conducteur
   - Modifier un conducteur
   - Supprimer un conducteur

## Inscription

Pour tester l'inscription, utilisez:
```
Nom: Test
Prénom: User
Email: nouveautest@messay.com
Téléphone: +2250799999999
Password: password123
```

## Vérification

Si l'inscription/connexion échoue:
1. Vérifier que le backend est démarré (port 5000)
2. Vérifier l'URL dans mobile-app/.env: EXPO_PUBLIC_API_URL=http://192.168.1.4:5000/api
3. Vérifier que le téléphone et l'ordinateur sont sur le même WiFi
4. Tester avec Swagger d'abord pour confirmer que l'API fonctionne
5. Vérifier les logs du backend pour voir les erreurs

## Navigation Mobile

- Le profil est maintenant en haut à droite (icône avatar ou bouton "Connexion")
- La navigation du bas contient: Accueil, Tricycle, Tickets, Lacarrière
- Le profil n'est plus dans la navigation du bas pour alléger l'interface
