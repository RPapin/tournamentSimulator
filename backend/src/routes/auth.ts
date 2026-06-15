import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const router = Router();

router.get('/users-list', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  const { name } = req.body as { name: string };
  try {
    const user = await prisma.user.findUnique({ where: { name } });
    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/admin', (req, res) => {
  const { password } = req.body as { password: string };
  if (password !== 'coinche69') {
    res.status(401).json({ error: 'Mot de passe incorrect' });
    return;
  }
  const token = jwt.sign({ role: 'ADMIN', name: 'Administrateur' }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
  res.json({ token, user: { role: 'ADMIN', name: 'Administrateur' } });
});

export default router;
