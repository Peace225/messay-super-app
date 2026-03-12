/**
 * MESSAY Super App - Validators Index
 * Centralise tous les schémas de validation Zod pour l'application.
 */

// 1. Authentification & Utilisateurs
export * from './auth.validator';

// 2. Mobilité Urbaine (Tricycles & Courses)
export * from './course.validator';

// 3. Module BTP (LaCarrière - Commandes & Matériaux)
export * from './btp.validator';

// 4. Paiements (Transactions & Recharges)
export * from './paiement.validator';

// 5. Loisirs & Événementiel (Billetterie)
export * from './event.validator';

// 6. Support Client (Tickets & Messages)
export * from './support.validator';

// 7. Notifications (Optionnel, si tu as des validations spécifiques pour les push)
// export * from './notification.validator';