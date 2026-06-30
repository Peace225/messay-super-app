import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// GET /api/finance/stats
export const getStats = async (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [revenuTotal, revenuJour, courses, chauffeurs] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { montant: true },
      where: { type: 'ENTRÉE', statut: 'VALIDÉ' }
    }),
    prisma.transaction.aggregate({
      _sum: { montant: true },
      where: { type: 'ENTRÉE', createdAt: { gte: today } }
    }),
    prisma.course.count({ where: { statut: 'TERMINEE' } }),
    prisma.conducteur.count({ where: { isAvailable: true } })
  ]);

  res.json({
    revenuTotal: revenuTotal._sum.montant || 0,
    revenuJour: revenuJour._sum.montant || 0,
    totalCourses: courses,
    chauffeursActifs: chauffeurs
  });
};

// GET /api/finance/transactions
export const getTransactions = async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    take: parseInt(req.query.limit) || 50,
    orderBy: { createdAt: 'desc' },
    include: { conducteur: { select: { nom: true, prenom: true } } }
  });
  res.json(transactions);
};

// GET /api/finance/export
export const exportFinance = async (req, res) => {
  const data = await prisma.transaction.findMany({
    include: { conducteur: true }
  });
  
  // Génère Excel avec xlsx
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(data.map(t => ({
    ID: t.id,
    Date: t.createdAt,
    Motif: t.motif,
    Montant: t.montant,
    Type: t.type,
    Chauffeur: t.conducteur?.nom
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Finance');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', 'attachment; filename=finance.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
};

// POST /api/finance/reports/generate
export const generateReport = async (req, res) => {
  const stats = await prisma.transaction.aggregate({
    _sum: { montant: true },
    _count: true,
    where: { createdAt: { gte: new Date(Date.now() - 30*24*60*1000) } }
  });

  const report = await prisma.rapport.create({
    data: {
      type: req.body.type,
      titre: `Rapport ${req.body.type} - ${new Date().toLocaleDateString('fr-FR')}`,
      contenu: JSON.stringify(stats),
      generePar: req.user.id
    }
  });

  res.json({ id: report.id, url: `/api/reports/${report.id}/download` });
};