import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Tournament, TournamentFormat } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getAll() {
    return this.http.get<Tournament[]>(`${this.api}/tournaments`);
  }

  getById(id: number) {
    return this.http.get<Tournament>(`${this.api}/tournaments/${id}`);
  }

  create(name: string, format: TournamentFormat) {
    return this.http.post<Tournament>(`${this.api}/tournaments`, { name, format });
  }

  addTeam(tournamentId: number, teamId: number) {
    return this.http.post<{ success: boolean }>(`${this.api}/tournaments/${tournamentId}/teams`, { teamId });
  }

  removeTeam(tournamentId: number, teamId: number) {
    return this.http.delete<{ success: boolean }>(`${this.api}/tournaments/${tournamentId}/teams/${teamId}`);
  }

  start(tournamentId: number) {
    return this.http.post<{ success: boolean }>(`${this.api}/tournaments/${tournamentId}/start`, {});
  }

  advanceKnockout(tournamentId: number) {
    return this.http.post<{ success: boolean; advancingTeams: number }>(`${this.api}/tournaments/${tournamentId}/advance-knockout`, {});
  }

  finalize(tournamentId: number) {
    return this.http.post<{ success: boolean }>(`${this.api}/tournaments/${tournamentId}/finalize`, {});
  }

  setScore(matchId: number, scoreHome: number, scoreAway: number) {
    return this.http.put(`${this.api}/matches/${matchId}/score`, { scoreHome, scoreAway });
  }

  resetScore(matchId: number) {
    return this.http.delete(`${this.api}/matches/${matchId}/score`);
  }
}
