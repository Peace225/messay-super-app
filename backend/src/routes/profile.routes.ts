
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

import {
  CourseStatus,
  TicketStatus,
  TypeDemande,
  SupportStatus,
} from "@prisma/client";

import prisma from "../config/database";
import { authenticate } from "../middleware/auth";

const router = Router();

const BUCKET = "messay-avatars";

// ============================================================
// SUPABASE STORAGE - SERVEUR UNIQUEMENT
// ============================================================

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Configuration Supabase Storage manquante"
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================================
// VALIDATION DES IMAGES
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      callback(
        new Error("Format image non autorisé")
      );
      return;
    }

    callback(null, true);
  },
});

function receivePhoto(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single("photo")(req, res, (error: unknown) => {
    if (error) {
      res.status(
        error instanceof multer.MulterError &&
          error.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400
      ).json({
        error: "Image invalide ou trop volumineuse",
      });
      return;
    }

    next();
  });
}

// Évite de supprimer un fichier qui n'appartient
// pas à cet utilisateur ou à notre bucket.
function previousAvatarPath(
  photo: string | null,
  userId: string,
  supabaseUrl: string
): string | null {
  if (!photo) return null;

  try {
    const url = new URL(photo);

    if (
      url.origin !== new URL(supabaseUrl).origin
    ) {
      return null;
    }

    const prefix =
      `/storage/v1/object/public/${BUCKET}/`;

    if (!url.pathname.startsWith(prefix)) {
      return null;
    }

    const path = decodeURIComponent(
      url.pathname.slice(prefix.length)
    );

    return path.startsWith(`users/${userId}/`)
      ? path
      : null;
  } catch {
    return null;
  }
}

// ============================================================
// POST /api/users/me/photo
// ============================================================

router.post(
  "/photo",
  authenticate,
  receivePhoto,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        error: "Authentification requise",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: "Aucune photo reçue",
      });
      return;
    }

    let newPath: string | null = null;

    try {
      const existingUser =
        await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            photo: true,
            isBlocked: true,
          },
        });

      if (!existingUser || existingUser.isBlocked) {
        res.status(403).json({
          error: "Compte non autorisé",
        });
        return;
      }

      // Décode réellement l'image, indépendamment
      // du type MIME annoncé par le téléphone.
      //
      // Supprime les métadonnées non nécessaires,
      // corrige l'orientation et redimensionne.

      let imageBuffer: Buffer;

      try {
        imageBuffer = await sharp(
          req.file.buffer,
          {
            limitInputPixels: 24_000_000,
            failOn: "error",
          }
        )
          .rotate()
          .resize(512, 512, {
            fit: "cover",
            position: "centre",
          })
          .jpeg({
            quality: 82,
            mozjpeg: true,
          })
          .toBuffer();
      } catch {
        res.status(400).json({
          error: "Fichier image invalide",
        });
        return;
      }

      const storage = getStorageClient();
      const projectUrl = process.env.SUPABASE_URL!;

      newPath = `users/${userId}/${randomUUID()}.jpg`;

      const { error: uploadError } =
        await storage.storage
          .from(BUCKET)
          .upload(newPath, imageBuffer, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        console.error(
          "[PROFILE] Storage upload:",
          uploadError
        );

        res.status(502).json({
          error:
            "Impossible d'enregistrer la photo",
        });
        return;
      }

      const { data: publicData } =
        storage.storage
          .from(BUCKET)
          .getPublicUrl(newPath);

      // Sauvegarde permanente de l'URL
      // dans la table Prisma User.

      let updatedUser;

      try {
        updatedUser = await prisma.user.update({
          where: {
            id: userId,
            isBlocked: false,
          },
          data: {
            photo: publicData.publicUrl,
          },
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            role: true,
            photo: true,
            isVerified: true,
          },
        });
      } catch (databaseError) {
        // Nettoyage si l'upload a fonctionné
        // mais que PostgreSQL refuse la mise à jour.
        await storage.storage
          .from(BUCKET)
          .remove([newPath])
          .catch(() => undefined);

        throw databaseError;
      }

      // Suppression de l'ancienne image,
      // après mise à jour réussie de l'utilisateur.

      const oldPath = previousAvatarPath(
        existingUser.photo,
        userId,
        projectUrl
      );

      if (oldPath && oldPath !== newPath) {
        const { error: cleanupError } =
          await storage.storage
            .from(BUCKET)
            .remove([oldPath]);

        if (cleanupError) {
          console.warn(
            "[PROFILE] Ancienne photo non supprimée"
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Photo enregistrée avec succès",
        photo: updatedUser.photo,
        user: updatedUser,
      });
    } catch (error) {
      console.error("[PROFILE] Photo:", error);

      res.status(500).json({
        error:
          "Erreur interne lors de l'enregistrement",
      });
    }
  }
);

// ============================================================
// POST /api/users/me/deletion-request
//
// Demande vérifiée de suppression.
// Ne détruit pas immédiatement les données.
// ============================================================

router.post(
  "/deletion-request",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;
    const password = req.body?.password;

    if (!userId) {
      res.status(401).json({
        error: "Authentification requise",
      });
      return;
    }

    if (
      typeof password !== "string" ||
      !password
    ) {
      res.status(400).json({
        error:
          "Votre mot de passe est nécessaire",
      });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          password: true,
          isBlocked: true,
        },
      });

      if (!user || user.isBlocked) {
        res.status(403).json({
          error: "Compte non autorisé",
        });
        return;
      }

      // Cette comparaison suppose que les mots
      // de passe MESSAY sont hachés avec bcrypt.
      // Utiliser le même vérificateur que le
      // service de connexion existant.

      const validPassword = await compare(
        password,
        user.password
      );

      if (!validPassword) {
        res.status(403).json({
          error: "Mot de passe incorrect",
        });
        return;
      }

      // Ne pas désactiver immédiatement un compte
      // ayant des trajets ou billets actifs.

      const activeCourses =
        await prisma.course.count({
          where: {
            userId,
            statut: {
              in: [
                CourseStatus.EN_ATTENTE,
                CourseStatus.ACCEPTEE,
                CourseStatus.EN_COURS,
              ],
            },
          },
        });

      const activeDriverCourses =
        await prisma.course.count({
          where: {
            conducteur: {
              is: { userId },
            },
            statut: {
              in: [
                CourseStatus.ACCEPTEE,
                CourseStatus.EN_COURS,
              ],
            },
          },
        });

      const futureTickets =
        await prisma.ticket.count({
          where: {
            userId,
            dateDepart: {
              gte: new Date(),
            },
            statut: {
              in: [
                TicketStatus.RESERVE,
                TicketStatus.PAYE,
              ],
            },
          },
        });

      if (
        activeCourses > 0 ||
        activeDriverCourses > 0 ||
        futureTickets > 0
      ) {
        res.status(409).json({
          error:
            "Vous avez encore des courses ou des billets actifs. Contactez le support pour traiter votre demande.",
        });
        return;
      }

      // Enregistrer la demande dans le système
      // de support existant et désactiver le compte.
      //
      // Pas de modification du schema.prisma.

      const deletionRequest =
        await prisma.$transaction(async (tx) => {
          const updated = await tx.user.updateMany({
            where: {
              id: userId,
              isBlocked: false,
            },
            data: {
              isBlocked: true,
              refreshToken: null,
              deviceToken: null,
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              "Demande déjà traitée"
            );
          }

          return tx.supportTicket.create({
            data: {
              userId,
              typeDemande: TypeDemande.TECHNIQUE,
              sujet: "Suppression du compte MESSAY",
              message:
                "Demande de suppression confirmée par authentification. Compte désactivé. Vérifier les obligations de conservation avant l'effacement définitif.",
              statut: SupportStatus.OUVERT,
            },
          });
        });

      res.status(202).json({
        success: true,
        message:
          "Votre demande de suppression a été enregistrée. Votre compte est désactivé. Les données seront traitées selon la procédure de suppression.",
        reference: deletionRequest.id,
      });
    } catch (error) {
      console.error(
        "[PROFILE] Suppression:",
        error
      );

      res.status(500).json({
        error:
          "Impossible d'enregistrer la demande de suppression",
      });
    }
  }
);

export default router;
