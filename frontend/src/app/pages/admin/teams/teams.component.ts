import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../../services/team.service';
import { UserService } from '../../../services/user.service';
import { Team } from '../../../models/user.model';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.css',
})
export class TeamsComponent implements OnInit {
  private teamService = inject(TeamService);
  private userService = inject(UserService);

  teams = signal<Team[]>([]);
  allUsers = signal<{ id: number; name: string }[]>([]);
  loading = signal(true);
  showForm = signal(false);
  formError = signal('');
  expandedTeam = signal<number | null>(null);
  newName = '';
  selectedUserId: number | '' = '';

  ngOnInit() {
    this.load();
    this.userService.getUsersList().subscribe(u => this.allUsers.set(u));
  }

  load() {
    this.teamService.getAll().subscribe({
      next: t => { this.teams.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleExpand(id: number) {
    this.expandedTeam.set(this.expandedTeam() === id ? null : id);
    this.selectedUserId = '';
  }

  availableUsers(team: Team) {
    const memberIds = new Set((team.members ?? []).map(m => m.user.id));
    return this.allUsers().filter(u => !memberIds.has(u.id));
  }

  createTeam() {
    if (!this.newName.trim()) return;
    this.formError.set('');
    this.teamService.create(this.newName.trim()).subscribe({
      next: () => { this.newName = ''; this.showForm.set(false); this.load(); },
      error: () => this.formError.set('Ce nom est déjà utilisé.'),
    });
  }

  deleteTeam(team: Team) {
    if (!confirm(`Supprimer l'équipe "${team.name}" ?`)) return;
    this.teamService.delete(team.id).subscribe({ next: () => this.load() });
  }

  addMember(team: Team) {
    if (!this.selectedUserId) return;
    this.teamService.addMember(team.id, Number(this.selectedUserId)).subscribe({
      next: () => { this.selectedUserId = ''; this.load(); },
      error: () => alert('Erreur lors de l\'ajout du membre.'),
    });
  }

  removeMember(team: Team, userId: number) {
    this.teamService.removeMember(team.id, userId).subscribe({ next: () => this.load() });
  }
}
