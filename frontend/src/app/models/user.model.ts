export interface User {
  id: number;
  name: string;
  role: 'ADMIN' | 'USER';
  teams?: { team: Team }[];
}

export interface Team {
  id: number;
  name: string;
  members?: { user: User }[];
}

export type TournamentStatus = 'CREATION' | 'ONGOING' | 'FINISHED';
export type TournamentFormat = 'ROUND_ROBIN' | 'ELIMINATION' | 'GROUP_KNOCKOUT';

export interface Tournament {
  id: number;
  name: string;
  status: TournamentStatus;
  format: TournamentFormat;
  createdAt: string;
  teams?: { team: Team }[];
  matches?: Match[];
  results?: TournamentResult[];
  standings?: Standing[];
  // GROUP_KNOCKOUT
  groupStandings?: GroupStanding[];
  knockoutMatches?: Match[];
}

export interface Match {
  id: number;
  tournamentId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: Team;
  awayTeam: Team;
  scoreHome: number | null;
  scoreAway: number | null;
  isPlayed: boolean;
  round: number | null;
  phase: 'GROUP' | 'KNOCKOUT' | null;
  groupNum: number | null;
}

export interface TournamentResult {
  id: number;
  tournamentId: number;
  teamId: number;
  team: Team;
  rank: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface Standing {
  teamId: number;
  teamName: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export interface GroupStanding {
  group: number;
  label: string;
  standings: Standing[];
  matches: Match[];
}

export interface AuthUser {
  id?: number;
  name: string;
  role: 'ADMIN' | 'USER';
}
