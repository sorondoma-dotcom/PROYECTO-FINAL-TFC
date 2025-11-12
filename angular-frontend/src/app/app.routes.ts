import { Routes } from '@angular/router';
import { CompeticionComponent } from './competicion/competicion.component';
import { RankingNadadoresComponent } from './ranking-nadadores/ranking-nadadores.component';
import path from 'path';
import { DashBoardComponent } from './dash-board/dash-board.component';
import { ResultadoPruebaComponent } from './resultado-prueba/resultado-prueba.component';

export const routes: Routes = [
  { path: '', component: DashBoardComponent },
  { path: 'competiciones', component: CompeticionComponent },
  { path: 'nadadores', component: RankingNadadoresComponent },
  { path: 'resultado-prueba', component: ResultadoPruebaComponent },
  { path: '**', redirectTo: '' },
];
