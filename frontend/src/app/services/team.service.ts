import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Team } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getAll() {
    return this.http.get<Team[]>(`${this.api}/teams`);
  }

  create(name: string) {
    return this.http.post<Team>(`${this.api}/teams`, { name });
  }

  delete(id: number) {
    return this.http.delete<{ success: boolean }>(`${this.api}/teams/${id}`);
  }

  addMember(teamId: number, userId: number) {
    return this.http.post<{ success: boolean }>(`${this.api}/teams/${teamId}/members`, { userId });
  }

  removeMember(teamId: number, userId: number) {
    return this.http.delete<{ success: boolean }>(`${this.api}/teams/${teamId}/members/${userId}`);
  }
}
