import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Nettoyer la base de données
  await prisma.notification.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.commandeBTP.deleteMany();
  await prisma.camion.deleteMany();
  await prisma.chauffeur.deleteMany();
  await prisma.billetEvent.deleteMany();
  await prisma.event.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.course.deleteMany();
  await prisma.conducteur.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tarifCourse.deleteMany();
  await prisma.configuration.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Créer utilisateurs
  const user1 = await prisma.user.create({
    data: {
      nom: 'Kouassi',
      prenom: 'Jean',
      email: 'jean.kouassi@example.com',
      telephone: '+2250701234567',
      password: hashedPassword,
      role: 'USER',
      isVerified: true,
      moyenPaiement: 'ORANGE_MONEY',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      nom: 'Diallo',
      prenom: 'Fatou',
      email: 'fatou.diallo@example.com',
      telephone: '+2250702345678',
      password: hashedPassword,
      role: 'USER',
      isVerified: true,
      moyenPaiement: 'MTN_MOMO',
    },
  });

  const conducteurUser = await prisma.user.create({
    data: {
      nom: 'Traoré',
      prenom: 'Moussa',
      email: 'moussa.traore@example.com',
      telephone: '+2250703456789',
      password: hashedPassword,
      role: 'CONDUCTEUR',
      isVerified: true,
    },
  });

  const chauffeurUser = await prisma.user.create({
    data: {
      nom: 'Koné',
      prenom: 'Ibrahim',
      email: 'ibrahim.kone@example.com',
      telephone: '+2250704567890',
      password: hashedPassword,
      role: 'CHAUFFEUR',
      isVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      nom: 'Admin',
      prenom: 'MESSAY',
      email: 'admin@messay.com',
      telephone: '+2250700000000',
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  console.log('✅ Utilisateurs créés');

  // Créer conducteurs
  const conducteur1 = await prisma.conducteur.create({
    data: {
      userId: conducteurUser.id,
      permis: 'PERMIS_A',
      numeroPermis: 'CI-A-123456',
      vehiculeType: 'TRICYCLE',
      immatriculation: 'AB-1234-CI',
      statut: 'DISPONIBLE',
      positionLatitude: 5.3599517,
      positionLongitude: -4.0082563,
      note: 4.8,
      nombreCourses: 150,
      isVerified: true,
    },
  });

  console.log('✅ Conducteurs créés');

  // Créer chauffeurs
  const chauffeur1 = await prisma.chauffeur.create({
    data: {
      userId: chauffeurUser.id,
      permis: 'PERMIS_C',
      numeroPermis: 'CI-C-789012',
      experience: 8,
      notation: 4.7,
      nombreLivraisons: 200,
      statut: 'DISPONIBLE',
      positionLatitude: 5.3599517,
      positionLongitude: -4.0082563,
      isVerified: true,
    },
  });

  console.log('✅ Chauffeurs créés');

  // Créer camions
  const camion1 = await prisma.camion.create({
    data: {
      type: 'BENNE',
      capacite: 10,
      immatriculation: 'CD-5678-CI',
      marque: 'Mercedes',
      modele: 'Actros',
      annee: 2020,
      statut: 'DISPONIBLE',
    },
  });

  await prisma.camion.create({
    data: {
      type: 'CITERNE',
      capacite: 15,
      immatriculation: 'EF-9012-CI',
      marque: 'Volvo',
      modele: 'FH16',
      annee: 2021,
      statut: 'DISPONIBLE',
    },
  });

  console.log('✅ Camions créés');

  // Créer événements
  await prisma.event.create({
    data: {
      titre: 'Concert Zouglou Night',
      description: 'Grande soirée zouglou avec les meilleurs artistes ivoiriens',
      categorie: 'CONCERT',
      date: new Date('2026-03-15T20:00:00'),
      heureDebut: '20:00',
      lieu: 'Palais de la Culture',
      adresse: 'Plateau, Abidjan',
      latitude: 5.3247,
      longitude: -4.0127,
      prix: 5000,
      placesDisponibles: 450,
      placesTotal: 500,
      organisateur: 'MESSAY Events',
      isActif: true,
    },
  });

  await prisma.event.create({
    data: {
      titre: 'Match ASEC vs Africa Sports',
      description: 'Derby abidjanais au stade Félix Houphouët-Boigny',
      categorie: 'SPORT',
      date: new Date('2026-03-20T16:00:00'),
      heureDebut: '16:00',
      lieu: 'Stade FHB',
      adresse: 'Plateau, Abidjan',
      latitude: 5.3364,
      longitude: -4.0267,
      prix: 2000,
      placesDisponibles: 8000,
      placesTotal: 10000,
      organisateur: 'FIF',
      isActif: true,
    },
  });

  console.log('✅ Événements créés');

  // Créer courses
  const course1 = await prisma.course.create({
    data: {
      userId: user1.id,
      conducteurId: conducteur1.id,
      departLatitude: 5.3599517,
      departLongitude: -4.0082563,
      departAdresse: 'Cocody, Angré',
      destinationLatitude: 5.3247,
      destinationLongitude: -4.0127,
      destinationAdresse: 'Plateau, Centre-ville',
      distance: 8.5,
      dureeEstimee: 25,
      prix: 2200,
      statut: 'TERMINEE',
      noteConducteur: 5,
      commentaire: 'Excellent service, conducteur très professionnel',
      heureDebut: new Date('2026-02-20T08:30:00'),
      heureFin: new Date('2026-02-20T08:55:00'),
    },
  });

  console.log('✅ Courses créées');

  // Créer tickets transport
  await prisma.ticket.create({
    data: {
      userId: user2.id,
      compagnie: 'UTBS',
      depart: 'Abidjan',
      destination: 'Yamoussoukro',
      dateDepart: new Date('2026-03-01T07:00:00'),
      heureDepart: '07:00',
      siege: 'A12',
      prix: 5000,
      qrCode: 'UTBS-ABJ-YAM-20260301-A12',
      statut: 'PAYE',
    },
  });

  console.log('✅ Tickets transport créés');

  // Créer commandes BTP
  await prisma.commandeBTP.create({
    data: {
      userId: user1.id,
      typeMateriau: 'SABLE',
      quantite: 5,
      unite: 'TONNE',
      typeCamion: 'BENNE',
      adresseLivraison: 'Cocody, Riviera Golf',
      latitudeLivraison: 5.3700,
      longitudeLivraison: -3.9800,
      dateLivraison: new Date('2026-02-25T10:00:00'),
      heurePreferee: '10:00',
      prix: 75000,
      statut: 'CONFIRMEE',
      chauffeurId: chauffeur1.id,
      camionId: camion1.id,
    },
  });

  console.log('✅ Commandes BTP créées');

  // Créer paiements
  await prisma.paiement.create({
    data: {
      userId: user1.id,
      montant: 2200,
      moyen: 'ORANGE_MONEY',
      typeTransaction: 'COURSE',
      referenceId: course1.id,
      statut: 'REUSSI',
      transactionId: 'OM-' + Date.now(),
    },
  });

  console.log('✅ Paiements créés');

  // Créer tarifs
  await prisma.tarifCourse.create({
    data: {
      prixBase: 500,
      prixParKm: 200,
      prixParMinute: 50,
      fraisService: 0.15,
      isActif: true,
    },
  });

  console.log('✅ Tarifs créés');

  // Créer configurations
  await prisma.configuration.createMany({
    data: [
      { cle: 'RAYON_RECHERCHE_CONDUCTEUR', valeur: '5', description: 'Rayon de recherche en km' },
      { cle: 'TEMPS_ATTENTE_MAX', valeur: '300', description: 'Temps d\'attente max en secondes' },
      { cle: 'COMMISSION_PLATEFORME', valeur: '0.15', description: 'Commission 15%' },
    ],
  });

  console.log('✅ Configurations créées');
  console.log('🎉 Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
