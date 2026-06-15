import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User, Tournament } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getMe() {
    return this.http.get<{ id: number; name: string; teams: { team: { id: number; name: string; members: { user: { id: number; name: string } }[] } }[] }>(`${this.api}/users/me`);
  }

  getAll() {
    return this.http.get<User[]>(`${this.api}/users`);
  }

  getUsersList() {
    return this.http.get<{ id: number; name: string }[]>(`${this.api}/auth/users-list`);
  }

  create(name: string) {
    return this.http.post<User>(`${this.api}/users`, { name });
  }

  rename(id: number, name: string) {
    return this.http.put<User>(`${this.api}/users/${id}`, { name });
  }

  delete(id: number) {
    return this.http.delete<{ success: boolean }>(`${this.api}/users/${id}`);
  }

  getHistory() {
    return this.http.get<Tournament[]>(`${this.api}/users/me/history`);
  }
}
