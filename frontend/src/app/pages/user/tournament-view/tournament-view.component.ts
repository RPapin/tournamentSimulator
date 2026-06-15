import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { TournamentService } from '../../../services/tournament.service';
import { AuthService } from '../../../services/auth.service';
import { Tournament } from '../../../models/user.model';

@Component({
  selector: 'app-tournament-view',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './tournament-view.component.html',
  styleUrl: './tournament-view.component.css',
})
export class TournamentViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tournamentService = inject(TournamentService);
  private auth = inject(AuthService);

  tournament = signal<Tournament | null>(null);
  loading = signal(true);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.tournamentService.getById(id).subscribe({
      next: t => { this.tournament.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Returns member names for a given team ID as a tooltip string */
  teamMembersStr(teamId: number): string {
    const tt = this.tournament()?.teams?.find(t => t.team.id === teamId);
    const names = tt?.team.members?.map(m => m.user.name) ?? [];
    return names.length > 0 ? names.join(' · ') : 'Aucun membre';
  }

  /** Returns true if the current user belongs to this team */
  isMyTeam(teamId: number): boolean {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return false;
    const tt = this.tournament()?.teams?.find(t => t.team.id === teamId);
    return tt?.team.members?.some(m => m.user.id === userId) ?? false;
  }

  badgeClass(status: string) {
    const map: Record<string, string> = {
      CREATION: 'badge-creation', ONGOING: 'badge-ongoing', FINISHED: 'badge-finished',
    };
    return map[status] ?? '';
  }

  statusLabel(status: string) {
    const map: Record<string, string> = {
      CREATION: 'En création', ONGOING: 'En cours', FINISHED: 'Terminé',
    };
    return map[status] ?? status;
  }
}
