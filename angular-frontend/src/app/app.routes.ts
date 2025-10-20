import { Routes } from '@angular/router';
import { TableComponent } from './table/table.component';
import { CompeticionDetalleComponent } from './competicion-detalle/competicion-detalle.component';

export const routes: Routes = [
  { path: '', component: TableComponent },
  { path: 'competicion/:id', component: CompeticionDetalleComponent },
  { path: '**', redirectTo: '' }
];
