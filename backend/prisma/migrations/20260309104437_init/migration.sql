-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'CONDUCTEUR', 'CHAUFFEUR', 'ADMIN', 'PARTENAIRE');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('CARTE_BANCAIRE', 'ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'ESPECES');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "CompagnieTransport" AS ENUM ('UTBS', 'BTA', 'RVS');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('RESERVE', 'PAYE', 'UTILISE', 'ANNULE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "EventCategorie" AS ENUM ('CONCERT', 'SPORT', 'THEATRE', 'CONFERENCE', 'FESTIVAL', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeMateriau" AS ENUM ('SABLE', 'GRAVIER', 'CIMENT', 'PIERRE', 'BETON');

-- CreateEnum
CREATE TYPE "TypeCamion" AS ENUM ('BENNE', 'CITERNE', 'PLATEAU', 'MALAXEUR');

-- CreateEnum
CREATE TYPE "CommandeBTPStatus" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'EN_ROUTE', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "PaiementStatus" AS ENUM ('EN_ATTENTE', 'REUSSI', 'ECHOUE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('COURSE', 'TICKET_TRANSPORT', 'BILLET_EVENT', 'COMMANDE_BTP', 'RECHARGE');

-- CreateEnum
CREATE TYPE "TypeDemande" AS ENUM ('QUESTION', 'RECLAMATION', 'OBJET_PERDU', 'LITIGE', 'TECHNIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COURSE', 'TICKET', 'EVENT', 'BTP', 'PAIEMENT', 'SUPPORT', 'SYSTEME');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "photo" TEXT,
    "moyenPaiement" "MoyenPaiement",
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpCode" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conducteur" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permis" TEXT NOT NULL,
    "numeroPermis" TEXT NOT NULL,
    "vehiculeType" TEXT NOT NULL DEFAULT 'TRICYCLE',
    "immatriculation" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "positionLatitude" DOUBLE PRECISION,
    "positionLongitude" DOUBLE PRECISION,
    "note" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "nombreCourses" INTEGER NOT NULL DEFAULT 0,
    "selfieVerification" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conducteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conducteurId" TEXT,
    "departLatitude" DOUBLE PRECISION NOT NULL,
    "departLongitude" DOUBLE PRECISION NOT NULL,
    "departAdresse" TEXT NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "destinationAdresse" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "dureeEstimee" INTEGER NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "statut" "CourseStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "partageTrajet" BOOLEAN NOT NULL DEFAULT false,
    "noteConducteur" DOUBLE PRECISION,
    "commentaire" TEXT,
    "positionLiveLatitude" DOUBLE PRECISION,
    "positionLiveLongitude" DOUBLE PRECISION,
    "heureDebut" TIMESTAMP(3),
    "heureFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compagnie" "CompagnieTransport" NOT NULL,
    "depart" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT NOT NULL,
    "siege" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "qrCode" TEXT NOT NULL,
    "statut" "TicketStatus" NOT NULL DEFAULT 'RESERVE',
    "paiementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" "EventCategorie" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "lieu" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "prix" DOUBLE PRECISION NOT NULL,
    "image" TEXT,
    "placesDisponibles" INTEGER NOT NULL,
    "placesTotal" INTEGER NOT NULL,
    "organisateur" TEXT NOT NULL,
    "isActif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BilletEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prixTotal" DOUBLE PRECISION NOT NULL,
    "qrCode" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'VALIDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BilletEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeBTP" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeMateriau" "TypeMateriau" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'TONNE',
    "typeCamion" "TypeCamion" NOT NULL,
    "adresseLivraison" TEXT NOT NULL,
    "latitudeLivraison" DOUBLE PRECISION NOT NULL,
    "longitudeLivraison" DOUBLE PRECISION NOT NULL,
    "dateLivraison" TIMESTAMP(3) NOT NULL,
    "heurePreferee" TEXT,
    "prix" DOUBLE PRECISION NOT NULL,
    "statut" "CommandeBTPStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "chauffeurId" TEXT,
    "camionId" TEXT,
    "positionLiveLatitude" DOUBLE PRECISION,
    "positionLiveLongitude" DOUBLE PRECISION,
    "etaMinutes" INTEGER,
    "noteChauffeur" DOUBLE PRECISION,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeBTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chauffeur" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permis" TEXT NOT NULL,
    "numeroPermis" TEXT NOT NULL,
    "photo" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "notation" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "nombreLivraisons" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "positionLatitude" DOUBLE PRECISION,
    "positionLongitude" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chauffeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camion" (
    "id" TEXT NOT NULL,
    "type" "TypeCamion" NOT NULL,
    "capacite" DOUBLE PRECISION NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "annee" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "positionLatitude" DOUBLE PRECISION,
    "positionLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "moyen" "MoyenPaiement" NOT NULL,
    "typeTransaction" "TypeTransaction" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "statut" "PaiementStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "transactionId" TEXT,
    "stripePaymentId" TEXT,
    "recu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeDemande" "TypeDemande" NOT NULL,
    "sujet" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" "SupportStatus" NOT NULL DEFAULT 'OUVERT',
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "assigneA" TEXT,
    "reponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifCourse" (
    "id" TEXT NOT NULL,
    "prixBase" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "prixParKm" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "prixParMinute" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "fraisService" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "isActif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telephone_key" ON "User"("telephone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_telephone_idx" ON "User"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Conducteur_userId_key" ON "Conducteur"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conducteur_numeroPermis_key" ON "Conducteur"("numeroPermis");

-- CreateIndex
CREATE UNIQUE INDEX "Conducteur_immatriculation_key" ON "Conducteur"("immatriculation");

-- CreateIndex
CREATE INDEX "Conducteur_statut_idx" ON "Conducteur"("statut");

-- CreateIndex
CREATE INDEX "Conducteur_positionLatitude_positionLongitude_idx" ON "Conducteur"("positionLatitude", "positionLongitude");

-- CreateIndex
CREATE INDEX "Course_userId_idx" ON "Course"("userId");

-- CreateIndex
CREATE INDEX "Course_conducteurId_idx" ON "Course"("conducteurId");

-- CreateIndex
CREATE INDEX "Course_statut_idx" ON "Course"("statut");

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrCode_key" ON "Ticket"("qrCode");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_qrCode_idx" ON "Ticket"("qrCode");

-- CreateIndex
CREATE INDEX "Ticket_dateDepart_idx" ON "Ticket"("dateDepart");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Event_categorie_idx" ON "Event"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "BilletEvent_qrCode_key" ON "BilletEvent"("qrCode");

-- CreateIndex
CREATE INDEX "BilletEvent_userId_idx" ON "BilletEvent"("userId");

-- CreateIndex
CREATE INDEX "BilletEvent_eventId_idx" ON "BilletEvent"("eventId");

-- CreateIndex
CREATE INDEX "BilletEvent_qrCode_idx" ON "BilletEvent"("qrCode");

-- CreateIndex
CREATE INDEX "CommandeBTP_userId_idx" ON "CommandeBTP"("userId");

-- CreateIndex
CREATE INDEX "CommandeBTP_chauffeurId_idx" ON "CommandeBTP"("chauffeurId");

-- CreateIndex
CREATE INDEX "CommandeBTP_statut_idx" ON "CommandeBTP"("statut");

-- CreateIndex
CREATE INDEX "CommandeBTP_dateLivraison_idx" ON "CommandeBTP"("dateLivraison");

-- CreateIndex
CREATE UNIQUE INDEX "Chauffeur_userId_key" ON "Chauffeur"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Chauffeur_numeroPermis_key" ON "Chauffeur"("numeroPermis");

-- CreateIndex
CREATE INDEX "Chauffeur_statut_idx" ON "Chauffeur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_immatriculation_key" ON "Camion"("immatriculation");

-- CreateIndex
CREATE INDEX "Camion_statut_idx" ON "Camion"("statut");

-- CreateIndex
CREATE INDEX "Camion_type_idx" ON "Camion"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_transactionId_key" ON "Paiement"("transactionId");

-- CreateIndex
CREATE INDEX "Paiement_userId_idx" ON "Paiement"("userId");

-- CreateIndex
CREATE INDEX "Paiement_statut_idx" ON "Paiement"("statut");

-- CreateIndex
CREATE INDEX "Paiement_transactionId_idx" ON "Paiement"("transactionId");

-- CreateIndex
CREATE INDEX "Paiement_createdAt_idx" ON "Paiement"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_statut_idx" ON "SupportTicket"("statut");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_cle_key" ON "Configuration"("cle");

-- AddForeignKey
ALTER TABLE "Conducteur" ADD CONSTRAINT "Conducteur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_conducteurId_fkey" FOREIGN KEY ("conducteurId") REFERENCES "Conducteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BilletEvent" ADD CONSTRAINT "BilletEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeBTP" ADD CONSTRAINT "CommandeBTP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeBTP" ADD CONSTRAINT "CommandeBTP_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "Chauffeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeBTP" ADD CONSTRAINT "CommandeBTP_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chauffeur" ADD CONSTRAINT "Chauffeur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
