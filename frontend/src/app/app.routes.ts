import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'tournaments', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/users/users.component').then(m => m.UsersComponent),
      },
      {
        path: 'teams',
        loadComponent: () => import('./pages/admin/teams/teams.component').then(m => m.TeamsComponent),
      },
      {
        path: 'tournaments',
        loadComponent: () => import('./pages/admin/tournaments/tournaments.component').then(m => m.TournamentsComponent),
      },
      {
        path: 'tournaments/:id',
        loadComponent: () => import('./pages/admin/tournament-detail/tournament-detail.component').then(m => m.TournamentDetailComponent),
      },
    ],
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/user/history/history.component').then(m => m.HistoryComponent),
  },
  {
    path: 'tournament/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/user/tournament-view/tournament-view.component').then(m => m.TournamentViewComponent),
  },
  { path: '**', redirectTo: '/login' },
];
