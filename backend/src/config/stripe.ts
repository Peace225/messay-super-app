import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY manquante dans les variables d\'environnement');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // 🚩 Changé ici pour correspondre aux types installés
  apiVersion: '2023-08-16' as any, 
  typescript: true,
});

export default stripe;