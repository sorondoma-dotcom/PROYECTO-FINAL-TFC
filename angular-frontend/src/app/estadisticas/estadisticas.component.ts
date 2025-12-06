import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatosService } from '../services/datos.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { CityNamePipe } from '../pipes/city-name.pipe';
import { CompetitionService, Competition } from '../services/competition.service';

type PulseStatus = 'live' | 'upcoming' | 'recent' | 'past';

interface SummaryCard {
  key: 'volume' | 'live' | 'records' | 'coverage';
  title: string;
  value: string;
  helper: string;
  trend: number;
  icon: string;
  accent: 'primary' | 'accent' | 'success' | 'muted';
}

interface PaceItem {
  label: string;
  value: string;
  progress: number;
  icon: string;
  accent: 'primary' | 'accent' | 'success' | 'muted';
}

interface CompetitionPulse {
  name: string;
  city?: string;
  countryCode?: string;
  startDate?: string;
  endDate?: string;
  status: PulseStatus;
}

interface AthleteSpotlight {
  name: string;
  country?: string;
  event: string;
  time: string;
  points?: number;
  profileUrl?: string;
  stroke?: string;
  imageUrl?: string;
}

interface RankingEntry {
  name?: string;
  country?: string;
  distance?: string | number;
  stroke?: string;
  time?: string;
  timeText?: string;
  points?: number;
  profileUrl?: string;
}

interface NormalizedCompetition {
  name: string;
  city?: string;
  countryCode?: string;
  startDate?: string;
  endDate?: string;
}

interface ScheduledStatusMetric {
  status: NonNullable<Competition['estado']>;
  label: string;
  value: number;
  icon: string;
  accent: 'primary' | 'accent' | 'success' | 'muted' | 'warn';
}

interface OlympicLeader {
  athleteId: number;
  name: string;
  countryCode?: string | null;
  records: number;
  imageUrl?: string | null;
}
interface MedalLeader {
  athleteId: number;
  name: string;
  countryCode?: string | null;
  value: number;
  imageUrl?: string | null;
}

interface GenderLeaders {
  male: MedalLeader | null;
  female: MedalLeader | null;
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    CountryFlagPipe,
    CityNamePipe
  ],
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.scss'
})
export class EstadisticasComponent implements OnInit {
  loading = true;
  error: string | null = null;
  scheduledCompetitions: Competition[] = [];
  scheduledStatusMetrics: ScheduledStatusMetric[] = [];
  scheduledHighlights: Competition[] = [];

  private remoteStats = { total: 0, live: 0, coverage: 0 };
  private localStats = { total: 0, live: 0, upcoming: 0 };
  olympicLeader: OlympicLeader | null = null;
  goldLeaders: GenderLeaders | null = null;
  silverLeaders: GenderLeaders | null = null;
  worldRecordLeaders: GenderLeaders | null = null;
  finaPointsLeader: AthleteSpotlight | null = null;
  
  // Nuevas estadísticas dinámicas
  dashboardStats: any = null;
  topCountries: any[] = [];
  youngTalents: any[] = [];
  versatileAthletes: any[] = [];
  recentRecordBreakers: any[] = [];

  summaryCards: SummaryCard[] = [
    {
      key: 'volume',
      title: 'Competencias monitoreadas',
      value: '12',
      helper: 'Feed activo + cache local',
      trend: 8,
      icon: 'waves',
      accent: 'primary'
    },
    {
      key: 'live',
      title: 'Sesiones en vivo',
      value: '3',
      helper: 'Ultimas 24h',
      trend: 12,
      icon: 'bolt',
      accent: 'accent'
    },
    {
      key: 'records',
      title: 'Puntos elite',
      value: '920+',
      helper: 'Marcas en el radar',
      trend: 4,
      icon: 'emoji_events',
      accent: 'success'
    },
    {
      key: 'coverage',
      title: 'Cobertura datasets',
      value: '78%',
      helper: 'Origenes conectados',
      trend: 9,
      icon: 'cloud_sync',
      accent: 'muted'
    }
  ];

  paceByStroke: PaceItem[] = [];
  competitionPulse: CompetitionPulse[] = [];
  topAthletes: AthleteSpotlight[] = [];

  constructor(private datosService: DatosService, private competitionService: CompetitionService) {}

  ngOnInit(): void {
    this.loadData();
  }

  refresh(): void {
    this.loadData();
  }

  getAthleteImageUrl(imageUrl?: string | null): string | null {
    if (!imageUrl) {
      return null;
    }
    // Si la URL ya es completa, la usamos tal cual
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // Si es una ruta relativa, la convertimos
    return imageUrl;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }

  onSimpleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  formatDateLabel(comp: CompetitionPulse): string {
    if (!comp.startDate && !comp.endDate) {
      return 'Fecha TBA';
    }

    const candidate = comp.startDate || comp.endDate;
    const parsed = candidate ? new Date(candidate) : null;
    if (parsed && !isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    return candidate || 'Fecha TBA';
  }

  getStatusLabel(status: PulseStatus): string {
    switch (status) {
      case 'live':
        return 'En vivo';
      case 'upcoming':
        return 'Proxima';
      case 'recent':
        return 'Reciente';
      default:
        return 'Archivo';
    }
  }

  getStatusClass(status: PulseStatus): string {
    if (status === 'live') return 'live';
    if (status === 'upcoming') return 'upcoming';
    if (status === 'recent') return 'recent';
    return 'past';
  }

  get pacePreview(): PaceItem[] {
    return this.paceByStroke.slice(0, 3);
  }

  private loadData(): void {
    this.loading = true;
    this.error = null;

    const year = new Date().getFullYear();

    forkJoin({
      competitions: this.datosService
        .getWorldAquaticsCompetitions({
          group: 'FINA',
          discipline: 'SW',
          year,
          month: 'latest',
          cacheTtl: 45
        })
        .pipe(
          catchError((err) => {
            console.error('Fallo al cargar competiciones', err);
            this.error = 'No pudimos sincronizar el feed en vivo. Usando datos locales.';
            return of(null);
          })
        ),
      // Rankings para atletas destacados (top 5 de cada categoría)
      rankingFreestyle100M: this.datosService.getRankings({ gender: 'M', distance: '100', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingFreestyle100F: this.datosService.getRankings({ gender: 'F', distance: '100', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingButterfly100M: this.datosService.getRankings({ gender: 'M', distance: '100', stroke: 'BUTTERFLY', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingButterfly100F: this.datosService.getRankings({ gender: 'F', distance: '100', stroke: 'BUTTERFLY', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingBackstroke200M: this.datosService.getRankings({ gender: 'M', distance: '200', stroke: 'BACKSTROKE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingBackstroke200F: this.datosService.getRankings({ gender: 'F', distance: '200', stroke: 'BACKSTROKE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingBreaststroke100M: this.datosService.getRankings({ gender: 'M', distance: '100', stroke: 'BREASTSTROKE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingBreaststroke100F: this.datosService.getRankings({ gender: 'F', distance: '100', stroke: 'BREASTSTROKE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingFreestyle50M: this.datosService.getRankings({ gender: 'M', distance: '50', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingFreestyle50F: this.datosService.getRankings({ gender: 'F', distance: '50', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingFreestyle200M: this.datosService.getRankings({ gender: 'M', distance: '200', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      rankingFreestyle200F: this.datosService.getRankings({ gender: 'F', distance: '200', stroke: 'FREESTYLE', poolConfiguration: 'LCM', limit: 5 }).pipe(catchError(() => of(null))),
      scheduled: this.competitionService
        .getAllCompetitions()
        .pipe(
          catchError((err) => {
            console.error('Fallo al cargar competiciones agendadas', err);
            return of(null);
          })
        ),
      olympicLeader: this.datosService
        .getOlympicRecordLeader()
        .pipe(
          catchError((err) => {
            console.error('Fallo al calcular records olimpicos', err);
            return of(null);
          })
        ),
      dashboardStats: this.datosService
        .getDashboardStats()
        .pipe(
          catchError((err) => {
            console.error('Fallo al cargar estadisticas del dashboard', err);
            return of(null);
          })
        )
    }).subscribe((data) => {
      const { competitions, scheduled, olympicLeader } = data;

      if (scheduled) {
        this.applyScheduledCompetitions(scheduled);
      }

      if (competitions) {
        this.applyCompetitionData(competitions);
      }

      if (olympicLeader) {
        this.applyHallOfFameStats(olympicLeader);
      } else {
        this.olympicLeader = null;
        this.goldLeaders = null;
        this.silverLeaders = null;
        this.worldRecordLeaders = null;
        this.finaPointsLeader = null;
      }

      // Procesar todos los rankings para atletas destacados
      const allRankings = [
        data.rankingFreestyle100M,
        data.rankingFreestyle100F,
        data.rankingButterfly100M,
        data.rankingButterfly100F,
        data.rankingBackstroke200M,
        data.rankingBackstroke200F,
        data.rankingBreaststroke100M,
        data.rankingBreaststroke100F,
        data.rankingFreestyle50M,
        data.rankingFreestyle50F,
        data.rankingFreestyle200M,
        data.rankingFreestyle200F
      ].filter(r => r !== null);

      this.applyAllRankingsData(allRankings);
      this.applyPaceByStroke(data.rankingFreestyle100M, data.rankingButterfly100M, data.rankingBackstroke200M, data.rankingBreaststroke100M);

      // Procesar estadísticas del dashboard
      if (data.dashboardStats) {
        this.applyDashboardStats(data.dashboardStats);
      }

      this.loading = false;
    });
  }

  private applyDashboardStats(stats: any): void {
    this.dashboardStats = stats;
    
    // Actualizar tarjetas de resumen con datos reales
    if (stats.totalAthletes) {
      this.summaryCards = this.summaryCards.map((card) => {
        if (card.key === 'volume') {
          const total = this.remoteStats.total + this.localStats.total;
          return { 
            ...card, 
            value: `${total || stats.totalCompetitions || 0}`, 
            helper: `${stats.totalAthletes} atletas registrados` 
          };
        }
        return card;
      });
    }

    // Guardar datos para mostrar en el template
    this.topCountries = stats.topCountries || [];
    this.youngTalents = stats.upcomingStars || [];
    this.versatileAthletes = stats.versatileAthletes || [];
    this.recentRecordBreakers = stats.recordBreakers || [];
  }

  formatScheduledDate(value?: string | null): string {
    if (!value) {
      return 'Sin fecha';
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    return value;
  }

  getEstadoLabel(estado?: Competition['estado']): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      en_curso: 'En curso',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada'
    };
    return map[estado ?? 'pendiente'] ?? 'Pendiente';
  }

  private applyPaceByStroke(freestyle100: any, butterfly100: any, backstroke200: any, breaststroke100: any): void {
    const paces: PaceItem[] = [];

    if (freestyle100) {
      const record = this.extractTopRecord(freestyle100);
      if (record) {
        paces.push({
          label: '100 libre',
          value: record.time,
          progress: Math.min(100, (record.points || 900) / 11),
          icon: 'speed',
          accent: 'primary'
        });
      }
    }

    if (butterfly100) {
      const record = this.extractTopRecord(butterfly100);
      if (record) {
        paces.push({
          label: '100 mariposa',
          value: record.time,
          progress: Math.min(100, (record.points || 850) / 11),
          icon: 'water',
          accent: 'accent'
        });
      }
    }

    if (backstroke200) {
      const record = this.extractTopRecord(backstroke200);
      if (record) {
        paces.push({
          label: '200 espalda',
          value: record.time,
          progress: Math.min(100, (record.points || 800) / 11),
          icon: 'timeline',
          accent: 'muted'
        });
      }
    }

    if (breaststroke100) {
      const record = this.extractTopRecord(breaststroke100);
      if (record) {
        paces.push({
          label: '100 braza',
          value: record.time,
          progress: Math.min(100, (record.points || 750) / 11),
          icon: 'waves',
          accent: 'success'
        });
      }
    }

    this.paceByStroke = paces.length > 0 ? paces : this.getDefaultPaceByStroke();
  }

  private extractTopRecord(raw: any): { time: string; points?: number } | null {
    const records = this.mapRankingResponse(raw);
    if (records.length === 0) {
      return null;
    }
    const top = records[0];
    return {
      time: top.time || top.timeText || '--',
      points: top.points
    };
  }

  private getDefaultPaceByStroke(): PaceItem[] {
    return [
      { label: '100 libre', value: '--', progress: 0, icon: 'speed', accent: 'primary' },
      { label: '100 mariposa', value: '--', progress: 0, icon: 'water', accent: 'accent' },
      { label: '200 espalda', value: '--', progress: 0, icon: 'timeline', accent: 'muted' },
      { label: '100 braza', value: '--', progress: 0, icon: 'waves', accent: 'success' }
    ];
  }

  private applyCompetitionData(raw: any): void {
    const comps = this.normalizeCompetitions(raw);
    if (!comps.length) {
      return;
    }

    const live = comps.filter((c) => this.resolveStatus(c) === 'live').length;
    const upcoming = comps.filter((c) => this.resolveStatus(c) === 'upcoming').length;

    this.remoteStats = {
      total: comps.length,
      live,
      coverage: Math.min(96, Math.round((comps.length / 80) * 100))
    };

    this.updateSummaryCards();

    this.competitionPulse = comps
      .map((c) => ({
        ...c,
        status: this.resolveStatus(c)
      }))
      .slice(0, 6);

  }

  private applyScheduledCompetitions(payload: any): void {
    const scheduled = Array.isArray(payload?.competitions) ? payload.competitions : [];
    this.scheduledCompetitions = scheduled;

    if (!scheduled.length) {
      this.scheduledStatusMetrics = [];
      this.scheduledHighlights = [];
      this.localStats = { total: 0, live: 0, upcoming: 0 };
      this.updateSummaryCards();
      return;
    }

    const statusTemplate: Array<Omit<ScheduledStatusMetric, 'value'>> = [
      { status: 'pendiente', label: 'Pendientes', icon: 'schedule', accent: 'muted' },
      { status: 'en_curso', label: 'En curso', icon: 'sensors', accent: 'primary' },
      { status: 'finalizada', label: 'Finalizadas', icon: 'flag', accent: 'success' },
      { status: 'cancelada', label: 'Canceladas', icon: 'block', accent: 'warn' }
    ];

    this.scheduledStatusMetrics = statusTemplate
      .map((metric) => ({
        ...metric,
        value: scheduled.filter((comp:any) => (comp.estado ?? 'pendiente') === metric.status).length
      }))
      .filter((metric) => metric.value > 0 || metric.status !== 'cancelada');

    const now = new Date();
    this.localStats = {
      total: scheduled.length,
      live: scheduled.filter((comp:any) => (comp.estado ?? 'pendiente') === 'en_curso').length,
      upcoming: scheduled.filter((comp:any) => this.isUpcomingCompetition(comp, now)).length
    };

    const sorted = [...scheduled].sort(
      (a, b) => this.getDateValue(a.fecha_inicio) - this.getDateValue(b.fecha_inicio)
    );
    const upcoming = sorted.filter((comp) => this.isUpcomingCompetition(comp, now));
    this.scheduledHighlights = (upcoming.length ? upcoming : sorted).slice(0, 4);

    this.updateSummaryCards();
  }

  private applyAllRankingsData(allRankings: any[]): void {
    // Combinar todos los atletas de todos los rankings
    const allAthletes: AthleteSpotlight[] = [];

    allRankings.forEach((rankingData) => {
      const records = this.mapRankingResponse(rankingData);
      records.forEach((item: RankingEntry) => {
        if (item.name && item.points && item.points > 0) {
          allAthletes.push({
            name: item.name,
            country: item.country || '',
            event: this.formatEvent(item),
            time: item.time || item.timeText || '--',
            points: item.points,
            profileUrl: item.profileUrl || undefined,
            stroke: item.stroke
          });
        }
      });
    });

    if (allAthletes.length === 0) {
      this.topAthletes = [];
      return;
    }

    // Ordenar por puntos FINA descendente
    const sortedByPoints = [...allAthletes].sort((a, b) => (b.points || 0) - (a.points || 0));

    // Top atletas: seleccionar los 10 mejores, asegurando variedad
    this.topAthletes = this.selectDiverseTopAthletes(sortedByPoints, 10);
  }

  private selectDiverseTopAthletes(athletes: AthleteSpotlight[], limit: number): AthleteSpotlight[] {
    const selected: AthleteSpotlight[] = [];
    const seenNames = new Set<string>();
    const seenEvents = new Set<string>();

    // Priorizar variedad: diferentes atletas y diferentes eventos
    for (const athlete of athletes) {
      if (selected.length >= limit) break;

      const isDuplicateName = seenNames.has(athlete.name);
      const isDuplicateEvent = seenEvents.has(athlete.event);

      // Agregar si es nombre o evento único, o si ya tenemos pocos atletas
      if (!isDuplicateName || !isDuplicateEvent || selected.length < 3) {
        selected.push(athlete);
        seenNames.add(athlete.name);
        seenEvents.add(athlete.event);
      }
    }

    // Si no llegamos al límite, completar con los mejores restantes
    if (selected.length < limit) {
      for (const athlete of athletes) {
        if (selected.length >= limit) break;
        if (!selected.find(a => a.name === athlete.name && a.event === athlete.event)) {
          selected.push(athlete);
        }
      }
    }

    return selected.slice(0, limit);
  }

  private updateSummaryCards(): void {
    this.summaryCards = this.summaryCards.map((card) => {
      if (card.key === 'volume') {
        const total = this.remoteStats.total + this.localStats.total;
        if (!total) {
          return { ...card, value: '0', helper: 'Sin datos sincronizados' };
        }
        const helper = this.localStats.total
          ? `World Aquatics + ${this.localStats.total} agendadas`
          : 'Fuente World Aquatics';
        return { ...card, value: `${total}`, helper };
      }
      if (card.key === 'live') {
        const live = this.remoteStats.live + this.localStats.live;
        const helper = this.localStats.live
          ? `${this.remoteStats.live} WA + ${this.localStats.live} locales`
          : 'Ultimas 24h';
        const trend = live > 0 ? Math.min(40, live * 5 + 4) : 0;
        return { ...card, value: `${live}`, trend, helper };
      }
      if (card.key === 'coverage' && this.remoteStats.coverage > 0) {
        const helper = this.localStats.total
          ? 'Cobertura WA + agenda local'
          : 'Cobertura anual estimada';
        return { ...card, value: `${this.remoteStats.coverage}%`, helper };
      }
      return card;
    });
  }

  private isUpcomingCompetition(comp: Competition, now = new Date()): boolean {
    const status = comp.estado ?? 'pendiente';
    if (status === 'pendiente') {
      return true;
    }
    if (status === 'en_curso') {
      return false;
    }
    const start = this.parseDate(comp.fecha_inicio);
    return start ? start >= now : false;
  }

  private getDateValue(value?: string | null): number {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return Number.MAX_SAFE_INTEGER;
    }
    return parsed.getTime();
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private resolveStatus(comp: NormalizedCompetition): PulseStatus {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const start = comp.startDate ? new Date(comp.startDate) : null;
    const end = comp.endDate ? new Date(comp.endDate) : null;

    if (start && !isNaN(start.getTime())) {
      if (end && !isNaN(end.getTime())) {
        if (now >= start && now <= end) return 'live';
        if (start > now) return start.getTime() - now.getTime() <= 1000 * 60 * 60 * 24 * 30 ? 'upcoming' : 'past';
        if (end >= this.daysAgo(7)) return 'recent';
      } else {
        if (now.toDateString() === start.toDateString()) return 'live';
        if (start > now) return 'upcoming';
        if (start >= this.daysAgo(7)) return 'recent';
      }
    }

    if (end && !isNaN(end.getTime())) {
      if (now <= end) return 'live';
      if (end >= this.daysAgo(7)) return 'recent';
    }

    return 'past';
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private normalizeCompetitions(raw: any): NormalizedCompetition[] {
    const list = Array.isArray(raw?.competitions) ? raw.competitions : Array.isArray(raw) ? raw : [];
    return list.map((item: any, index: number) => ({
      name: typeof item?.name === 'string' ? item.name : `Competencia ${index + 1}`,
      city: typeof item?.city === 'string' ? item.city : '',
      countryCode: typeof item?.countryCode === 'string' ? item.countryCode : '',
      startDate: typeof item?.startDate === 'string' ? item.startDate : item?.date || '',
      endDate: typeof item?.endDate === 'string' ? item.endDate : ''
    }));
  }

  private mapRankingResponse(raw: any): RankingEntry[] {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.rankings)) return raw.rankings;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }

  private formatEvent(entry: RankingEntry): string {
    const distance = entry?.distance ? String(entry.distance) : '';
    const stroke = this.formatStroke(entry?.stroke);
    return [distance, stroke].filter(Boolean).join(' ');
  }

  private formatStroke(stroke?: string): string {
    if (!stroke) return 'libre';
    const map: Record<string, string> = {
      FREESTYLE: 'libre',
      BACKSTROKE: 'espalda',
      BREASTSTROKE: 'braza',
      BUTTERFLY: 'mariposa',
      MEDLEY: 'estilos',
      FREESTYLE_RELAY: 'relevo libre',
      MEDLEY_RELAY: 'relevo estilos'
    };
    return map[stroke] || stroke.toLowerCase();
  }

  private applyHallOfFameStats(payload: any): void {
    const leader = payload?.olympicLeader ?? payload?.leader ?? null;
    this.olympicLeader = this.mapLeader(leader, 'records');
    this.goldLeaders = this.mapGenderLeaders(payload?.gold);
    this.silverLeaders = this.mapGenderLeaders(payload?.silver);
    this.worldRecordLeaders = this.mapGenderLeaders(payload?.worldRecords);
    
    // Procesar líder de puntos FINA desde el backend
    if (payload?.finaPointsLeader) {
      this.finaPointsLeader = this.mapFinaPointsLeader(payload.finaPointsLeader);
      
      // Actualizar tarjeta de puntos elite
      const topPoints = this.finaPointsLeader?.points;
      if (topPoints) {
        this.summaryCards = this.summaryCards.map((card) =>
          card.key === 'records' ? { ...card, value: `${topPoints}`, helper: 'Máximo puntos FINA global' } : card
        );
      }
    }
  }

  private mapFinaPointsLeader(source: any): AthleteSpotlight | null {
    if (!source || !source.name) {
      return null;
    }

    const distance = source.distance ? String(source.distance) : '';
    const stroke = this.formatStroke(source.stroke);
    const event = [distance, stroke].filter(Boolean).join(' ') || source.event || 'Evento';

    return {
      name: source.name,
      country: source.countryCode || '',
      event: event,
      time: source.time || '--',
      points: source.finaPoints || 0,
      stroke: source.stroke
    };
  }

  private mapLeader(source: any, valueKey: 'records' | 'total' = 'records'): OlympicLeader | null {
    if (!source || !source.name) {
      return null;
    }
    return {
      athleteId: source.athleteId ?? 0,
      name: source.name,
      countryCode: source.countryCode || null,
      records: typeof source[valueKey] === 'number' ? source[valueKey] : source.records || 0
    };
  }

  private mapGenderLeaders(block: any): GenderLeaders | null {
    if (!block || (block.male == null && block.female == null)) {
      return null;
    }

    const male = this.mapMedalLeader(block.male);
    const female = this.mapMedalLeader(block.female);

    if (!male && !female) {
      return null;
    }

    return { male, female };
  }

  private mapMedalLeader(raw: any): MedalLeader | null {
    if (!raw || !raw.name) {
      return null;
    }

    const value = typeof raw.total === 'number' ? raw.total : (typeof raw.records === 'number' ? raw.records : raw.value || 0);

    return {
      athleteId: raw.athleteId ?? 0,
      name: raw.name,
      countryCode: raw.countryCode || null,
      value
    };
  }
}
