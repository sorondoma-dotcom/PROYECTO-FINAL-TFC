import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { athleteGuard } from './guards/athlete.guard';

export const routes: Routes = [
  { path: 'auth', loadComponent: () => import('./auth/auth.component').then(m => m.AuthComponent) },
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'verify-email', loadComponent: () => import('./auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
  { path: '', loadComponent: () => import('./dash-board/dash-board.component').then(m => m.DashBoardComponent), canActivate: [authGuard] },
  { path: 'competiciones', loadComponent: () => import('./competicion/competicion.component').then(m => m.CompeticionComponent), canActivate: [authGuard] },
  { path: 'competiciones/:id/detalle', loadComponent: () => import('./competicion/scheduled-competition-detail/scheduled-competition-detail.component').then(m => m.ScheduledCompetitionDetailComponent), canActivate: [authGuard] },
  { path: 'mi-perfil', loadComponent: () => import('./perfil-usuario/perfil-usuario.component').then(m => m.PerfilUsuarioComponent), canActivate: [authGuard] },
  { path: 'mi-perfil/nadador', loadComponent: () => import('./perfil-nadador/perfil-nadador.component').then(m => m.PerfilNadadorComponent), canActivate: [authGuard, athleteGuard] },
  { path: 'nadadores/perfil/:name', loadComponent: () => import('./perfil-nadador/perfil-nadador.component').then(m => m.PerfilNadadorComponent), canActivate: [authGuard] },
  { path: 'nadadores/buscar', loadComponent: () => import('./buscar-atletas/buscar-atletas.component').then(m => m.BuscarAtletasComponent), canActivate: [authGuard] },
  { path: 'nadadores', loadComponent: () => import('./ranking-nadadores/ranking-nadadores.component').then(m => m.RankingNadadoresComponent), canActivate: [authGuard], pathMatch: 'full' },
  { path: 'estadisticas', loadComponent: () => import('./estadisticas/estadisticas.component').then(m => m.EstadisticasComponent), canActivate: [authGuard] },
  { path: 'resultado-prueba', loadComponent: () => import('./resultado-prueba/resultado-prueba.component').then(m => m.ResultadoPruebaComponent), canActivate: [authGuard] },
  { path: 'admin/competiciones', loadComponent: () => import('./admin/admin-competiciones/admin-competiciones.component').then(m => m.AdminCompeticionesComponent), canActivate: [authGuard, AdminGuard] },
  { path: '**', redirectTo: 'auth' },
];
