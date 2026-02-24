import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    // Trouver le chauffeur
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    // Vérifier que la commande existe et est en attente
    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande) {
      throw new Error('Commande non trouvée');
    }

    if (commande.statut !== 'EN_ATTENTE') {
      throw new Error('Cette commande ne peut plus être acceptée');
    }

    // Mettre à jour la commande
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
    // Trouver le chauffeur
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    // Vérifier que la commande existe et est confirmée
    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande) {
      throw new Error('Commande non trouvée');
    }

    if (commande.chauffeurId !== chauffeur.id) {
      throw new Error('Vous n\'êtes pas le chauffeur de cette livraison');
    }

    if (commande.statut !== 'CONFIRMEE') {
      throw new Error('Cette livraison ne peut pas être démarrée');
    }

    // Mettre à jour la commande
    const updatedCommande = await prisma.commandeBTP.update({
      where: { id: commandeId },
      data: {
        statut: 'EN_ROUTE',
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
   * Marquer une livraison comme livrée
   */
  async livreeLivraison(commandeId: string, userId: string) {
    // Trouver le chauffeur
    const chauffeur = await prisma.chauffeur.findUnique({
      where: { userId },
    });

    if (!chauffeur) {
      throw new Error('Chauffeur non trouvé');
    }

    // Vérifier que la commande existe et est en route
    const commande = await prisma.commandeBTP.findUnique({
      where: { id: commandeId },
    });

    if (!commande) {
      throw new Error('Commande non trouvée');
    }

    if (commande.chauffeurId !== chauffeur.id) {
      throw new Error('Vous n\'êtes pas le chauffeur de cette livraison');
    }

    if (commande.statut !== 'EN_ROUTE') {
      throw new Error('Cette livraison ne peut pas être terminée');
    }

    // Mettre à jour la commande
    const updatedCommande = await prisma.commandeBTP.update({
      where: { id: commandeId },
      data: {
        statut: 'LIVREE',
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

    // Mettre à jour les statistiques du chauffeur
    await prisma.chauffeur.update({
      where: { id: chauffeur.id },
      data: {
        nombreLivraisons: {
          increment: 1,
        },
      },
    });

    return updatedCommande;
  }
}
