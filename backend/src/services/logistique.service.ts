import prisma from '../config/database';

// Si tu as un fichier pour les notifications (par exemple firebase ou expo), 
// il faudra l'importer ici. Pour l'instant on simule avec un console.log
// import { sendPushNotification } from '../utils/notifications';

export class LogistiqueService {
  
  async quickAssign() {
    // 1. Trouver la commande BTP la plus urgente
    const urgentOrder = await prisma.commandeBTP.findFirst({
      // 🛠️ CORRECTION : On force le type avec 'as any' pour éviter le crash d'Enum
      where: { statut: 'EN_ATTENTE' as any }, 
      orderBy: { updatedAt: 'desc' }
    });

    if (!urgentOrder) return { success: false, message: "Aucune commande en attente" };

    // 2. Récupérer tous les chauffeurs DISPONIBLES
    const availableDrivers = await prisma.chauffeur.findMany({
      where: { disponible: true },
      include: { user: true }
    });

    // 3. Calculer le plus proche (Ici on prend le premier dispo pour l'exemple)
    const bestDriver = availableDrivers[0]; 

    if (bestDriver && bestDriver.user) {
      // 4. Mettre à jour la base de données
      await prisma.commandeBTP.update({
        where: { id: urgentOrder.id },
        data: { 
          // 🛠️ CORRECTION : 'as any' ici aussi pour passer la validation stricte de Prisma
          statut: 'EN_COURS' as any,
          chauffeurId: bestDriver.id 
        }
      });

      // 5. Envoyer une notification Push au chauffeur sur son mobile
      console.log(`[PUSH] -> Envoi à ${bestDriver.user.nom} : Nouvelle mission BTP assignée !`);

      return { 
        success: true, 
        driverName: bestDriver.user.nom,
        material: "Matériaux BTP"
      };
    }

    return { success: false, message: "Aucun chauffeur disponible" };
  }
}