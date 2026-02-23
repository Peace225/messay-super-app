/**
 * Générateur de reçu PDF
 * Note: Pour une vraie implémentation, utilisez une bibliothèque comme pdfkit ou puppeteer
 */
export async function generatePDF(paiement: any): Promise<Buffer> {
  // Simulation de génération de PDF
  // Dans une vraie application, utilisez pdfkit, puppeteer, ou jsPDF
  
  const content = `
╔═══════════════════════════════════════════╗
║           REÇU DE PAIEMENT                ║
║              MESSAY                       ║
╚═══════════════════════════════════════════╝

Transaction ID: ${paiement.transactionId}
Date: ${new Date(paiement.createdAt).toLocaleString('fr-FR')}

Client:
  Nom: ${paiement.user.prenom} ${paiement.user.nom}
  Email: ${paiement.user.email}
  Téléphone: ${paiement.user.telephone}

Détails du paiement:
  Montant: ${paiement.montant} FCFA
  Moyen: ${paiement.moyen}
  Statut: ${paiement.statut}

${paiement.course ? `
Service: Course Tricycle
  Départ: ${paiement.course.departAdresse}
  Destination: ${paiement.course.destinationAdresse}
` : ''}

${paiement.ticket ? `
Service: Transport Interurbain
  Compagnie: ${paiement.ticket.compagnie}
  Trajet: ${paiement.ticket.depart} → ${paiement.ticket.destination}
` : ''}

${paiement.commandeBTP ? `
Service: BTP Lacarrière
  Matériau: ${paiement.commandeBTP.typeMateriau}
  Quantité: ${paiement.commandeBTP.quantite}
` : ''}

═══════════════════════════════════════════
Merci d'avoir utilisé MESSAY !
Support: support@messay.com
═══════════════════════════════════════════
  `;

  return Buffer.from(content, 'utf-8');
}
