import { Routes } from '@angular/router';
import { CompeticionComponent } from './competicion/competicion.component';
import { RankingNadadoresComponent } from './ranking-nadadores/ranking-nadadores.component';
import { DashBoardComponent } from './dash-board/dash-board.component';
import { ResultadoPruebaComponent } from './resultado-prueba/resultado-prueba.component';
import { AuthComponent } from './auth/auth.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: '', component: DashBoardComponent, canActivate: [authGuard] },
  { path: 'competiciones', component: CompeticionComponent, canActivate: [authGuard] },
  { path: 'nadadores', component: RankingNadadoresComponent, canActivate: [authGuard] },
  { path: 'resultado-prueba', component: ResultadoPruebaComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'auth' },
];
