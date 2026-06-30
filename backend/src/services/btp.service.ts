// ✅ Utilisation du client configuré dans database.ts
import prisma from '../config/database'; 

export class BTPService {
  /**
   * Obtenir les livraisons d'un chauffeur
   */
  async getChauffeurLivraisons(userId: string) {
    // Trouver le chauffeur
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    // Récupérer les livraisons du chauffeur
    const livraisons = await prisma.commandeBTP.findMany({
      where: {
        chauffeurId: chauffeur.id,
      },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
          },
        },
        camion: {
          select: {
            type: true,
            immatriculation: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return livraisons;
  }

  /**
   * Accepter une livraison
   */
  async accepterLivraison(commandeId: string, userId: string) {
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande) {
      throw new Error('Commande non trouvée');
    }

    if (commande.statut !== 'EN_ATTENTE') {
      throw new Error('Cette commande ne peut plus être acceptée');
    }

    const updatedCommande = await prisma.commandeBTP.update({
      where: { id: commandeId },
      data: {
        chauffeurId: chauffeur.id,
        statut: 'CONFIRMEE',
      },
      include: {
        user: true,
        chauffeur: {
          include: {
            user: true,
          },
        },
        camion: true,
      },
    });

    return updatedCommande;
  }

  /**
   * Marquer une livraison en route
   */
  async enRouteLivraison(commandeId: string, userId: string) {
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande || commande.chauffeurId !== chauffeur.id) {
      throw new Error('Commande non trouvée ou accès non autorisé');
    }

    if (commande.statut !== 'CONFIRMEE') {
      throw new Error('Cette livraison ne peut pas être démarrée');
    }

    return await prisma.commandeBTP.update({
      where: { id: commandeId },
      data: { statut: 'EN_ROUTE' },
      include: {
        user: true,
        chauffeur: { include: { user: true } },
        camion: true,
      },
    });
  }

  /**
   * Marquer une livraison comme livrée
   */
  async livreeLivraison(commandeId: string, userId: string) {
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande || commande.chauffeurId !== chauffeur.id) {
      throw new Error('Commande non trouvée ou accès non autorisé');
    }

    if (commande.statut !== 'EN_ROUTE') {
      throw new Error('Cette livraison ne peut pas être terminée');
    }

    // Mise à jour de la commande et des stats chauffeur
    const [updatedCommande] = await prisma.$transaction([
      prisma.commandeBTP.update({
        where: { id: commandeId },
        data: { statut: 'LIVREE' },
        include: {
          user: true,
          chauffeur: { include: { user: true } },
          camion: true,
        },
      }),
      prisma.chauffeur.update({
        where: { id: chauffeur.id },
        data: { nombreLivraisons: { increment: 1 } },
      }),
    ]);

    return updatedCommande;
  }
}