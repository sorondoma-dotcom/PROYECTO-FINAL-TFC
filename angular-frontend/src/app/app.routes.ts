import { Routes } from '@angular/router';
import { CompeticionComponent } from './competicion/competicion.component';
import { RankingNadadoresComponent } from './ranking-nadadores/ranking-nadadores.component';
import { DashBoardComponent } from './dash-board/dash-board.component';
import { ResultadoPruebaComponent } from './resultado-prueba/resultado-prueba.component';
import { AuthComponent } from './auth/auth.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { VerifyEmailComponent } from './auth/verify-email/verify-email.component';
import { PerfilNadadorComponent } from './perfil-nadador/perfil-nadador.component';
import { EstadisticasComponent } from './estadisticas/estadisticas.component';
import { AdminCompeticionesComponent } from './admin/admin-competiciones/admin-competiciones.component';
import { authGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { athleteGuard } from './guards/athlete.guard';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
   { path: 'verify-email', component: VerifyEmailComponent },
  { path: '', component: DashBoardComponent, canActivate: [authGuard] },
  { path: 'competiciones', component: CompeticionComponent, canActivate: [authGuard] },
  { path: 'mi-perfil', component: PerfilNadadorComponent, canActivate: [authGuard, athleteGuard] },
  { path: 'nadadores/perfil/:name', component: PerfilNadadorComponent, canActivate: [authGuard] },
  { path: 'nadadores', component: RankingNadadoresComponent, canActivate: [authGuard], pathMatch: 'full' },
  { path: 'estadisticas', component: EstadisticasComponent, canActivate: [authGuard] },
  { path: 'resultado-prueba', component: ResultadoPruebaComponent, canActivate: [authGuard] },
  { path: 'admin/competiciones', component: AdminCompeticionesComponent, canActivate: [authGuard, AdminGuard] },
  { path: '**', redirectTo: 'auth' },
];
