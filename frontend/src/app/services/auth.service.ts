import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();

  constructor() {
    const stored = localStorage.getItem('auth_user');
    if (stored) this._user.set(JSON.parse(stored));
  }

  loginUser(name: string) {
    return this.http
      .post<{ token: string; user: AuthUser }>(`${environment.apiUrl}/auth/login`, { name })
      .pipe(tap(res => this.setSession(res.token, res.user)));
  }

  loginAdmin(password: string) {
    return this.http
      .post<{ token: string; user: AuthUser }>(`${environment.apiUrl}/auth/admin`, { password })
      .pipe(tap(res => this.setSession(res.token, res.user)));
  }

  private setSession(token: string, user: AuthUser) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    this._user.set(user);
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  get token() {
    return localStorage.getItem('auth_token');
  }

  isAdmin() {
    return this._user()?.role === 'ADMIN';
  }

  isAuthenticated() {
    return this._user() !== null;
  }

  getCurrentUserId() {
    return this._user()?.id;
  }
}
