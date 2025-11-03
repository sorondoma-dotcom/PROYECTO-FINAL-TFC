import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DatosService } from '../datos.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { TimelineChartComponent } from '../timeline-chart/timeline-chart.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-ranking-nadadores',
  standalone: true,
  templateUrl: './ranking-nadadores.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CountryFlagPipe,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDialogModule,
  ],
  styleUrls: ['./ranking-nadadores.component.scss'],
})
export class RankingNadadoresComponent implements OnInit {
  // filtros
  gender: 'M' | 'F' = 'F';
  distance = '100';
  stroke = 'BACKSTROKE';
  poolConfiguration: 'LCM' | 'SCM' = 'LCM';
  limit = 10;

  // datos
  nadadores: any[] = [];
  loading = false;
  error: string | null = null;
  previousLimit: number = 10;

  // opciones mínimas para selects
  genders = [
    { val: 'F', label: 'Femenino' },
    { val: 'M', label: 'Masculino' },
  ];
  distances = ['50', '100', '200', '400', '800', '1500'];
  strokes = [
    { val: 'BACKSTROKE', label: 'Backstroke' },
    { val: 'BREASTSTROKE', label: 'Breaststroke' },
    { val: 'BUTTERFLY', label: 'Butterfly' },
    { val: 'MEDLEY', label: 'Medley' },
    { val: 'FREESTYLE', label: 'Freestyle' },
    { val: 'FREESTYLE_RELAY', label: 'Freestyle Relay' },
    { val: 'MEDLEY_RELAY', label: 'Medley Relay' },
  ];
  pools = [
    { val: 'LCM', label: '50m (LCM)' },
    { val: 'SCM', label: '25m (SCM)' },
  ];
  selectedTimeline: { name: string; times: any[] } | null = null;

  constructor(private datosService: DatosService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.previousLimit = this.limit;
    this.cargarRankings();
  }
  cargarRankings(clearCache: boolean = false): void {
    if (this.loading) return; // Evita llamadas simultáneas
    this.loading = true;
    this.error = null;
    this.nadadores = [];

    this.datosService
      .getRankings({
        gender: this.gender,
        distance: this.distance,
        stroke: this.stroke,
        poolConfiguration: this.poolConfiguration,
        limit: this.limit,
        clearCache: clearCache,
      })
      .subscribe({
        next: (res) => {
          const datos = res?.rankings ?? res?.data ?? [];
          this.nadadores = datos.slice(0, this.limit);
          this.loading = false;
          this.previousLimit = this.limit;
        },
        error: (err) => {
          this.error = err?.message || 'Error al obtener rankings';
          this.loading = false;
        },
      });
    console.log(this.nadadores);
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const shouldClearCache = this.limit !== this.previousLimit;
    this.cargarRankings(shouldClearCache);
  }

  validarLimite(): void {
    if (this.limit > 200) {
      this.limit = 200; // opcional: puedes forzar que no pase de 200
    }
    // No disparamos búsqueda automática; solo se aplica al pulsar "Buscar"
  }

  verTimeline(nadador: any) {
    const tiempos = this.nadadores.filter((nd) => nd.name === nadador.name);
    // Abrir diálogo con el componente TimelineChartComponent
    this.dialog.open(TimelineChartComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        name: nadador.name,
        times: tiempos,
      },
      // los componentes standalone pueden necesitar que el diálogo los trate como componentes normales
    });
  }

  // Para cerrar el timeline
  cerrarTimeline() {
    this.selectedTimeline = null;
  }
  get filteredStrokes() {
    const dist = Number(this.distance);
    if (dist > 400) {
      return this.strokes.filter((s) => s.val === 'FREESTYLE');
    }
    if (dist === 400) {
      return this.strokes.filter(
        (s) => s.val === 'FREESTYLE' || s.val === 'MEDLEY'
      );
    }
    return this.strokes;
  }
}
