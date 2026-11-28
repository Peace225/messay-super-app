/**
 * Le parcours de simulation QA n'est plus exposé dans l'application MESSAY.
 * Les anciens liens dirigent vers le parcours de recherche réel : aucun
 * paiement, aucune réservation et aucun billet factice ne sont créés.
 */
import { Redirect } from 'expo-router';

export default function DeprecatedBilletterieQaRoute() {
  return <Redirect href="/buy-ticket" />;
}
