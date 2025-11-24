import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { DatosService } from '../services/datos.service';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { CityNamePipe } from '../pipes/city-name.pipe';
import { CountryCodePipe } from '../pipes/country-code.pipe';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { Competition } from '../models/competition.interface';
import { DashboardStats, RankingEntryView, TopEvent } from '../models/dashboard.interfaces';

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
    MatTabsModule,
    RouterLink,
    CountryFlagPipe,
    CityNamePipe
  ],
  templateUrl: './dash-board.component.html',
  styleUrl: './dash-board.component.scss',
})
export class DashBoardComponent implements OnInit {
  loading = true;
  loadingRankings = true;
  stats: DashboardStats = {
    totalCompeticiones: 0,
    competicionesLive: 0,
    competiciones25m: 0,
    competiciones50m: 0,
    competicionesConResultados: 0,
  };
  competicionesDestacadas: Competition[] = [];
  eventosTop: TopEvent[] = [];
  errorRankings: string | null = null;
  errorCompeticiones: string | null = null;
  selectedIndex = 0;
  
  // Control del carrusel de competiciones
  currentCompetitionIndex = 0;
  itemsPerViewCompetitions = 3;
  
  // Control del carrusel de rankings
  currentRankingIndex = 0;
  itemsPerViewRankings = 3;
  
  // Exponer Math para usar en template
  Math = Math;

  constructor(private datosService: DatosService, private router: Router) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }

  get tabs() {
    const base = [{ key: 'resumen', label: 'Resumen' }];
    // IMPORTANTE: Siempre mostrar la pestaña "Destacadas", incluso si está cargando
    base.push({ key: 'destacadas', label: 'Destacadas' });
    base.push({ key: 'rankings', label: 'Rankings' });
    return base;
  }
  cargarCompeticionesDestacadas(): void {
    const currentYear = new Date().getFullYear();

    console.log('🔄 Cargando competiciones destacadas...'); // Debug

    this.datosService
      .getWorldAquaticsCompetitions({
        group: 'FINA',
        discipline: 'SW',
        year: currentYear,
        month: 'latest',
        refresh: false,
      })
      .subscribe({
        next: (data: any) => {
          console.log('✅ Respuesta de competiciones:', data); // Debug

          const list = Array.isArray(data?.competitions)
            ? data.competitions
            : [];
          console.log('📋 Lista de competiciones:', list.length); // Debug

          this.competicionesDestacadas = this.procesarCompeticiones(list);
          console.log(
            '🌟 Competiciones destacadas procesadas:',
            this.competicionesDestacadas.length
          ); // Debug

          this.calcularEstadisticas();
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error al cargar competiciones destacadas:', error);
          this.errorCompeticiones =
            'No se pudieron cargar las competiciones destacadas.';
          this.competicionesDestacadas = [];
          this.loading = false;
        },
      });
  }

  cargarDatos(): void {
    this.loading = true;

    // Cargar competiciones destacadas de World Aquatics
    this.cargarCompeticionesDestacadas();

    // Cargar rankings
    this.cargarRankingsDestacados();
  }

  procesarCompeticiones(list: any[]): Competition[] {
    console.log('🔧 Procesando competiciones, total:', list.length); // Debug

    // Normalizar competiciones
    const competiciones = list.map((item, index) =>
      this.normalizeCompetition(item, index)
    );

    // Filtrar competiciones: priorizar las que están en curso o próximas
    const inProgress: Competition[] = [];
    const upcoming: Competition[] = [];
    const recent: Competition[] = [];
    const others: Competition[] = [];

    competiciones.forEach((comp) => {
      const status = this.getCompetitionStatus(comp);
      console.log(`📅 ${comp.name}: ${status}`); // Debug

      if (status === 'live') {
        inProgress.push(comp);
      } else if (status === 'upcoming') {
        upcoming.push(comp);
      } else if (status === 'recent') {
        recent.push(comp);
      } else {
        others.push(comp);
      }
    });

    // Ordenar por fecha
    const sortByDate = (a: Competition, b: Competition) => {
      const aDate = new Date(a.startDate || a.endDate || '');
      const bDate = new Date(b.startDate || b.endDate || '');
      return aDate.getTime() - bDate.getTime();
    };

    inProgress.sort(sortByDate);
    upcoming.sort(sortByDate);
    recent.sort((a, b) => -sortByDate(a, b)); // Más recientes primero
    others.sort((a, b) => -sortByDate(a, b)); // Más recientes primero

    console.log(
      `✅ Live: ${inProgress.length}, Upcoming: ${upcoming.length}, Recent: ${recent.length}, Others: ${others.length}`
    ); // Debug

    // Combinar: primero en vivo, luego próximas, luego recientes, luego otras (hasta 6 total)
    const destacadas = [...inProgress, ...upcoming, ...recent, ...others].slice(
      0,
      6
    );

    console.log('🎯 Competiciones destacadas finales:', destacadas.length); // Debug

    return destacadas;
  }

  private normalizeCompetition(raw: any, index: number): Competition {
    const sanitize = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text.length ? text : null;
    };

    const startDate = typeof raw?.startDate === 'string' ? raw.startDate : null;
    const endDate = typeof raw?.endDate === 'string' ? raw.endDate : null;

    return {
      name: sanitize(raw?.name) ?? `Competición ${index + 1}`,
      stage: sanitize(raw?.stage),
      date: sanitize(raw?.date),
      startDate,
      endDate,
      poolName: sanitize(raw?.poolName),
      city: sanitize(raw?.city),
      countryCode: sanitize(raw?.countryCode),
      flagImage: sanitize(raw?.flagImage),
      logo: sanitize(raw?.logo),
      url: sanitize(raw?.url),
      month: sanitize(raw?.month),
      year: sanitize(raw?.year)?.toString() || null,
      monthNumber: raw?.monthNumber,
    };
  }

  getCompetitionStatus(
    competition: Competition
  ): 'live' | 'upcoming' | 'recent' | 'past' {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const startDate = competition.startDate
      ? new Date(competition.startDate)
      : null;
    const endDate = competition.endDate ? new Date(competition.endDate) : null;

    if (!startDate && !endDate) return 'past';

    const start = startDate || endDate!;
    const end = endDate || startDate!;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // En progreso
    if (now >= start && now <= end) {
      return 'live';
    }

    // Próxima (dentro de los próximos 30 días)
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    if (start > now && start <= thirtyDaysFromNow) {
      return 'upcoming';
    }

    // Reciente (últimos 7 días)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (end >= sevenDaysAgo && end < now) {
      return 'recent';
    }

    return 'past';
  }

  calcularEstadisticas(): void {
    this.stats.totalCompeticiones = this.competicionesDestacadas.length;

    let live = 0;
    let lcm = 0;
    let scm = 0;
    let withResults = 0;

    this.competicionesDestacadas.forEach((comp) => {
      const status = this.getCompetitionStatus(comp);
      if (status === 'live') live++;

      // Inferir el tipo de piscina del nombre o stage
      const text = `${comp.name} ${comp.stage || ''}`.toLowerCase();
      if (
        text.includes('25m') ||
        text.includes('short course') ||
        text.includes('scm')
      ) {
        scm++;
      } else if (
        text.includes('50m') ||
        text.includes('long course') ||
        text.includes('lcm')
      ) {
        lcm++;
      }

      // Las competiciones pasadas o recientes probablemente tengan resultados
      if (status === 'recent' || status === 'past') {
        withResults++;
      }
    });

    this.stats.competicionesLive = live;
    this.stats.competiciones25m = scm;
    this.stats.competiciones50m = lcm;
    this.stats.competicionesConResultados = withResults;
  }

  isLive(competition: Competition): boolean {
    return this.getCompetitionStatus(competition) === 'live';
  }

  isUpcoming(competition: Competition): boolean {
    return this.getCompetitionStatus(competition) === 'upcoming';
  }

  isRecent(competition: Competition): boolean {
    return this.getCompetitionStatus(competition) === 'recent';
  }

  getCourseIcon(competition: Competition): string {
    const text = `${competition.name} ${competition.stage || ''}`.toLowerCase();
    if (
      text.includes('25m') ||
      text.includes('short course') ||
      text.includes('scm')
    ) {
      return 'straighten';
    }
    return 'waves';
  }

  getCourseName(competition: Competition): string {
    const text = `${competition.name} ${competition.stage || ''}`.toLowerCase();
    if (
      text.includes('25m') ||
      text.includes('short course') ||
      text.includes('scm')
    ) {
      return '25m (SCM)';
    }
    return '50m (LCM)';
  }

  formatDate(competition: Competition): string {
    if (competition.date) return competition.date;

    const start = competition.startDate;
    const end = competition.endDate;

    if (!start && !end) return 'Fecha por confirmar';

    const formatSingle = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    };

    if (start && end && start !== end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getFullYear() === endDate.getFullYear()
      ) {
        return `${startDate.getDate()}-${endDate.getDate()} ${endDate.toLocaleDateString(
          'es-ES',
          { month: 'short', year: 'numeric' }
        )}`;
      }

      return `${formatSingle(start)} - ${formatSingle(end)}`;
    }

    return formatSingle(start || end!);
  }

  viewCompetitionResults(competition: Competition): void {
    if (!competition.url) return;

    this.router.navigate(['/resultado-prueba'], {
      queryParams: {
        url: competition.url,
        name: competition.name,
      },
      state: {
        competition: {
          name: competition.name,
          stage: competition.stage,
          date: this.formatDate(competition),
          startDate: competition.startDate,
          endDate: competition.endDate,
          city: competition.city,
          countryCode: competition.countryCode,
          poolName: competition.poolName,
          logo: competition.logo,
        },
      },
    });
  }

  trackCompetition = (_index: number, competition: Competition) =>
    competition.url ||
    `${competition.name}-${competition.startDate ?? ''}-${
      competition.endDate ?? ''
    }`;

    private cargarRankingsDestacados(): void {
    this.loadingRankings = true;
    const eventos: Omit<TopEvent, 'top'>[] = [
      {
        key: 'F_50_BACK',
        title: '50 espalda (F)',
        gender: 'F',
        distance: '50',
        stroke: 'BACKSTROKE',
        poolConfiguration: 'LCM',
      },
      {
        key: 'M_50_BACK',
        title: '50 espalda (M)',
        gender: 'M',
        distance: '50',
        stroke: 'BACKSTROKE',
        poolConfiguration: 'LCM',
      },
      {
        key: 'F_50_FREE',
        title: '50 libre (F)',
        gender: 'F',
        distance: '50',
        stroke: 'FREESTYLE',
        poolConfiguration: 'LCM',
      },
      {
        key: 'M_50_FREE',
        title: '50 libre (M)',
        gender: 'M',
        distance: '50',
        stroke: 'FREESTYLE',
        poolConfiguration: 'LCM',
      },
      {
        key: 'F_50_BUTTERFLY',
        title: '50 mariposa (F)',
        gender: 'F',
        distance: '50',
        stroke: 'BUTTERFLY',
        poolConfiguration: 'LCM',
      },
      {
        key: 'M_50_BUTTERFLY',
        title: '50 mariposa (M)',
        gender: 'M',
        distance: '50',
        stroke: 'BUTTERFLY',
        poolConfiguration: 'LCM',
      },
      {
        key: 'F_50_BREASTSTROKE',
        title: '50 braza (F)',
        gender: 'F',
        distance: '50',
        stroke: 'BREASTSTROKE',
        poolConfiguration: 'LCM',
      },
      {
        key: 'M_50_BREASTSTROKE',
        title: '50 braza (M)',
        gender: 'M',
        distance: '50',
        stroke: 'BREASTSTROKE',
        poolConfiguration: 'LCM',
      },
    ];

    const requests = eventos.map((e: any) =>
      this.datosService
        .getRankings({
          gender: e.gender,
          distance: e.distance,
          stroke: e.stroke,
          poolConfiguration: e.poolConfiguration,
          limit: 3,
        })
        .pipe(
          map((arr: any) => ({
            ...e,
            top: this.mapearRespuestaRankings(arr),
            error: false,
          })),
          catchError((err) => {
            console.error('Error cargando ranking para ' + e.title + ':', err);
            return of({
              ...e,
              top: [],
              error: true,
              errorMessage: err?.error?.mensaje || err?.message || 'Error al cargar datos',
            });
          })
        )
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        this.eventosTop = res.filter((ev: any) => !ev.error && ev.top.length > 0) as TopEvent[];
        const errores = res.filter((ev: any) => ev.error);
        if (errores.length > 0 && this.eventosTop.length === 0) {
          this.errorRankings = 'No se pudieron cargar los rankings. Por favor, intenta más tarde.';
        } else if (errores.length > 0) {
          this.errorRankings = `Algunos rankings no se pudieron cargar (${errores.length} de ${res.length})`;
        }
        this.loadingRankings = false;
      },
      error: (err) => {
        console.error('Error crítico cargando rankings:', err);
        this.errorRankings = 'Error al cargar los rankings. Por favor, intenta más tarde.';
        this.loadingRankings = false;
      },
    });
  }

  private mapearRespuestaRankings(res: any): RankingEntryView[] {
    const items: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.rankings)
      ? res.rankings
      : [];
    
    return items.slice(0, 5).map((it) => ({
      overallRank: it?.overallRank,
      rank: it?.rank || it?.overallRank,
      country: it?.country,
      name: this.limpiarNombre(it?.name, it?.country),
      imageUrl: it?.imageUrl || null,
      profileUrl: it?.profileUrl || null,
    }));
  }

  private limpiarNombre(nameRaw?: string, country?: string): string {
    if (!nameRaw) return 'Desconocido';
    let name = nameRaw.replace(/\s+/g, ' ').trim();
    if (country) {
      const countryTrim = String(country).trim();
      const regex = new RegExp(`\\b${countryTrim}\\b$`);
      name = name.replace(regex, '').trim();
    }
    return name;
  }

  getNombreRanking(e: RankingEntryView): string {
    return e.name || 'Desconocido';
  }

  getPaisRanking(e: RankingEntryView): string | null {
    return e.country || null;
  }

    getEtiquetaRanking(e: RankingEntryView): string {
    return e.overallRank ? `#${e.overallRank}` : '';
  }

  getAvatarUrl(entry: RankingEntryView): string {
    if (entry.imageUrl) {
      return entry.imageUrl;
    }
    
    const initials = this.getInitials(entry.name);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1976d2&color=fff&size=128&bold=true`;
  }

  private getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0]?.substring(0, 2).toUpperCase() || '??';
  }

  onAthleteImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.dataset['name']) {
      const initials = this.getInitials(img.dataset['name']);
      img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=128&bold=true`;
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  navigateToRanking(event: TopEvent): void {
    // Navegar a ranking-nadadores con los parámetros del evento
    this.router.navigate(['/nadadores'], {
      queryParams: {
        gender: event.gender,
        distance: event.distance,
        stroke: event.stroke,
        poolConfiguration: event.poolConfiguration
      }
    });
  }

  navigateToAthleteRanking(event: TopEvent, entry: RankingEntryView): void {
    // Si el atleta tiene profileUrl, abrirlo en nueva pestaña
    if (entry.profileUrl) {
      window.open(entry.profileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Si no, navegar al ranking con los filtros del evento
    this.navigateToRanking(event);
  }

  // Métodos para el carrusel de competiciones
  get maxCompetitionIndex(): number {
    return Math.max(0, this.competicionesDestacadas.length - this.itemsPerViewCompetitions);
  }

  get canScrollCompetitionsLeft(): boolean {
    return this.currentCompetitionIndex > 0;
  }

  get canScrollCompetitionsRight(): boolean {
    return this.currentCompetitionIndex < this.maxCompetitionIndex;
  }

  scrollCompetitionsLeft(): void {
    if (this.canScrollCompetitionsLeft) {
      this.currentCompetitionIndex--;
    }
  }

  scrollCompetitionsRight(): void {
    if (this.canScrollCompetitionsRight) {
      this.currentCompetitionIndex++;
    }
  }

  // Métodos para el carrusel de rankings
  get maxRankingIndex(): number {
    return Math.max(0, this.eventosTop.length - this.itemsPerViewRankings);
  }

  get canScrollRankingsLeft(): boolean {
    return this.currentRankingIndex > 0;
  }

  get canScrollRankingsRight(): boolean {
    return this.currentRankingIndex < this.maxRankingIndex;
  }

  scrollRankingsLeft(): void {
    if (this.canScrollRankingsLeft) {
      this.currentRankingIndex--;
    }
  }

  scrollRankingsRight(): void {
    if (this.canScrollRankingsRight) {
      this.currentRankingIndex++;
    }
  }
}
