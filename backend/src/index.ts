import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import tournamentRoutes from './routes/tournaments';
import matchRoutes from './routes/matches';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

async function bootstrap() {
  // Set UTF-8 as the database client encoding, then force a reconnect so all pool
  // connections use UTF-8 instead of the Windows default (WIN1252).
  const dbName = (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? 'tournament_db';
  try {
    await prisma.$executeRawUnsafe(`ALTER DATABASE "${dbName}" SET client_encoding = 'UTF8'`);
    await prisma.$disconnect();
    console.log('UTF-8 client encoding applied — pool reconnecting');
  } catch {
    console.warn('Could not set client_encoding (non-fatal)');
  }

  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT ?? 3000;
    app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
  }
}

bootstrap();

export default app;
