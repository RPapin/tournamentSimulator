import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  mode = signal<'user' | 'admin'>('user');
  users = signal<{ id: number; name: string }[]>([]);
  loading = signal(true);
  submitting = signal(false);
  error = signal('');

  selectedUser = '';
  adminPassword = '';

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.redirect();
      return;
    }
    this.userService.getUsersList().subscribe({
      next: list => { this.users.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  login() {
    this.error.set('');
    this.submitting.set(true);

    if (this.mode() === 'user') {
      if (!this.selectedUser) {
        this.error.set('Veuillez sélectionner un utilisateur.');
        this.submitting.set(false);
        return;
      }
      this.auth.loginUser(this.selectedUser).subscribe({
        next: () => { this.submitting.set(false); this.redirect(); },
        error: () => { this.error.set('Utilisateur introuvable.'); this.submitting.set(false); },
      });
    } else {
      if (!this.adminPassword) {
        this.error.set('Veuillez entrer le mot de passe.');
        this.submitting.set(false);
        return;
      }
      this.auth.loginAdmin(this.adminPassword).subscribe({
        next: () => { this.submitting.set(false); this.redirect(); },
        error: () => { this.error.set('Mot de passe incorrect.'); this.submitting.set(false); },
      });
    }
  }

  private redirect() {
    this.router.navigate(this.auth.isAdmin() ? ['/admin/tournaments'] : ['/history']);
  }
}
