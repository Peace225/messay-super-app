-- MESSAY PRO : liaison des billets aux departs programmes
-- Migration additive : conserve les anciens billets

ALTER TABLE "public"."Ticket"
  ADD COLUMN "affectationId" UUID,
  ADD COLUMN "siegeNumero" INTEGER;

-- Index de recherche sans contrainte d'unicite
CREATE INDEX "Ticket_affectationId_siegeNumero_idx"
  ON "public"."Ticket"("affectationId", "siegeNumero");
