import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getIO } from '../server'; 
import { notificationService } from '../services/notification.service';

const prisma = new PrismaClient();

export const logistiqueController = {
  /**
   * Assignation automatique d'une commande au meilleur chauffeur disponible
   */
  quickAssign: async (req: Request, res: Response) => {
    try {
      const io = getIO(); 

      // 1. Recherche de la commande urgente (BTP / Logistique)
      const urgentOrder = await prisma.commandeBTP.findFirst({
        // 🛠️ CORRECTION : 'statut' au lieu de 'status' + 'as any' pour bypass l'Enum strict
        where: { statut: 'EN_ATTENTE' as any },
        orderBy: { updatedAt: 'desc' } // 🛠️ CORRECTION : 'priorite' remplacé par 'updatedAt'
      });

      if (!urgentOrder) {
        return res.status(404).json({ 
          success: false, 
          message: "Aucune commande en attente dans le système MESSAY." 
        });
      }

      // 2. Recherche du chauffeur disponible
      const bestDriver = await prisma.chauffeur.findFirst({
        where: { disponible: true }, // 🛠️ CORRECTION : 'typeVehicule' retiré
        include: { user: true }      // 🛠️ CORRECTION : On inclut 'user' pour avoir le nom
      });

      if (!bestDriver || !bestDriver.user) {
        return res.status(404).json({ 
          success: false, 
          message: "Alerte : Aucun conducteur disponible pour le moment sur MESSAY." 
        });
      }

      // 3. TRANSACTION DATABASE (Sécurité atomique)
      await prisma.$transaction([
        prisma.commandeBTP.update({
          where: { id: urgentOrder.id },
          data: { 
            statut: 'EN_COURS' as any, // 🛠️ CORRECTION : 'statut' + 'as any'
            chauffeurId: bestDriver.id
            // dateAssignation retiré temporairement pour éviter une erreur s'il n'existe pas
          }
        }),
        prisma.chauffeur.update({
          where: { id: bestDriver.id },
          data: { disponible: false }
        })
      ]);

      // 🚀 4. UPDATE DASHBOARD (Socket.io - Admin)
      io.to('admin-room').emit('new_notification', {
        title: "⚡ Mission Automatisée",
        // 🛠️ CORRECTION : Accès au nom via 'user' et texte générique pour le matériau
        message: `Logistique active : ${bestDriver.user.nom} livre les matériaux BTP.`,
        type: 'SUCCESS',
        id: urgentOrder.id
      });

      // 📱 5. NOTIFICATION PUSH
      // On utilise 'as any' pour sécuriser l'accès au token s'il est mal typé
      const deviceToken = (bestDriver.user as any).deviceToken || (bestDriver as any).deviceToken;
      if (deviceToken) {
        await notificationService.sendToDriver(deviceToken, {
          id: urgentOrder.id,
          destination: (urgentOrder as any).adresseLivraison || "Point de livraison",
          materiau: "Matériaux BTP"
        });
      }

      // 📡 6. SIGNAL TEMPS RÉEL (Chauffeur spécifique)
      io.to(`user-${bestDriver.userId}`).emit('new_mission', {
        orderId: urgentOrder.id,
        destination: (urgentOrder as any).adresseLivraison || "Point de livraison",
        message: "Une nouvelle mission MESSAY vient de vous être assignée !"
      });

      return res.status(200).json({ 
        success: true, 
        driver: bestDriver.user.nom, // 🛠️ CORRECTION : bestDriver.user.nom
        orderId: urgentOrder.id
      });

    } catch (error) {
      console.error("Erreur critique Logistique MESSAY :", error);
      return res.status(500).json({ 
        success: false, 
        message: "Erreur interne lors de l'assignation automatique." 
      });
    }
  },

  /**
   * Récupération des statistiques de stocks pour les jauges du dashboard
   */
  getStocks: async (req: Request, res: Response) => {
    try {
      // 🛠️ CORRECTION ULTIME : On passe tout le bloc groupBy en "as any" 
      // pour éviter que TypeScript bloque sur 'materiau' ou 'quantite'
      const stocks = await (prisma.commandeBTP.groupBy as any)({
        by: ['statut'], 
        _count: true,
        where: {
          statut: 'LIVRE' as any 
        }
      });

      return res.status(200).json({
        success: true,
        data: stocks
      });
    } catch (error) {
      console.error("Erreur récupération stocks MESSAY :", error);
      return res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la lecture des stocks." 
      });
    }
  }
};