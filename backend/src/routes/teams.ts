import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: {
        members: { include: { user: true } },
      },
    });
    res.json(teams);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body as { name: string };
  try {
    const team = await prisma.team.create({ data: { name } });
    res.json(team);
  } catch {
    res.status(400).json({ error: 'Ce nom est déjà utilisé' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.team.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Équipe non trouvée' });
  }
});

router.post('/:id/members', requireAdmin, async (req, res) => {
  const { userId } = req.body as { userId: number };
  try {
    await prisma.userTeam.create({
      data: { teamId: Number(req.params.id), userId },
    });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Cet utilisateur est déjà dans l\'équipe' });
  }
});

router.delete('/:id/members/:userId', requireAdmin, async (req, res) => {
  try {
    await prisma.userTeam.delete({
      where: {
        userId_teamId: {
          userId: Number(req.params.userId),
          teamId: Number(req.params.id),
        },
      },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Membre non trouvé' });
  }
});

export default router;
