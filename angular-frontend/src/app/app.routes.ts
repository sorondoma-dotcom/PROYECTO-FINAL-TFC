import { Routes } from '@angular/router';
import { CompeticionComponent } from './competicion/competicion.component';
import { CompeticionDetalleComponent } from './competicion-detalle/competicion-detalle.component';
import { RankingNadadoresComponent } from './ranking-nadadores/ranking-nadadores.component';
import path from 'path';
import { DashBoardComponent } from './dash-board/dash-board.component';

export const routes: Routes = [
  { path: '', component: DashBoardComponent },
  { path: 'competiciones', component: CompeticionComponent },
  { path: 'competicion/:id', component: CompeticionDetalleComponent },
  { path: 'nadadores', component: RankingNadadoresComponent },
  { path: '**', redirectTo: '' },
];
