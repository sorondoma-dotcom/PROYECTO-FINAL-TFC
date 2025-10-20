import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DatosService } from '../datos.service';
import { PdfViewerDialogComponent } from '../pdf-viewer-dialog/pdf-viewer-dialog.component';

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
    this.loading = true;
    this.error = '';

    this.datos.getCompeticionDetalle(this.competicionId).subscribe({
      next: (data: any) => {
        this.detalles = data;
        this.loading = false;
        console.log('Detalles cargados:', data);
      },
      error: (err) => {
        this.error = 'Error al cargar los detalles de la competición';
        this.loading = false;
        console.error(err);
      }
    });
  }

  volver(): void {
    this.router.navigate(['/']);
  }

  verPDF(urlPdf: string, tipo: string, titulo: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.dialog.open(PdfViewerDialogComponent, {
      width: '95%',
      maxWidth: '1400px',
      height: '90vh',
      data: { url: urlPdf, tipo, titulo }
    });
  }

  // Método para obtener los campos del evento como array
  obtenerCampos(evento: any): Array<{key: string, value: any}> {
    return Object.keys(evento).map(key => ({
      key: key,
      value: evento[key]
    }));
  }

  // Método para formatear los labels de los campos
  formatearLabel(key: string): string {
    // Eliminar 'campo_' y capitalizar
    const label = key.replace('campo_', 'Campo ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
