
import type { Request, Response } from "express";
import {
  NotificationType,
  SupportStatus,
  TypeDemande,
  UserRole,
} from "@prisma/client";

import prisma from "../config/database";

/**
 * Compatible avec les propriétés ajoutées à Express
 * par le middleware d'authentification.
 *
 * On n'étend pas Request avec une interface qui
 * redéfinit userRole en string.
 */
type SessionRequest = Request & {
  user?: {
    id?: string;
    role?: UserRole;
  };
};

/**
 * Récupère l'identifiant utilisateur transmis
 * par le middleware JWT.
 */
function getUserId(req: Request): string | undefined {
  const sessionReq = req as SessionRequest;

  const userId = req.userId ?? sessionReq.user?.id;

  if (typeof userId !== "string" || !userId.trim()) {
    return undefined;
  }

  return userId;
}

/**
 * Réponse standard en cas d'erreur interne.
 * Ne divulgue pas les détails SQL ou Prisma.
 */
function handleServerError(
  res: Response,
  error: unknown,
  context: string
): void {
  console.error(`[SupportController] ${context}:`, error);

  res.status(500).json({
    error: "Une erreur interne est survenue",
  });
}

/**
 * Contrôleur de gestion du support MESSAY.
 *
 * Les routes doivent utiliser le middleware
 * d'authentification JWT.
 */
export class SupportController {
  /**
   * POST /api/support/tickets
   * Créer un ticket de support.
   */
  async createTicket(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      const {
        typeDemande,
        sujet,
        message,
      } = req.body ?? {};

      if (
        typeof typeDemande !== "string" ||
        typeof sujet !== "string" ||
        typeof message !== "string" ||
        !sujet.trim() ||
        !message.trim()
      ) {
        res.status(400).json({
          error: "Tous les champs sont requis",
        });
        return;
      }

      if (
        !Object.values(TypeDemande).includes(
          typeDemande as TypeDemande
        )
      ) {
        res.status(400).json({
          error: "Type de demande invalide",
          typesAutorises: Object.values(TypeDemande),
        });
        return;
      }

      const sujetNettoye = sujet.trim();
      const messageNettoye = message.trim();

      if (
        sujetNettoye.length > 200 ||
        messageNettoye.length > 10000
      ) {
        res.status(400).json({
          error: "Sujet ou message trop long",
        });
        return;
      }

      /**
       * Transaction :
       * le ticket et sa notification sont créés
       * ensemble, ou aucune des deux opérations
       * n'est validée.
       */
      const ticket = await prisma.$transaction(
        async (tx) => {
          const createdTicket =
            await tx.supportTicket.create({
              data: {
                userId,
                typeDemande: typeDemande as TypeDemande,
                sujet: sujetNettoye,
                message: messageNettoye,
                statut: SupportStatus.OUVERT,
              },
              include: {
                user: {
                  select: {
                    nom: true,
                    prenom: true,
                    email: true,
                    telephone: true,
                  },
                },
              },
            });

          await tx.notification.create({
            data: {
              userId,
              titre: "Ticket de support créé",
              message:
                `Votre ticket #${createdTicket.id.substring(
                  0,
                  8
                )} a été créé : ${sujetNettoye}`,
              type: NotificationType.SUPPORT,
            },
          });

          return createdTicket;
        }
      );

      res.status(201).json({
        success: true,
        message: "Ticket créé avec succès",
        ticket,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Création du ticket"
      );
    }
  }

  /**
   * GET /api/support/tickets
   * Obtenir les tickets de l'utilisateur connecté.
   */
  async getMyTickets(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      const tickets =
        await prisma.supportTicket.findMany({
          where: {
            userId,
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      res.status(200).json({
        success: true,
        tickets,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Récupération des tickets"
      );
    }
  }

  /**
   * GET /api/support/tickets/:id
   * Obtenir le détail d'un ticket appartenant
   * à l'utilisateur connecté.
   */
  async getTicketById(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: "Identifiant du ticket requis",
        });
        return;
      }

      const ticket =
        await prisma.supportTicket.findFirst({
          where: {
            id,
            userId,
          },
          include: {
            user: {
              select: {
                nom: true,
                prenom: true,
                email: true,
                telephone: true,
              },
            },
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      if (!ticket) {
        res.status(404).json({
          error: "Ticket non trouvé",
        });
        return;
      }

      res.status(200).json({
        success: true,
        ticket,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Détails du ticket"
      );
    }
  }

  /**
   * POST /api/support/tickets/:id/messages
   * Ajouter un message à un ticket.
   */
  async addMessage(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      const { id } = req.params;
      const { message } = req.body ?? {};

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        res.status(400).json({
          error: "Le message est requis",
        });
        return;
      }

      const messageNettoye = message.trim();

      if (messageNettoye.length > 10000) {
        res.status(400).json({
          error: "Le message est trop long",
        });
        return;
      }

      /**
       * Vérifier que le ticket appartient
       * à l'utilisateur.
       */
      const ticket =
        await prisma.supportTicket.findFirst({
          where: {
            id,
            userId,
          },
        });

      if (!ticket) {
        res.status(404).json({
          error: "Ticket non trouvé",
        });
        return;
      }

      if (ticket.statut === SupportStatus.FERME) {
        res.status(409).json({
          error:
            "Impossible d'ajouter un message à un ticket fermé",
        });
        return;
      }

      /**
       * Lire le rôle réel en base pour
       * renseigner senderRole correctement.
       */
      const sender = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          role: true,
          isBlocked: true,
        },
      });

      if (!sender || sender.isBlocked) {
        res.status(403).json({
          error: "Utilisateur non autorisé",
        });
        return;
      }

      /**
       * Vérification conditionnelle du ticket
       * et création du message dans la même
       * transaction.
       */
      const newMessage = await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.supportTicket.updateMany({
              where: {
                id,
                userId,
                statut: {
                  not: SupportStatus.FERME,
                },
              },
              data: {
                updatedAt: new Date(),
              },
            });

          if (updated.count === 0) {
            return null;
          }

          return tx.supportMessage.create({
            data: {
              ticketId: id,
              senderId: userId,
              senderRole: sender.role,
              message: messageNettoye,
            },
          });
        }
      );

      if (!newMessage) {
        res.status(409).json({
          error:
            "Le ticket n'est plus disponible pour les réponses",
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: newMessage,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Ajout d'un message"
      );
    }
  }

  /**
   * PATCH /api/support/tickets/:id/close
   * Fermer un ticket appartenant à l'utilisateur.
   */
  async closeTicket(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      const { id } = req.params;

      /**
       * La condition userId protège la mise
       * à jour contre les accès non autorisés.
       */
      const result =
        await prisma.supportTicket.updateMany({
          where: {
            id,
            userId,
          },
          data: {
            statut: SupportStatus.FERME,
          },
        });

      if (result.count === 0) {
        res.status(404).json({
          error: "Ticket non trouvé",
        });
        return;
      }

      const updatedTicket =
        await prisma.supportTicket.findFirst({
          where: {
            id,
            userId,
          },
        });

      res.status(200).json({
        success: true,
        message: "Ticket fermé avec succès",
        ticket: updatedTicket,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Fermeture du ticket"
      );
    }
  }

  /**
   * GET /api/support/tickets/all
   * Obtenir tous les tickets.
   * Réservé aux administrateurs MESSAY.
   */
  async getAllTickets(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          error: "Authentification requise",
        });
        return;
      }

      /**
       * Vérifier le rôle et le statut réel
       * de l'utilisateur dans PostgreSQL.
       */
      const admin = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          role: true,
          isBlocked: true,
        },
      });

      if (
        !admin ||
        admin.isBlocked ||
        admin.role !== UserRole.ADMIN
      ) {
        res.status(403).json({
          error: "Accès réservé aux administrateurs",
        });
        return;
      }

      const tickets =
        await prisma.supportTicket.findMany({
          include: {
            user: {
              select: {
                nom: true,
                prenom: true,
                email: true,
                telephone: true,
              },
            },
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      res.status(200).json({
        success: true,
        total: tickets.length,
        tickets,
      });
    } catch (error: unknown) {
      handleServerError(
        res,
        error,
        "Récupération des tickets administrateur"
      );
    }
  }
}
