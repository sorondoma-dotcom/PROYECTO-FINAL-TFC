import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { DatosService } from '../datos.service';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { CityNamePipe } from '../pipes/city-name.pipe';
import { CountryCodePipe } from '../pipes/country-code.pipe';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface DashboardStats {
  totalCompeticiones: number;
  competicionesLive: number;
  competiciones25m: number;
  competiciones50m: number;
  competicionesConResultados: number;
}

interface RankingEntry {
  overallRank?: string;
  country?: string;
  name?: string;
}

interface TopEvent {
  key: string;
  title: string;
  gender: 'M' | 'F';
  distance: string;
  stroke: string; // FREESTYLE, BACKSTROKE, etc.
  poolConfiguration: 'LCM' | 'SCM';
  top: RankingEntry[];
}

@Component({
  selector: 'app-dash-board',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    RouterLink,
    CountryFlagPipe,
    CityNamePipe,
    CountryCodePipe
  ],
  templateUrl: './dash-board.component.html',
  styleUrl: './dash-board.component.scss'
})
export class DashBoardComponent implements OnInit {
  loading = true;
  stats: DashboardStats = {
    totalCompeticiones: 0,
    competicionesLive: 0,
    competiciones25m: 0,
    competiciones50m: 0,
    competicionesConResultados: 0
  };
  competiciones: any[] = [];
  competicionesDestacadas: any[] = [];
  eventosTop: TopEvent[] = [];
  errorRankings: string | null = null;

  constructor(private datosService: DatosService) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.datosService.getDatosApi().subscribe({
      next: (data: any) => {
        this.competiciones = data.competiciones || [];
        this.calcularEstadisticas();
        this.seleccionarDestacadas();
        this.cargarRankingsDestacados();
      },
      error: (error) => {
        console.error('Error al cargar datos:', error);
        this.loading = false;
      }
    });
  }

  calcularEstadisticas(): void {
    this.stats.totalCompeticiones = this.competiciones.length;
    this.stats.competicionesLive = this.competiciones.filter(c => this.isLive(c.date)).length;
    this.stats.competiciones25m = this.competiciones.filter(c => c.course === '25m').length;
    this.stats.competiciones50m = this.competiciones.filter(c => c.course === '50m').length;
    this.stats.competicionesConResultados = this.competiciones.filter(c => c.hasResults).length;
  }

  seleccionarDestacadas(): void {
    // Seleccionar competiciones en vivo y las que tienen resultados
    this.competicionesDestacadas = this.competiciones
      .filter(c => this.isLive(c.date) || c.hasResults)
      .slice(0, 6);
  }

  isLive(dateStr: string): boolean {
    if (!dateStr) return false;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = dateStr.split(' ');
    if (parts.length !== 3) return false;

    const [day, mon, year] = parts;
    const monthIndex = months.indexOf(mon);
    if (monthIndex === -1) return false;

    const compDate = new Date(Number(year), monthIndex, Number(day));
    const today = new Date();

    return compDate.getDate() === today.getDate() &&
           compDate.getMonth() === today.getMonth() &&
           compDate.getFullYear() === today.getFullYear();
  }

  getCourseIcon(course: string): string {
    return course === '25m' ? 'straighten' : 'waves';
  }

  private cargarRankingsDestacados(): void {
    const eventos: Omit<TopEvent, 'top'>[] = [
      { key: 'F_100_BACK', title: '100 espalda (F)', gender: 'F', distance: '100', stroke: 'BACKSTROKE', poolConfiguration: 'LCM' },
      { key: 'M_100_BACK', title: '100 espalda (M)', gender: 'M', distance: '100', stroke: 'BACKSTROKE', poolConfiguration: 'LCM' },
      { key: 'F_100_FREE', title: '100 libre (F)', gender: 'F', distance: '100', stroke: 'FREESTYLE', poolConfiguration: 'LCM' },
      { key: 'M_100_FREE', title: '100 libre (M)', gender: 'M', distance: '100', stroke: 'FREESTYLE', poolConfiguration: 'LCM' },
      { key: 'F_200_FREE', title: '200 libre (F)', gender: 'F', distance: '200', stroke: 'FREESTYLE', poolConfiguration: 'LCM' },
      { key: 'M_200_FREE', title: '200 libre (M)', gender: 'M', distance: '200', stroke: 'FREESTYLE', poolConfiguration: 'LCM' },
    ];

    const requests = eventos.map(e =>
      this.datosService.getRankings({
        gender: e.gender,
        distance: e.distance,
        stroke: e.stroke,
        poolConfiguration: e.poolConfiguration,
        limit: 10,
      }).pipe(
        map((arr: any) => ({
          ...e,
          top: this.mapearRespuestaRankings(arr),
          error: false
        })),
        catchError((err) => {
          console.error(`Error cargando ranking para ${e.title}:`, err);
          // Retornar un evento vacío en caso de error para que no rompa forkJoin
          return of({
            ...e,
            top: [],
            error: true,
            errorMessage: err?.error?.mensaje || err?.message || 'Error al cargar datos'
          });
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        // Filtrar solo los eventos que tienen datos (no errores o con datos)
        this.eventosTop = res.filter((ev: any) => !ev.error && ev.top.length > 0) as TopEvent[];
        // Si todos fallaron, mostrar mensaje
        const errores = res.filter((ev: any) => ev.error);
        if (errores.length > 0 && this.eventosTop.length === 0) {
          this.errorRankings = 'No se pudieron cargar los rankings. Por favor, intenta más tarde.';
        } else if (errores.length > 0) {
          this.errorRankings = `Algunos rankings no se pudieron cargar (${errores.length} de ${res.length})`;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error crítico cargando rankings:', err);
        this.errorRankings = 'Error al cargar los rankings. Por favor, intenta más tarde.';
        this.loading = false;
      }
    });
  }

  private mapearRespuestaRankings(res: any): RankingEntry[] {
    // La API devuelve un objeto con { rankings: [...] }
    const items: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.rankings)
        ? res.rankings
        : [];
    return items.slice(0, 5).map((it) => ({
      overallRank: it?.overallRank,
      country: it?.country,
      name: this.limpiarNombre(it?.name, it?.country)
    }));
  }

  private limpiarNombre(nameRaw?: string, country?: string): string {
    if (!nameRaw) return 'Desconocido';
    let name = nameRaw.replace(/\s+/g, ' ').trim();
    // El nombre puede traer el país al final; intentar removerlo si coincide
    if (country) {
      const countryTrim = String(country).trim();
      const regex = new RegExp(`\\b${countryTrim}\\b$`);
      name = name.replace(regex, '').trim();
    }
    return name;
  }

  getNombreRanking(e: RankingEntry): string {
    return e.name || 'Desconocido';
  }

  getPaisRanking(e: RankingEntry): string | null {
    return e.country || null;
  }

  getEtiquetaRanking(e: RankingEntry): string {
    return e.overallRank ? `#${e.overallRank}` : '';
  }
}
