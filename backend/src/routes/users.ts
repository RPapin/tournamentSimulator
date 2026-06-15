import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { name: 'asc' },
      include: {
        teams: { include: { team: true } },
      },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body as { name: string };
  try {
    const user = await prisma.user.create({ data: { name, role: 'USER' } });
    res.json(user);
  } catch {
    res.status(400).json({ error: 'Ce nom est déjà utilisé' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Le nom ne peut pas être vide' });
    return;
  }
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { name: name.trim() },
    });
    res.json(user);
  } catch {
    res.status(400).json({ error: 'Ce nom est déjà utilisé' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
});

router.get('/me', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  if (!userId) { res.status(403).json({ error: 'Non disponible pour l\'administrateur' }); return; }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { teams: { include: { team: { include: { members: { include: { user: true } } } } } } },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me/history', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  if (!userId) {
    res.status(403).json({ error: 'Non disponible pour l\'administrateur' });
    return;
  }
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        teams: {
          some: {
            team: {
              members: { some: { userId } },
            },
          },
        },
      },
      include: {
        results: { include: { team: true }, orderBy: { rank: 'asc' } },
        teams: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tournaments);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
