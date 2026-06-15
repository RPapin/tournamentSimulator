import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TournamentService } from '../../../services/tournament.service';
import { Tournament, TournamentFormat } from '../../../models/user.model';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.css',
})
export class TournamentsComponent implements OnInit {
  private tournamentService = inject(TournamentService);

  tournaments = signal<Tournament[]>([]);
  loading = signal(true);
  showForm = signal(false);
  newName = '';
  newFormat: TournamentFormat = 'ROUND_ROBIN';

  ngOnInit() { this.load(); }

  load() {
    this.tournamentService.getAll().subscribe({
      next: t => { this.tournaments.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (!this.newName.trim()) return;
    this.tournamentService.create(this.newName.trim(), this.newFormat).subscribe({
      next: () => { this.newName = ''; this.newFormat = 'ROUND_ROBIN'; this.showForm.set(false); this.load(); },
    });
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

  formatLabel(format: string) {
    const map: Record<string, string> = {
      ROUND_ROBIN: 'Round-robin',
      ELIMINATION: 'Élimination directe',
      GROUP_KNOCKOUT: 'Poules + élimination',
    };
    return map[format] ?? format;
  }
}
