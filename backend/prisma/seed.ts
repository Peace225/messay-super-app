import { PrismaClient, TricycleStatus, CompagnieTransport, TicketStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  // Suppression avec try-catch pour éviter les erreurs
  const tables = [
    'supportMessage', 'supportTicket', 'notification',
    'ticket', 'billetEvent', 'event',
    'commandeBTP', 'camion', 'paiement', 'course',
    'tricycle', 'conducteur', 'chauffeur', 'user'
  ];

  for (const table of tables) {
    try {
      await (prisma as any)[table].deleteMany();
      console.log(`✓ ${table}`);
    } catch (e) {
      console.log(`- ${table} (n'existe pas)`);
    }
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Admin
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

  // Conducteurs
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
        email: `${c.prenom.toLowerCase()}@messay.com`,
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
            isVerified: true,
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
      }
    });
  }

  // Tickets
  await prisma.ticket.createMany({
    data: [
      {
        compagnie: CompagnieTransport.UTB,
        passagerNom: 'KOUAME Adjoua',
        telephone: '+22507012345',
        depart: 'Abidjan',
        destination: 'Bouaké',
        dateDepart: new Date(),
        heureDepart: '14:30',
        siege: '12A',
        prix: 7500,
        qrCode: 'QR-' + Date.now(),
        statut: TicketStatus.PAYE,
      }
    ]
  });

  console.log('✅ Terminé! Admin: admin@messay.com / password123');
}

main().finally(() => prisma.$disconnect());