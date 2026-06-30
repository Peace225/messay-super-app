-- DropIndex
DROP INDEX "BilletEvent_qrCode_idx";

-- DropIndex
DROP INDEX "Camion_statut_idx";

-- DropIndex
DROP INDEX "Camion_type_idx";

-- DropIndex
DROP INDEX "CommandeBTP_dateLivraison_idx";

-- DropIndex
DROP INDEX "Course_createdAt_idx";

-- DropIndex
DROP INDEX "Event_categorie_idx";

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_isRead_idx";

-- DropIndex
DROP INDEX "Paiement_createdAt_idx";

-- DropIndex
DROP INDEX "Paiement_transactionId_idx";

-- DropIndex
DROP INDEX "SupportMessage_ticketId_idx";

-- DropIndex
DROP INDEX "Ticket_dateDepart_idx";

-- AlterTable
ALTER TABLE "Camion" ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Chauffeur" ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CommandeBTP" ADD COLUMN     "dateAssignation" TIMESTAMP(3),
ADD COLUMN     "priorite" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Conducteur" ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceToken" TEXT;

-- CreateIndex
CREATE INDEX "Chauffeur_disponible_idx" ON "Chauffeur"("disponible");

-- CreateIndex
CREATE INDEX "CommandeBTP_priorite_idx" ON "CommandeBTP"("priorite");

-- CreateIndex
CREATE INDEX "Conducteur_disponible_idx" ON "Conducteur"("disponible");
