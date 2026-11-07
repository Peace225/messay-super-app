
import type { Request, Response } from "express";
import prisma from "../config/database";

const UUID_PATTERN =
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

type ProgrammeRow = {
  destinationId: string;
  horaireId: string;
  heureDepart: string;
};

export async function getProgrammesLignes(
  req: Request,
  res: Response
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  const companyId =
    typeof req.query.companyId === "string"
      ? req.query.companyId.trim()
      : "";

  if (!UUID_PATTERN.test(companyId)) {
    res.status(400).json({
      error: "companyId UUID requis.",
    });
    return;
  }

  try {
    const programmes =
      await prisma.$queryRaw<ProgrammeRow[]>`
        SELECT
          d.id::text AS "destinationId",
          h.id::text AS "horaireId",
          to_char(
            h.heure_depart::time,
            'HH24:MI'
          ) AS "heureDepart"
        FROM public.destinations d
        INNER JOIN public.horaires h
          ON h.destination_id = d.id
        WHERE d.company_id = ${companyId}::uuid
          AND d.publie IS TRUE
        ORDER BY
          d.id,
          h.heure_depart::time
        LIMIT 300
      `;

    res.status(200).json({
      programmes,
      reservationActive: false,
      paiementActif: false,
      message:
        "Horaires publiés à titre informatif. " +
        "Aucun bus ni siège garanti.",
    });
  } catch (error) {
    console.error(
      "[MESSAY/PROGRAMMES/LIGNES]",
      error
    );

    res.status(503).json({
      error:
        "Programmes des lignes indisponibles.",
    });
  }
}
