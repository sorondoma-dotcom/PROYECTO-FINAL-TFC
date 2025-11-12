import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DatosService } from '../datos.service';


@Component({
  selector: 'app-competicion-detalle',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  templateUrl: './competicion-detalle.component.html',
  styleUrls: ['./competicion-detalle.component.scss']
})
export class CompeticionDetalleComponent implements OnInit {
  competicionId: string = '';
  detalles: any = null;
  loading: boolean = true;
  error: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private datos: DatosService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.competicionId = params['id'];
      this.cargarDetalles();
    });
  }

  cargarDetalles(): void {
    this.loading = false;
    this.error = 'El detalle de la competicion esta temporalmente deshabilitado.';
    this.detalles = null;
  }

  volver(): void {
    this.router.navigate(['/']);
  }


  // Metodo para obtener los campos del evento como array
  obtenerCampos(evento: any): Array<{key: string, value: any}> {
    return Object.keys(evento).map(key => ({
      key: key,
      value: evento[key]
    }));
  }

  // Metodo para formatear los labels de los campos
  formatearLabel(key: string): string {
    // Eliminar 'campo_' y capitalizar
    const label = key.replace('campo_', 'Campo ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
