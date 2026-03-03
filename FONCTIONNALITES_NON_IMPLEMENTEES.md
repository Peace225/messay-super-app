# Fonctionnalités Non Implémentées - MESSAY Super App

Ce document liste toutes les fonctionnalités prévues dans le schéma de base de données mais qui n'ont pas encore été implémentées dans l'application.

---

## 🔐 AUTHENTIFICATION & SÉCURITÉ

### 1. Système OTP par SMS
- **Statut**: Partiellement implémenté (simulation uniquement)
- **Localisation**: `backend/src/services/auth.service.ts` (ligne 62)
- **Description**: Le code OTP est généré mais pas envoyé par SMS
- **TODO**:
  - Intégrer un service SMS (Twilio, Vonage, ou opérateur local)
  - Implémenter l'envoi réel du code OTP
  - Ajouter la vérification OTP dans le flux d'inscription mobile
  - Gérer la réexpédition du code OTP

### 2. Refresh Token
- **Statut**: Non implémenté
- **Localisation**: `mobile-app/src/services/api.ts` (ligne 45)
- **Description**: Le refresh token est stocké mais jamais utilisé
- **TODO**:
  - Créer l'endpoint `/api/auth/refresh` dans le backend
  - Implémenter la logique de rafraîchissement automatique du token
  - Gérer l'expiration et le renouvellement des tokens
  - Ajouter la rotation des refresh tokens pour plus de sécurité

### 3. Vérification des Documents
- **Statut**: Non implémenté
- **Champs DB**: `Conducteur.selfieVerification`, `Conducteur.isVerified`, `Chauffeur.isVerified`
- **Description**: Système de vérification d'identité pour conducteurs/chauffeurs
- **TODO**:
  - Upload de selfie pour vérification d'identité
  - Upload de permis de conduire
  - Upload de documents du véhicule
  - Processus de validation admin
  - Statut de vérification visible dans le profil

---

## 🚗 MOBILITÉ URBAINE - TRICYCLES

### 4. Système de Notation des Courses
- **Statut**: Endpoint créé mais logique non implémentée
- **Localisation**: `backend/src/controllers/course.controller.ts` (ligne 109)
- **Champs DB**: `Course.noteConducteur`, `Course.commentaire`
- **TODO**:
  - Implémenter la logique de notation dans le backend
  - Créer l'écran de notation après une course
  - Calculer et mettre à jour la note moyenne du conducteur
  - Afficher les notes et commentaires dans le profil conducteur
  - Système de filtrage des conducteurs par note

### 5. Détails d'une Course Spécifique
- **Statut**: Endpoint créé mais non implémenté
- **Localisation**: `backend/src/controllers/course.controller.ts` (ligne 49)
- **Route**: `GET /api/courses/:id`
- **TODO**:
  - Implémenter la récupération des détails complets
  - Créer l'écran de détails de course dans le mobile
  - Afficher l'itinéraire sur la carte
  - Historique des positions en temps réel
  - Informations du conducteur

### 6. Suivi en Temps Réel de la Position
- **Statut**: Champs DB créés mais non utilisés
- **Champs DB**: `Course.positionLiveLatitude`, `Course.positionLiveLongitude`
- **TODO**:
  - Implémenter WebSocket ou Server-Sent Events
  - Mise à jour de position en temps réel du conducteur
  - Affichage du trajet en direct sur la carte
  - Calcul du temps d'arrivée estimé (ETA)
  - Notifications de proximité

### 7. Partage de Trajet
- **Statut**: Champ DB créé mais fonctionnalité non implémentée
- **Champ DB**: `Course.partageTrajet`
- **TODO**:
  - Logique de matching des trajets similaires
  - Réduction de prix pour trajets partagés
  - Gestion des multiples passagers
  - Itinéraire optimisé avec plusieurs arrêts

---

## 🎫 TRANSPORT INTERURBAIN

### 8. Réservation de Tickets
- **Statut**: Backend implémenté, frontend non connecté
- **Localisation**: `backend/src/controllers/ticket.controller.ts`
- **TODO**:
  - Créer l'écran de réservation dans le mobile
  - Intégrer avec les API des compagnies (UTBS, BTA, RVS)
  - Sélection de siège interactive
  - Calendrier de disponibilité
  - Confirmation par email/SMS

### 9. QR Code pour Tickets
- **Statut**: Génération backend OK, affichage mobile manquant
- **Champ DB**: `Ticket.qrCode`
- **TODO**:
  - Afficher le QR code dans l'écran de détails du ticket
  - Scanner QR code pour validation (côté compagnie)
  - Vérification de l'authenticité du ticket
  - Prévention de la duplication

### 10. Gestion des Statuts de Tickets
- **Statut**: Partiellement implémenté
- **Champs DB**: `TicketStatus` (RESERVE, PAYE, UTILISE, ANNULE, EXPIRE)
- **TODO**:
  - Transition automatique RESERVE → EXPIRE après délai
  - Validation du ticket lors de l'embarquement (PAYE → UTILISE)
  - Remboursement pour tickets annulés
  - Historique des changements de statut

---

## 🎉 LOISIRS & ÉVÉNEMENTIEL

### 11. Gestion Complète des Événements
- **Statut**: Modèle DB créé, aucune implémentation
- **Modèles DB**: `Event`, `BilletEvent`
- **TODO**:
  - CRUD complet des événements (admin)
  - Liste des événements disponibles
  - Filtrage par catégorie, date, lieu
  - Réservation de billets
  - QR code pour billets événements
  - Gestion des places disponibles
  - Notifications avant l'événement

### 12. Catégories d'Événements
- **Statut**: Enum créé mais non utilisé
- **Enum DB**: `EventCategorie` (CONCERT, SPORT, THEATRE, CONFERENCE, FESTIVAL, AUTRE)
- **TODO**:
  - Filtres par catégorie dans EventsScreen
  - Icônes spécifiques par catégorie
  - Recommandations basées sur les préférences
  - Événements populaires par catégorie

---

## 🏗️ MODULE BTP - LACARRIÈRE

### 13. Gestion des Camions
- **Statut**: Modèle DB créé, aucune implémentation
- **Modèle DB**: `Camion`
- **TODO**:
  - CRUD des camions (admin/chauffeur)
  - Association camion ↔ chauffeur
  - Suivi de la position des camions
  - Statut de disponibilité en temps réel
  - Maintenance et historique des camions
  - Capacité et type de camion

### 14. Suivi en Temps Réel des Livraisons BTP
- **Statut**: Champs DB créés mais non utilisés
- **Champs DB**: `CommandeBTP.positionLiveLatitude`, `CommandeBTP.positionLiveLongitude`, `CommandeBTP.etaMinutes`
- **TODO**:
  - Mise à jour de position en temps réel du camion
  - Calcul du temps d'arrivée estimé (ETA)
  - Affichage du trajet sur la carte
  - Notifications de proximité de livraison
  - Historique du trajet

### 15. Notation des Chauffeurs BTP
- **Statut**: Champs DB créés mais non implémentés
- **Champs DB**: `CommandeBTP.noteChauffeur`, `CommandeBTP.commentaire`, `Chauffeur.notation`
- **TODO**:
  - Écran de notation après livraison
  - Calcul de la note moyenne du chauffeur
  - Affichage des notes dans le profil
  - Système de récompenses pour bons chauffeurs

---

## 💳 PAIEMENTS

### 16. Intégration Stripe
- **Statut**: Configuration créée mais non utilisée
- **Localisation**: `backend/src/config/stripe.ts`
- **Champ DB**: `Paiement.stripePaymentId`
- **TODO**:
  - Intégrer Stripe Payment Intent
  - Gestion des cartes bancaires
  - Paiements sécurisés 3D Secure
  - Webhooks pour confirmation de paiement
  - Remboursements

### 17. Mobile Money (Orange Money, MTN MoMo, Wave)
- **Statut**: Enum créé mais non implémenté
- **Enum DB**: `MoyenPaiement`
- **TODO**:
  - Intégration API Orange Money
  - Intégration API MTN Mobile Money
  - Intégration API Wave
  - Gestion des callbacks de paiement
  - Vérification du statut de transaction

### 18. Génération de Reçus PDF
- **Statut**: Fonction créée mais non testée
- **Localisation**: `backend/src/utils/pdf.ts`, `backend/src/controllers/paiement.controller.ts`
- **TODO**:
  - Tester la génération de PDF
  - Design professionnel du reçu
  - Envoi automatique par email
  - Téléchargement depuis l'app mobile
  - Archivage des reçus

### 19. Historique des Paiements
- **Statut**: Backend OK, frontend basique
- **TODO**:
  - Améliorer l'affichage de l'historique
  - Filtres par date, type, statut
  - Recherche de transactions
  - Export en CSV/PDF
  - Statistiques de dépenses

### 20. Gestion des Moyens de Paiement
- **Statut**: Champ DB créé mais non utilisé
- **Champ DB**: `User.moyenPaiement`
- **TODO**:
  - Enregistrer les moyens de paiement préférés
  - Gestion des cartes enregistrées
  - Sélection du moyen de paiement par défaut
  - Sécurisation des données de paiement

---

## 🆘 SUPPORT CLIENT

### 21. Système de Messagerie Support
- **Statut**: Modèle créé, implémentation partielle
- **Modèle DB**: `SupportMessage`
- **TODO**:
  - Interface de chat en temps réel
  - Notifications de nouveaux messages
  - Upload de pièces jointes (photos, documents)
  - Indicateur de lecture des messages
  - Temps de réponse moyen

### 22. Priorisation des Tickets
- **Statut**: Champ créé mais non utilisé
- **Champ DB**: `SupportTicket.priorite` (BASSE, NORMALE, HAUTE, URGENTE)
- **TODO**:
  - Algorithme de priorisation automatique
  - Tri des tickets par priorité (admin)
  - SLA (Service Level Agreement) par priorité
  - Escalade automatique des tickets urgents

### 23. Assignment des Tickets
- **Statut**: Champ créé mais non utilisé
- **Champ DB**: `SupportTicket.assigneA`
- **TODO**:
  - Interface admin pour assigner les tickets
  - Notification de l'agent assigné
  - Réassignation de tickets
  - Statistiques par agent

### 24. Catégories de Support
- **Statut**: Enum créé mais peu utilisé
- **Enum DB**: `TypeDemande` (QUESTION, RECLAMATION, OBJET_PERDU, LITIGE, TECHNIQUE, AUTRE)
- **TODO**:
  - Formulaires spécifiques par type
  - Routage automatique selon la catégorie
  - FAQ par catégorie
  - Résolution automatique pour questions fréquentes

---

## 🔔 NOTIFICATIONS

### 25. Push Notifications
- **Statut**: Structure créée mais non implémentée
- **Localisation**: `backend/src/controllers/notification.controller.ts`
- **TODO**:
  - Intégrer Expo Push Notifications
  - Enregistrement des tokens push
  - Envoi de notifications en temps réel
  - Gestion des permissions
  - Notifications par type (course, paiement, support, etc.)

### 26. Notifications en Temps Réel
- **Statut**: Stockage DB OK, pas de temps réel
- **TODO**:
  - WebSocket ou Server-Sent Events
  - Badge de notifications non lues
  - Son et vibration
  - Actions rapides depuis la notification
  - Historique des notifications

### 27. Préférences de Notifications
- **Statut**: Non implémenté
- **TODO**:
  - Paramètres de notifications dans le profil
  - Activer/désactiver par type
  - Horaires de silence
  - Fréquence des notifications

---

## 👤 PROFIL UTILISATEUR

### 28. Upload de Photo de Profil
- **Statut**: Champ DB créé mais non implémenté
- **Champ DB**: `User.photo`
- **TODO**:
  - Upload d'image depuis la galerie ou caméra
  - Redimensionnement et compression
  - Stockage sur serveur ou cloud (S3, Cloudinary)
  - Affichage de la photo dans le profil
  - Suppression/changement de photo

### 29. Gestion Complète du Profil
- **Statut**: Écran basique créé
- **TODO**:
  - Modification de toutes les informations
  - Changement de mot de passe
  - Vérification de l'email
  - Vérification du téléphone
  - Suppression du compte
  - Export des données personnelles (RGPD)

---

## 📊 STATISTIQUES & ANALYTICS

### 30. Dashboard Admin Complet
- **Statut**: Structure créée, données limitées
- **Localisation**: `admin-dashboard/`
- **TODO**:
  - Statistiques en temps réel
  - Graphiques de revenus
  - Nombre d'utilisateurs actifs
  - Courses/livraisons par jour/semaine/mois
  - Taux de conversion
  - Zones les plus actives (heatmap)

### 31. Rapports et Exports
- **Statut**: Non implémenté
- **TODO**:
  - Export des données en CSV/Excel
  - Rapports financiers
  - Rapports d'activité
  - Rapports de performance des conducteurs/chauffeurs
  - Génération automatique de rapports périodiques

---

## ⚙️ CONFIGURATION & PARAMÈTRES

### 32. Tarification Dynamique
- **Statut**: Modèle créé mais non utilisé
- **Modèle DB**: `TarifCourse`
- **TODO**:
  - Interface admin pour modifier les tarifs
  - Tarifs variables selon l'heure (heures de pointe)
  - Tarifs variables selon la demande
  - Promotions et codes promo
  - Historique des changements de tarifs

### 33. Configuration Système
- **Statut**: Modèle créé mais non utilisé
- **Modèle DB**: `Configuration`
- **TODO**:
  - Paramètres globaux de l'application
  - Maintenance mode
  - Messages d'annonce
  - Versions minimales requises
  - URLs de services externes

---

## 🔍 RECHERCHE & FILTRES

### 34. Recherche Avancée
- **Statut**: Non implémenté
- **TODO**:
  - Recherche d'adresses avec autocomplétion
  - Recherche d'événements
  - Recherche dans l'historique
  - Filtres multiples
  - Sauvegarde des recherches fréquentes

---

## 🌐 LOCALISATION & CARTES

### 35. Calcul d'Itinéraire Optimisé
- **Statut**: Distance calculée mais pas d'itinéraire
- **TODO**:
  - Intégration Google Maps Directions API
  - Affichage de l'itinéraire sur la carte
  - Itinéraires alternatifs
  - Évitement des zones interdites
  - Calcul du temps de trajet réel

### 36. Adresses Favorites
- **Statut**: Non implémenté
- **TODO**:
  - Enregistrer des adresses (Maison, Travail, etc.)
  - Sélection rapide depuis les favoris
  - Modification/suppression des favoris
  - Suggestions basées sur l'historique

---

## 🔒 SÉCURITÉ & CONFORMITÉ

### 37. Logs d'Audit
- **Statut**: Non implémenté
- **TODO**:
  - Traçabilité des actions importantes
  - Logs de connexion
  - Logs de modifications
  - Détection d'activités suspectes
  - Conformité RGPD

### 38. Gestion des Rôles et Permissions
- **Statut**: Rôles créés mais permissions basiques
- **TODO**:
  - Permissions granulaires par rôle
  - Rôle PARTENAIRE non utilisé
  - Gestion des accès admin
  - Audit des permissions

---

## 📱 EXPÉRIENCE UTILISATEUR

### 39. Mode Hors Ligne
- **Statut**: Non implémenté
- **TODO**:
  - Cache des données essentielles
  - Synchronisation à la reconnexion
  - Indicateur de statut de connexion
  - Actions en file d'attente

### 40. Onboarding & Tutoriel
- **Statut**: Non implémenté
- **TODO**:
  - Écrans d'introduction
  - Tutoriel interactif
  - Tooltips pour nouvelles fonctionnalités
  - Skip du tutoriel

### 41. Multilingue
- **Statut**: Non implémenté (français uniquement)
- **TODO**:
  - Support de l'anglais
  - Langues locales (Dioula, Baoulé, etc.)
  - Détection automatique de la langue
  - Changement de langue dans les paramètres

---

## 📈 RÉSUMÉ PAR PRIORITÉ

### 🔴 PRIORITÉ HAUTE (Fonctionnalités critiques)
1. Système OTP par SMS
2. Refresh Token
3. Intégration Mobile Money
4. Push Notifications
5. Suivi en temps réel des courses
6. Système de notation
7. Upload de photo de profil

### 🟡 PRIORITÉ MOYENNE (Amélioration de l'expérience)
8. Réservation de tickets transport
9. Gestion complète des événements
10. Gestion des camions BTP
11. Historique et filtres avancés
12. Dashboard admin complet
13. Tarification dynamique
14. Adresses favorites

### 🟢 PRIORITÉ BASSE (Nice to have)
15. Partage de trajet
16. Mode hors ligne
17. Multilingue
18. Rapports et exports
19. Logs d'audit
20. Onboarding

---

## 📊 STATISTIQUES

- **Total de fonctionnalités prévues**: 41
- **Fonctionnalités implémentées**: ~15 (37%)
- **Fonctionnalités partielles**: ~10 (24%)
- **Fonctionnalités non implémentées**: ~16 (39%)

---

**Date de génération**: 3 mars 2026
**Version**: 1.0
