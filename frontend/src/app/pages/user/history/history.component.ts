import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { UserService } from '../../../services/user.service';
import { TournamentService } from '../../../services/tournament.service';
import { AuthService } from '../../../services/auth.service';
import { Tournament } from '../../../models/user.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent implements OnInit {
  private userService = inject(UserService);
  private tournamentService = inject(TournamentService);
  auth = inject(AuthService);

  myTournaments = signal<Tournament[]>([]);
  allTournaments = signal<Tournament[]>([]);
  myTeams = signal<{ id: number; name: string; members: { user: { id: number; name: string } }[] }[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.userService.getHistory().subscribe({
      next: t => { this.myTournaments.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.tournamentService.getAll().subscribe({
      next: t => this.allTournaments.set(t),
    });
    if (!this.auth.isAdmin()) {
      this.userService.getMe().subscribe({
        next: me => this.myTeams.set(me?.teams?.map(tt => tt.team) ?? []),
        error: () => {},
      });
    }
  }

  badgeClass(status: string) {
    const map: Record<string, string> = {
      CREATION: 'badge-creation', ONGOING: 'badge-ongoing', FINISHED: 'badge-finished',
    };
    return map[status] ?? '';
  }

  memberNames(members: { user: { name: string } }[]): string {
    return members.map(m => m.user.name).join(' · ');
  }

  statusLabel(status: string) {
    const map: Record<string, string> = {
      CREATION: 'En création', ONGOING: 'En cours', FINISHED: 'Terminé',
    };
    return map[status] ?? status;
  }
}
