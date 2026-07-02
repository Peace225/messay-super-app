import { PrismaClient, TricycleStatus, CompagnieTransport, TicketStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MESSAY...');

  // Suppression dans le bon ordre (enfants → parents)
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.billetEvent.deleteMany();
  await prisma.event.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.course.deleteMany();
  await prisma.commandeBTP.deleteMany();
  await prisma.tricycle.deleteMany();
  await prisma.conducteur.deleteMany();
  await prisma.chauffeur.deleteMany();
  await prisma.camion.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Admin
  await prisma.user.create({
    data: {
      nom: 'Admin',
      prenom: 'MESSAY',
      email: 'admin@messay.com',
      telephone: '+2250700000000',
      password: hashedPassword,
      role: UserRole.ADMIN,
      isVerified: true,
    },
  });

  // 2. Users normaux
  await prisma.user.createMany({
    data: [
      {
        nom: 'KOUAME',
        prenom: 'Kevin',
        email: 'kevin@test.com',
        telephone: '+22507111111',
        password: hashedPassword,
        role: UserRole.USER,
        isVerified: true,
      },
      {
        nom: 'DIABATE',
        prenom: 'Aminata',
        email: 'aminata@test.com',
        telephone: '+22507222222',
        password: hashedPassword,
        role: UserRole.USER,
        isVerified: true,
      },
    ],
  });

  // 3. Conducteurs + Tricycles
  const conducteurs = [
    { nom: 'KONE', prenom: 'Moussa', tel: '+22507011111', permis: 'PERM001', immat: '4521-AB', lat: 5.345, lng: -4.024 },
    { nom: 'YAO', prenom: 'Jean', tel: '+22507022222', permis: 'PERM002', immat: '8854-EF', lat: 5.336, lng: -4.012 },
    { nom: 'TRAORE', prenom: 'Ibrahim', tel: '+22507033333', permis: 'PERM003', immat: '1247-GH', lat: 5.352, lng: -4.031 },
  ];

  for (const c of conducteurs) {
    const user = await prisma.user.create({
      data: {
        nom: c.nom,
        prenom: c.prenom,
        email: `${c.prenom.toLowerCase()}.${c.nom.toLowerCase()}@messay.com`,
        telephone: c.tel,
        password: hashedPassword,
        role: UserRole.CONDUCTEUR,
        isVerified: true,
        conducteurProfile: {
          create: {
            permis: 'B',
            numeroPermis: c.permis,
            immatriculation: c.immat,
            positionLatitude: c.lat,
            positionLongitude: c.lng,
            disponible: true,
            isVerified: true,
            note: 4.8,
          }
        }
      },
      include: { conducteurProfile: true }
    });

    await prisma.tricycle.create({
      data: {
        immatriculation: c.immat,
        conducteurId: user.conducteurProfile!.id,
        modele: 'TVS King',
        batterie: 80 + Math.floor(Math.random() * 20),
        latitude: c.lat,
        longitude: c.lng,
        status: TricycleStatus.DISPONIBLE,
        coursesAujourdhui: Math.floor(Math.random() * 10),
        distanceParcourue: Math.random() * 50,
      }
    });
  }

  // 4. Events
  await prisma.event.createMany({
    data: [
      {
        titre: 'Concert Dadju Abidjan',
        description: 'Le roi de l\'afro love à Abidjan',
        categorie: 'CONCERT',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        heureDebut: '20:00',
        lieu: 'Palais de la Culture',
        adresse: 'Treichville, Abidjan',
        prix: 15000,
        placesDisponibles: 500,
        placesTotal: 500,
        organisateur: 'MESSAY Events',
        image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
      },
      {
        titre: 'ASEC vs Africa Sports',
        description: 'Classico ivoirien',
        categorie: 'SPORT',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        heureDebut: '16:00',
        lieu: 'Stade Félix Houphouët-Boigny',
        adresse: 'Plateau, Abidjan',
        prix: 5000,
        placesDisponibles: 1000,
        placesTotal: 1000,
        organisateur: 'FIF',
      },
    ],
  });

  // 5. Tickets transport
  await prisma.ticket.createMany({
    data: [
      {
        compagnie: CompagnieTransport.UTB,
        passagerNom: 'KOUAME',
        passagerPrenom: 'Adjoua',
        telephone: '+22507012345',
        depart: 'Abidjan',
        destination: 'Bouaké',
        gareDepart: 'Gare UTB Adjamé',
        dateDepart: new Date(Date.now() + 24 * 60 * 60 * 1000),
        heureDepart: '14:30',
        numeroBus: 'UTB-452',
        siege: '12A',
        prix: 7500,
        qrCode: 'QR-UTB-' + Date.now(),
        statut: TicketStatus.PAYE,
        canalVente: 'APP',
      },
      {
        compagnie: CompagnieTransport.AVS,
        passagerNom: 'TRAORE',
        passagerPrenom: 'Fatim',
        telephone: '+22507067890',
        depart: 'Abidjan',
        destination: 'Yamoussoukro',
        dateDepart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        heureDepart: '08:00',
        siege: '5B',
        prix: 5500,
        qrCode: 'QR-AVS-' + (Date.now() + 1),
        statut: TicketStatus.PAYE,
      },
    ]
  });

  console.log('✅ Seed terminé !');
  console.log('👤 Admin: admin@messay.com / password123');
  console.log('🚗 3 conducteurs créés');
  console.log('🎫 2 tickets + 2 events');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });