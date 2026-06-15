import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);

async function advanceKnockoutIfComplete(tournamentId: number, round: number) {
  const roundMatches = await prisma.match.findMany({
    where: { tournamentId, round, phase: 'KNOCKOUT' },
  });
  if (!roundMatches.every(m => m.isPlayed)) return;
  if (roundMatches.length === 1) return; // Final done

  const winners = roundMatches.map(m =>
    (m.scoreHome ?? 0) > (m.scoreAway ?? 0) ? m.homeTeamId : m.awayTeamId
  );
  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({ tournamentId, homeTeamId: winners[i], awayTeamId: winners[i + 1], round: round + 1, phase: 'KNOCKOUT' });
  }
  await prisma.match.createMany({ data: nextMatches });
}

router.put('/:id/score', requireAdmin, async (req, res) => {
  const { scoreHome, scoreAway } = req.body as { scoreHome: number; scoreAway: number };

  if (scoreHome < 0 || scoreAway < 0 || !Number.isInteger(scoreHome) || !Number.isInteger(scoreAway)) {
    res.status(400).json({ error: 'Scores invalides' }); return;
  }

  try {
    const match = await prisma.match.findUnique({ where: { id: Number(req.params.id) } });
    if (!match) { res.status(404).json({ error: 'Match non trouvé' }); return; }

    const tournament = await prisma.tournament.findUnique({ where: { id: match.tournamentId } });
    if (!tournament || tournament.status !== 'ONGOING') {
      res.status(400).json({ error: "Le tournoi n'est pas en cours" }); return;
    }

    // Knockout matches cannot end in a draw
    if (match.phase === 'KNOCKOUT' && scoreHome === scoreAway) {
      res.status(400).json({ error: "Les matchs à élimination directe ne peuvent pas se terminer sur un match nul" }); return;
    }

    const updated = await prisma.match.update({
      where: { id: Number(req.params.id) },
      data: { scoreHome, scoreAway, isPlayed: true },
      include: { homeTeam: true, awayTeam: true },
    });

    // Auto-advance bracket for ELIMINATION format
    if (tournament.format === 'ELIMINATION' && match.phase === 'KNOCKOUT' && match.round !== null) {
      await advanceKnockoutIfComplete(match.tournamentId, match.round);
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id/score', requireAdmin, async (req, res) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: Number(req.params.id) } });
    if (!match) { res.status(404).json({ error: 'Match non trouvé' }); return; }

    const tournament = await prisma.tournament.findUnique({ where: { id: match.tournamentId } });
    if (!tournament || tournament.status !== 'ONGOING') {
      res.status(400).json({ error: "Le tournoi n'est pas en cours" }); return;
    }

    // For knockout: can only reset score if no next-round match has been played
    if (match.phase === 'KNOCKOUT' && match.round !== null) {
      const nextRound = match.round + 1;
      const nextRoundPlayed = await prisma.match.findFirst({
        where: { tournamentId: match.tournamentId, round: nextRound, phase: 'KNOCKOUT', isPlayed: true },
      });
      if (nextRoundPlayed) {
        res.status(400).json({ error: 'Impossible de réinitialiser un score quand le tour suivant a déjà été joué' }); return;
      }
      // Delete next-round matches that were auto-generated from this round (if all reset)
      const thisRoundMatches = await prisma.match.findMany({
        where: { tournamentId: match.tournamentId, round: match.round, phase: 'KNOCKOUT' },
      });
      const allUnplayed = thisRoundMatches.filter(m => m.id !== match.id).every(m => !m.isPlayed);
      // Reset this match
      await prisma.match.update({
        where: { id: Number(req.params.id) },
        data: { scoreHome: null, scoreAway: null, isPlayed: false },
      });
      // If all matches in this round were unplayed before this reset (and next round exists), remove next round
      if (allUnplayed) {
        await prisma.match.deleteMany({
          where: { tournamentId: match.tournamentId, round: nextRound, phase: 'KNOCKOUT' },
        });
      }
      res.json({ success: true }); return;
    }

    await prisma.match.update({
      where: { id: Number(req.params.id) },
      data: { scoreHome: null, scoreAway: null, isPlayed: false },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
