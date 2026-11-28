/**
 * Ancienne page de sélection des sièges RETIRÉE de MESSAY Mobile.
 *
 * Le voyageur ne choisit pas son siège. La compagnie l'attribue depuis son
 * dashboard uniquement après confirmation serveur du paiement et émission
 * effective du billet. Un ancien lien n'a pas le droit de simuler un stock.
 */
import { Redirect } from 'expo-router';

export default function DeprecatedSeatSelectionRoute() {
  return <Redirect href="/buy-ticket" />;
}
