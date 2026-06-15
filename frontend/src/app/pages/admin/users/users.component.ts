import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);

  users = signal<User[]>([]);
  loading = signal(true);
  showForm = signal(false);
  formError = signal('');
  editingId = signal<number | null>(null);
  editError = signal('');
  newName = '';
  editName = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.userService.getAll().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (!this.newName.trim()) return;
    this.formError.set('');
    this.userService.create(this.newName.trim()).subscribe({
      next: () => { this.newName = ''; this.showForm.set(false); this.load(); },
      error: () => this.formError.set('Ce nom est déjà utilisé.'),
    });
  }

  startEdit(user: User) {
    this.editingId.set(user.id);
    this.editName = user.name;
    this.editError.set('');
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editName = '';
    this.editError.set('');
  }

  saveEdit(user: User) {
    if (!this.editName.trim() || this.editName.trim() === user.name) {
      this.cancelEdit();
      return;
    }
    this.editError.set('');
    this.userService.rename(user.id, this.editName.trim()).subscribe({
      next: () => { this.cancelEdit(); this.load(); },
      error: () => this.editError.set('Ce nom est déjà utilisé.'),
    });
  }

  teamNames(teams: { team: { name: string } }[]) {
    return teams.map(t => t.team.name).join(', ');
  }

  delete(user: User) {
    if (!confirm(`Supprimer l'utilisateur "${user.name}" ?`)) return;
    this.userService.delete(user.id).subscribe({ next: () => this.load() });
  }
}
