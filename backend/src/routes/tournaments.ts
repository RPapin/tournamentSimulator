import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── helpers ──────────────────────────────────────────────────────────────────

function isPowerOfTwo(n: number) {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Circle-method round-robin scheduler. Returns rounds, each round is an array
 *  of [homeIdx, awayIdx] pairs (indices into teamIds). Odd counts get a bye. */
function buildRoundRobinSchedule(teamIds: number[]): Array<Array<[number, number]>> {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(-1); // -1 = bye
  const N = teams.length;
  const half = N / 2;
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const rounds: Array<Array<[number, number]>> = [];

  for (let r = 0; r < N - 1; r++) {
    // Rotate left by r
    const rot = [...rotating.slice(r), ...rotating.slice(0, r)];
    const positions = [fixed, ...rot];
    const roundMatches: Array<[number, number]> = [];
    for (let i = 0; i < half; i++) {
      const home = positions[i];
      const away = positions[N - 1 - i];
      if (home !== -1 && away !== -1) roundMatches.push([home, away]);
    }
    rounds.push(roundMatches);
  }
  return rounds;
}

function calculateStandings(
  teams: { id: number; name: string }[],
  matches: { homeTeamId: number; awayTeamId: number; scoreHome: number | null; scoreAway: number | null; isPlayed: boolean }[]
) {
  const standings = teams.map(t => ({
    teamId: t.id, teamName: t.name,
    points: 0, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }));

  for (const match of matches.filter(m => m.isPlayed)) {
    const home = standings.find(s => s.teamId === match.homeTeamId)!;
    const away = standings.find(s => s.teamId === match.awayTeamId)!;
    const sh = match.scoreHome ?? 0;
    const sa = match.scoreAway ?? 0;
    home.goalsFor += sh; home.goalsAgainst += sa;
    away.goalsFor += sa; away.goalsAgainst += sh;
    home.played++; away.played++;
    if (sh > sa) { home.points += 3; home.won++; away.lost++; }
    else if (sh < sa) { away.points += 3; away.won++; home.lost++; }
    else { home.points += 1; away.points += 1; home.drawn++; away.drawn++; }
    home.goalDiff = home.goalsFor - home.goalsAgainst;
    away.goalDiff = away.goalsFor - away.goalsAgainst;
  }

  return standings.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}

/** For GROUP_KNOCKOUT: determine how many groups and how many advance */
function groupKnockoutConfig(n: number): { numGroups: number; advancePerGroup: number } {
  if (n <= 7) return { numGroups: 2, advancePerGroup: 2 };   // 4 advance → SF+F
  if (n <= 15) return { numGroups: 4, advancePerGroup: 2 };  // 8 advance → QF+SF+F
  return { numGroups: 8, advancePerGroup: 2 };               // 16 advance
}

/** Create next knockout round when all matches in current round are played */
async function advanceKnockoutRound(tournamentId: number, completedRound: number) {
  const roundMatches = await prisma.match.findMany({
    where: { tournamentId, round: completedRound, phase: 'KNOCKOUT' },
  });
  if (!roundMatches.every(m => m.isPlayed)) return;
  if (roundMatches.length === 1) return; // Final done, nothing to advance

  const winners = roundMatches.map(m =>
    (m.scoreHome ?? 0) > (m.scoreAway ?? 0) ? m.homeTeamId : m.awayTeamId
  );

  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      tournamentId,
      homeTeamId: winners[i],
      awayTeamId: winners[i + 1],
      round: completedRound + 1,
      phase: 'KNOCKOUT',
    });
  }
  await prisma.match.createMany({ data: nextMatches });
}

// ─── routes ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: { teams: { include: { team: true } } },
    });
    res.json(tournaments);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, format } = req.body as { name: string; format?: string };
  const validFormats = ['ROUND_ROBIN', 'ELIMINATION', 'GROUP_KNOCKOUT'];
  const fmt = validFormats.includes(format ?? '') ? (format as any) : 'ROUND_ROBIN';
  try {
    const tournament = await prisma.tournament.create({ data: { name, format: fmt } });
    res.json(tournament);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        teams: { include: { team: { include: { members: { include: { user: true } } } } } },
        matches: { include: { homeTeam: true, awayTeam: true }, orderBy: [{ groupNum: 'asc' }, { round: 'asc' }, { id: 'asc' }] },
        results: { include: { team: true }, orderBy: { rank: 'asc' } },
      },
    });
    if (!tournament) { res.status(404).json({ error: 'Tournoi non trouvé' }); return; }

    const teams = tournament.teams.map(tt => tt.team);

    if (tournament.format === 'ROUND_ROBIN') {
      const standings = calculateStandings(teams, tournament.matches);
      res.json({ ...tournament, standings });
      return;
    }

    if (tournament.format === 'ELIMINATION') {
      res.json({ ...tournament, standings: [] });
      return;
    }

    // GROUP_KNOCKOUT: compute per-group standings
    const { numGroups } = groupKnockoutConfig(teams.length);
    const groupStandings = [];
    for (let g = 0; g < numGroups; g++) {
      const groupTeamIds = new Set(
        tournament.matches.filter(m => m.phase === 'GROUP' && m.groupNum === g)
          .flatMap(m => [m.homeTeamId, m.awayTeamId])
      );
      const groupTeams = teams.filter(t => groupTeamIds.has(t.id));
      const groupMatches = tournament.matches.filter(m => m.phase === 'GROUP' && m.groupNum === g);
      groupStandings.push({
        group: g,
        label: String.fromCharCode(65 + g), // A, B, C...
        standings: calculateStandings(groupTeams, groupMatches),
        matches: groupMatches,
      });
    }

    const knockoutMatches = tournament.matches.filter(m => m.phase === 'KNOCKOUT');
    res.json({ ...tournament, groupStandings, knockoutMatches, standings: [] });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/teams', requireAdmin, async (req, res) => {
  const { teamId } = req.body as { teamId: number };
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: Number(req.params.id) } });
    if (!tournament || tournament.status !== 'CREATION') {
      res.status(400).json({ error: 'Impossible de modifier un tournoi déjà démarré' }); return;
    }
    await prisma.tournamentTeam.create({ data: { tournamentId: Number(req.params.id), teamId } });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Cette équipe est déjà dans le tournoi' });
  }
});

router.delete('/:id/teams/:teamId', requireAdmin, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: Number(req.params.id) } });
    if (!tournament || tournament.status !== 'CREATION') {
      res.status(400).json({ error: 'Impossible de modifier un tournoi déjà démarré' }); return;
    }
    await prisma.tournamentTeam.delete({
      where: { tournamentId_teamId: { tournamentId: Number(req.params.id), teamId: Number(req.params.teamId) } },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Équipe non trouvée dans ce tournoi' });
  }
});

router.post('/:id/start', requireAdmin, async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: true },
    });
    if (!tournament || tournament.status !== 'CREATION') {
      res.status(400).json({ error: 'Le tournoi ne peut pas être démarré dans son état actuel' }); return;
    }

    const teams = tournament.teams;
    const n = teams.length;
    const format = tournament.format;

    // ── ROUND_ROBIN ──────────────────────────────────────────────────────────
    if (format === 'ROUND_ROBIN') {
      if (n < 2) { res.status(400).json({ error: 'Minimum 2 équipes requises' }); return; }
      const teamIds = teams.map(t => t.teamId);
      const rounds = buildRoundRobinSchedule(teamIds);
      const matchData = rounds.flatMap((round, rIdx) =>
        round.map(([homeTeamId, awayTeamId]) => ({ tournamentId, homeTeamId, awayTeamId, round: rIdx + 1 }))
      );
      await prisma.$transaction([
        prisma.match.createMany({ data: matchData }),
        prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'ONGOING' } }),
      ]);
    }

    // ── ELIMINATION ──────────────────────────────────────────────────────────
    else if (format === 'ELIMINATION') {
      if (!isPowerOfTwo(n)) {
        res.status(400).json({ error: `L'élimination directe requiert un nombre d'équipes en puissance de 2 (2, 4, 8, 16…). Vous avez ${n} équipes.` }); return;
      }
      const matchData = [];
      for (let i = 0; i < n; i += 2) {
        matchData.push({ tournamentId, homeTeamId: teams[i].teamId, awayTeamId: teams[i + 1].teamId, round: 1, phase: 'KNOCKOUT' });
      }
      await prisma.$transaction([
        prisma.match.createMany({ data: matchData }),
        prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'ONGOING' } }),
      ]);
    }

    // ── GROUP_KNOCKOUT ───────────────────────────────────────────────────────
    else if (format === 'GROUP_KNOCKOUT') {
      if (n < 4) { res.status(400).json({ error: 'Minimum 4 équipes requises pour le format poules + élimination' }); return; }
      const { numGroups } = groupKnockoutConfig(n);
      const teamIds = teams.map(t => t.teamId);
      // Distribute teams evenly across groups
      const groups: number[][] = Array.from({ length: numGroups }, () => []);
      teamIds.forEach((id, i) => groups[i % numGroups].push(id));

      const matchData: { tournamentId: number; homeTeamId: number; awayTeamId: number; round: number; phase: string; groupNum: number }[] = [];
      for (let g = 0; g < numGroups; g++) {
        const grp = groups[g];
        const rounds = buildRoundRobinSchedule(grp);
        rounds.forEach((round, rIdx) => {
          round.forEach(([homeTeamId, awayTeamId]) => {
            matchData.push({ tournamentId, homeTeamId, awayTeamId, round: rIdx + 1, phase: 'GROUP', groupNum: g });
          });
        });
      }

      await prisma.$transaction([
        prisma.match.createMany({ data: matchData }),
        prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'ONGOING' } }),
      ]);
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/** Start knockout phase for GROUP_KNOCKOUT after all group matches are played */
router.post('/:id/advance-knockout', requireAdmin, async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: true, matches: true },
    });
    if (!tournament || tournament.status !== 'ONGOING' || tournament.format !== 'GROUP_KNOCKOUT') {
      res.status(400).json({ error: 'Action impossible dans cet état' }); return;
    }

    const groupMatches = tournament.matches.filter(m => m.phase === 'GROUP');
    if (groupMatches.some(m => !m.isPlayed)) {
      res.status(400).json({ error: 'Tous les matchs de poules doivent être joués avant de passer aux phases finales' }); return;
    }
    if (tournament.matches.some(m => m.phase === 'KNOCKOUT')) {
      res.status(400).json({ error: 'La phase finale a déjà été générée' }); return;
    }

    const n = tournament.teams.length;
    const teams = tournament.teams.map(tt => tt.teamId);
    const { numGroups, advancePerGroup } = groupKnockoutConfig(n);

    // Compute group standings and pick top advancePerGroup from each group
    const advancing: number[] = [];
    for (let g = 0; g < numGroups; g++) {
      const groupTeamIds = new Set(
        groupMatches.filter(m => m.groupNum === g).flatMap(m => [m.homeTeamId, m.awayTeamId])
      );
      const groupTeamObjs = teams
        .filter(id => groupTeamIds.has(id))
        .map(id => ({ id, name: '' }));
      const standings = calculateStandings(groupTeamObjs, groupMatches.filter(m => m.groupNum === g));
      standings.slice(0, advancePerGroup).forEach(s => advancing.push(s.teamId));
    }

    // Build knockout bracket (round 1 of knockout)
    const matchData = [];
    for (let i = 0; i < advancing.length; i += 2) {
      // Cross-bracket: group A winner vs group B runner-up, etc.
      matchData.push({ tournamentId, homeTeamId: advancing[i], awayTeamId: advancing[i + 1], round: 1, phase: 'KNOCKOUT' });
    }
    await prisma.match.createMany({ data: matchData });

    res.json({ success: true, advancingTeams: advancing.length });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/finalize', requireAdmin, async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { include: { team: true } }, matches: true },
    });
    if (!tournament || tournament.status !== 'ONGOING') {
      res.status(400).json({ error: 'Le tournoi ne peut pas être finalisé dans son état actuel' }); return;
    }

    const unplayed = tournament.matches.filter(m => !m.isPlayed);
    if (unplayed.length > 0) {
      res.status(400).json({ error: `${unplayed.length} match(s) sans score` }); return;
    }

    const teams = tournament.teams.map(tt => tt.team);
    let results: { tournamentId: number; teamId: number; rank: number; points: number; goalsFor: number; goalsAgainst: number }[] = [];

    if (tournament.format === 'ROUND_ROBIN') {
      const standings = calculateStandings(teams, tournament.matches);
      results = standings.map((s, i) => ({
        tournamentId, teamId: s.teamId, rank: i + 1,
        points: s.points, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
      }));
    } else {
      // ELIMINATION and GROUP_KNOCKOUT: rank by bracket progression
      const knockoutMatches = tournament.matches.filter(m => m.phase === 'KNOCKOUT');
      if (knockoutMatches.length === 0) {
        res.status(400).json({ error: 'La phase finale n\'a pas encore été jouée' }); return;
      }

      const maxRound = Math.max(...knockoutMatches.map(m => m.round ?? 0));
      const byRound: Map<number, typeof knockoutMatches> = new Map();
      knockoutMatches.forEach(m => {
        const r = m.round ?? 0;
        if (!byRound.has(r)) byRound.set(r, []);
        byRound.get(r)!.push(m);
      });

      let rank = 1;
      // Walk rounds from final back to first
      for (let r = maxRound; r >= 1; r--) {
        const roundMs = byRound.get(r) ?? [];
        if (r === maxRound) {
          // Final: winner = 1st, loser = 2nd
          const final = roundMs[0];
          const winnerId = (final.scoreHome ?? 0) > (final.scoreAway ?? 0) ? final.homeTeamId : final.awayTeamId;
          const loserId = winnerId === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
          const goalsStats = (teamId: number) => {
            const asHome = knockoutMatches.filter(m => m.homeTeamId === teamId);
            const asAway = knockoutMatches.filter(m => m.awayTeamId === teamId);
            const gf = asHome.reduce((s, m) => s + (m.scoreHome ?? 0), 0) + asAway.reduce((s, m) => s + (m.scoreAway ?? 0), 0);
            const ga = asHome.reduce((s, m) => s + (m.scoreAway ?? 0), 0) + asAway.reduce((s, m) => s + (m.scoreHome ?? 0), 0);
            return { gf, ga };
          };
          const w = goalsStats(winnerId); const l = goalsStats(loserId);
          results.push({ tournamentId, teamId: winnerId, rank: 1, points: 0, goalsFor: w.gf, goalsAgainst: w.ga });
          results.push({ tournamentId, teamId: loserId, rank: 2, points: 0, goalsFor: l.gf, goalsAgainst: l.ga });
          rank = 3;
        } else {
          // Previous rounds: collect losers (already eliminated at this stage)
          const losers = roundMs.map(m =>
            (m.scoreHome ?? 0) > (m.scoreAway ?? 0) ? m.awayTeamId : m.homeTeamId
          );
          const goalsStats = (teamId: number) => {
            const asHome = knockoutMatches.filter(m => m.homeTeamId === teamId);
            const asAway = knockoutMatches.filter(m => m.awayTeamId === teamId);
            const gf = asHome.reduce((s, m) => s + (m.scoreHome ?? 0), 0) + asAway.reduce((s, m) => s + (m.scoreAway ?? 0), 0);
            const ga = asHome.reduce((s, m) => s + (m.scoreAway ?? 0), 0) + asAway.reduce((s, m) => s + (m.scoreHome ?? 0), 0);
            return { gf, ga };
          };
          losers.forEach(teamId => {
            const { gf, ga } = goalsStats(teamId);
            results.push({ tournamentId, teamId, rank, points: 0, goalsFor: gf, goalsAgainst: ga });
          });
          rank += losers.length;
        }
      }

      // Teams that only played group stage (GROUP_KNOCKOUT) — not in knockout
      if (tournament.format === 'GROUP_KNOCKOUT') {
        const knockoutTeamIds = new Set(results.map(r => r.teamId));
        const groupOnlyTeams = teams.filter(t => !knockoutTeamIds.has(t.id));
        // Rank them after knockout finishers using group standings
        const groupMatches = tournament.matches.filter(m => m.phase === 'GROUP');
        const gs = calculateStandings(groupOnlyTeams, groupMatches);
        gs.forEach(s => {
          results.push({ tournamentId, teamId: s.teamId, rank, points: s.points, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst });
          rank++;
        });
      }
    }

    await prisma.$transaction([
      prisma.tournamentResult.createMany({ data: results }),
      prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'FINISHED' } }),
    ]);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
