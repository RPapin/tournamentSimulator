import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { TournamentService } from '../../../services/tournament.service';
import { TeamService } from '../../../services/team.service';
import { Tournament, Team, Match, GroupStanding } from '../../../models/user.model';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './tournament-detail.component.html',
  styleUrl: './tournament-detail.component.css',
})
export class TournamentDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tournamentService = inject(TournamentService);
  private teamService = inject(TeamService);

  tournament = signal<Tournament | null>(null);
  allTeams = signal<Team[]>([]);
  loading = signal(true);
  error = signal('');
  editingMatch = signal<number | null>(null);
  selectedTeamId: number | '' = '';
  scoreHomeInput = 0;
  scoreAwayInput = 0;
  activeGroup = signal(0);

  get tournamentId() { return Number(this.route.snapshot.paramMap.get('id')); }

  ngOnInit() {
    this.load();
    this.teamService.getAll().subscribe(t => this.allTeams.set(t));
  }

  load() {
    this.tournamentService.getById(this.tournamentId).subscribe({
      next: t => { this.tournament.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  availableTeams() {
    const inTournament = new Set((this.tournament()?.teams ?? []).map(tt => tt.team.id));
    return this.allTeams().filter(t => !inTournament.has(t.id));
  }

  // ── ROUND ROBIN helpers ───────────────────────────────────────────────────

  get rrJournees(): Map<number, Match[]> {
    const map = new Map<number, Match[]>();
    for (const m of this.tournament()?.matches ?? []) {
      if (m.round !== null) {
        if (!map.has(m.round)) map.set(m.round, []);
        map.get(m.round)!.push(m);
      }
    }
    return map;
  }

  get rrRounds(): number[] {
    return [...this.rrJournees.keys()].sort((a, b) => a - b);
  }

  unplayedCount() { return (this.tournament()?.matches ?? []).filter(m => !m.isPlayed).length; }

  // ── ELIMINATION helpers ───────────────────────────────────────────────────

  get knockoutRounds(): number[] {
    const matches = this.tournament()?.matches ?? [];
    const ks = matches.filter(m => m.phase === 'KNOCKOUT');
    const rounds = [...new Set(ks.map(m => m.round!))].sort((a, b) => a - b);
    return rounds;
  }

  knockoutMatchesForRound(round: number): Match[] {
    return (this.tournament()?.matches ?? []).filter(m => m.phase === 'KNOCKOUT' && m.round === round);
  }

  roundLabel(round: number): string {
    const maxRound = Math.max(...this.knockoutRounds);
    const diff = maxRound - round;
    if (diff === 0) return 'Finale';
    if (diff === 1) return 'Demi-finale';
    if (diff === 2) return 'Quart de finale';
    if (diff === 3) return 'Huitième de finale';
    return `Tour ${round}`;
  }

  get allKnockoutPlayed(): boolean {
    const matches = (this.tournament()?.knockoutMatches ?? this.tournament()?.matches?.filter(m => m.phase === 'KNOCKOUT')) ?? [];
    return matches.length > 0 && matches.every(m => m.isPlayed);
  }

  // ── GROUP_KNOCKOUT helpers ────────────────────────────────────────────────

  get groupStandings(): GroupStanding[] { return this.tournament()?.groupStandings ?? []; }

  get knockoutMatchesList(): Match[] {
    return this.tournament()?.knockoutMatches ?? [];
  }

  get allGroupMatchesPlayed(): boolean {
    const t = this.tournament();
    if (!t) return false;
    const groupMatches = (t.matches ?? []).filter(m => m.phase === 'GROUP');
    return groupMatches.length > 0 && groupMatches.every(m => m.isPlayed);
  }

  get knockoutStarted(): boolean {
    return (this.tournament()?.knockoutMatches ?? []).length > 0;
  }

  get gkKnockoutRounds(): number[] {
    const km = this.knockoutMatchesList;
    return [...new Set(km.map(m => m.round!))].sort((a, b) => a - b);
  }

  gkKnockoutForRound(round: number): Match[] {
    return this.knockoutMatchesList.filter(m => m.round === round);
  }

  gkRoundLabel(round: number): string {
    const maxRound = this.gkKnockoutRounds.length > 0 ? Math.max(...this.gkKnockoutRounds) : round;
    const diff = maxRound - round;
    if (diff === 0) return 'Finale';
    if (diff === 1) return 'Demi-finale';
    if (diff === 2) return 'Quart de finale';
    return `Tour ${round}`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  addTeam() {
    if (!this.selectedTeamId) return;
    this.tournamentService.addTeam(this.tournamentId, Number(this.selectedTeamId)).subscribe({
      next: () => { this.selectedTeamId = ''; this.load(); },
      error: (e) => this.error.set(e.error?.error ?? 'Erreur'),
    });
  }

  removeTeam(teamId: number) {
    this.tournamentService.removeTeam(this.tournamentId, teamId).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.error?.error ?? 'Erreur'),
    });
  }

  startTournament() {
    if (!confirm('Démarrer le tournoi ? Le calendrier des matchs sera généré.')) return;
    this.error.set('');
    this.tournamentService.start(this.tournamentId).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.error?.error ?? 'Erreur au démarrage'),
    });
  }

  advanceToKnockout() {
    if (!confirm('Générer la phase finale avec les équipes qualifiées ?')) return;
    this.error.set('');
    this.tournamentService.advanceKnockout(this.tournamentId).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.error?.error ?? 'Erreur'),
    });
  }

  finalizeTournament() {
    if (!confirm('Finaliser le tournoi ? Les résultats seront enregistrés définitivement.')) return;
    this.error.set('');
    this.tournamentService.finalize(this.tournamentId).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.error?.error ?? 'Erreur à la finalisation'),
    });
  }

  startEdit(match: Match) {
    this.editingMatch.set(match.id);
    this.scoreHomeInput = match.scoreHome ?? 0;
    this.scoreAwayInput = match.scoreAway ?? 0;
  }

  saveScore(match: Match) {
    if (this.scoreHomeInput < 0 || this.scoreAwayInput < 0) return;
    this.tournamentService.setScore(match.id, this.scoreHomeInput, this.scoreAwayInput).subscribe({
      next: () => { this.editingMatch.set(null); this.load(); },
      error: (e) => this.error.set(e.error?.error ?? 'Erreur lors de la sauvegarde'),
    });
  }

  resetScore(matchId: number) {
    this.tournamentService.resetScore(matchId).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.error?.error ?? 'Erreur'),
    });
  }

  // ── Tooltip helpers ───────────────────────────────────────────────────────

  teamMembersStr(teamId: number): string {
    const tt = this.tournament()?.teams?.find(t => t.team.id === teamId);
    const names = tt?.team.members?.map(m => m.user.name) ?? [];
    return names.length > 0 ? names.join(' · ') : 'Aucun membre';
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  formatLabel(format: string) {
    const map: Record<string, string> = {
      ROUND_ROBIN: 'Round-robin',
      ELIMINATION: 'Élimination directe',
      GROUP_KNOCKOUT: 'Poules + élimination',
    };
    return map[format] ?? format;
  }

  badgeClass(status: string) {
    const map: Record<string, string> = { CREATION: 'badge-creation', ONGOING: 'badge-ongoing', FINISHED: 'badge-finished' };
    return map[status] ?? '';
  }

  statusLabel(status: string) {
    const map: Record<string, string> = { CREATION: 'En création', ONGOING: 'En cours', FINISHED: 'Terminé' };
    return map[status] ?? status;
  }

  canFinalize(): boolean {
    const t = this.tournament();
    if (!t) return false;
    if (t.format === 'GROUP_KNOCKOUT' && !this.knockoutStarted) return false;
    return this.unplayedCount() === 0;
  }

  get startDisabled(): boolean {
    const t = this.tournament();
    if (!t) return true;
    const n = t.teams?.length ?? 0;
    if (t.format === 'ELIMINATION') {
      // must be power of 2
      return n < 2 || (n & (n - 1)) !== 0;
    }
    if (t.format === 'GROUP_KNOCKOUT') return n < 4;
    return n < 2;
  }

  get startHint(): string {
    const t = this.tournament();
    if (!t) return '';
    const n = t.teams?.length ?? 0;
    if (t.format === 'ELIMINATION' && n >= 2 && (n & (n - 1)) !== 0) {
      const next = Math.pow(2, Math.ceil(Math.log2(n)));
      return `L'élimination directe requiert une puissance de 2 (prochaine : ${next} équipes)`;
    }
    if (t.format === 'GROUP_KNOCKOUT' && n < 4) return 'Minimum 4 équipes requises';
    if (n < 2) return 'Minimum 2 équipes requises';
    return '';
  }
}
