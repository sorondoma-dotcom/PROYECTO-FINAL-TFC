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
}

interface FocusGoal {
  title: string;
  progress: number;
  hint: string;
  icon: string;
  accent: 'primary' | 'accent' | 'success' | 'muted';
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

  paceByStroke: PaceItem[] = [
    { label: '100 libre', value: '52.8s', progress: 88, icon: 'speed', accent: 'primary' },
    { label: '100 mariposa', value: '56.9s', progress: 82, icon: 'water', accent: 'accent' },
    { label: '200 espalda', value: '1:58', progress: 74, icon: 'timeline', accent: 'muted' },
    { label: '100 braza', value: '1:05', progress: 69, icon: 'waves', accent: 'success' }
  ];

  competitionPulse: CompetitionPulse[] = [
    { name: 'Gran Prix Series', city: 'Doha', countryCode: 'QA', startDate: '2025-02-12', status: 'upcoming' },
    { name: 'Circuito Mediterraneo', city: 'Barcelona', countryCode: 'ES', startDate: '2025-01-28', status: 'recent' },
    { name: 'NCAA Trials', city: 'Austin', countryCode: 'US', startDate: '2025-02-02', status: 'live' }
  ];

  topAthletes: AthleteSpotlight[] = [
    { name: 'Summer McIntosh', country: 'CA', event: '400 libre', time: '3:55.3', points: 980 },
    { name: 'Leon Marchand', country: 'FR', event: '200 estilos', time: '1:54.6', points: 972 },
    { name: 'Maggie MacNeil', country: 'CA', event: '100 mariposa', time: '55.0', points: 940 }
  ];

  focusGoals: FocusGoal[] = [
    { title: 'Cobertura por pais', progress: 72, hint: 'Feed WA + NCAA + locales', icon: 'public', accent: 'primary' },
    { title: 'Seguimiento en vivo', progress: 54, hint: 'Carriles con marcadores sincronizados', icon: 'radio', accent: 'accent' },
    { title: 'Perfiles enriquecidos', progress: 61, hint: 'Fotos, puntos y bio curada', icon: 'badge', accent: 'muted' }
  ];

  constructor(private datosService: DatosService, private competitionService: CompetitionService) {}

  ngOnInit(): void {
    this.loadData();
  }

  refresh(): void {
    this.loadData();
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
      sprint: this.datosService
        .getRankings({
          gender: 'F',
          distance: '100',
          stroke: 'FREESTYLE',
          poolConfiguration: 'LCM',
          limit: 6
        })
        .pipe(
          catchError((err) => {
            console.error('Fallo al cargar rankings', err);
            return of(null);
          })
        ),
      scheduled: this.competitionService
        .getAllCompetitions()
        .pipe(
          catchError((err) => {
            console.error('Fallo al cargar competiciones agendadas', err);
            return of(null);
          })
        )
    }).subscribe(({ competitions, sprint, scheduled }) => {
      if (scheduled) {
        this.applyScheduledCompetitions(scheduled);
      }

      if (competitions) {
        this.applyCompetitionData(competitions);
      }

      if (sprint) {
        this.applyAthleteData(sprint);
      }

      this.loading = false;
    });
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

    if (upcoming > 0) {
      this.focusGoals = this.focusGoals.map((goal) =>
        goal.title === 'Seguimiento en vivo'
          ? { ...goal, progress: Math.min(100, goal.progress + 6), hint: 'Calendario sincronizado con WA' }
          : goal
      );
    }
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

  private applyAthleteData(raw: any): void {
    const mapped = this.mapRankingResponse(raw)
      .slice(0, 4)
      .map((item: RankingEntry, idx: number): AthleteSpotlight => ({
        name: item?.name || `Atleta ${idx + 1}`,
        country: item?.country || '',
        event: this.formatEvent(item),
        time: item?.time || item?.timeText || '--',
        points: item?.points || undefined,
        profileUrl: item?.profileUrl || undefined,
        stroke: item?.stroke
      }));

    if (!mapped.length) {
      return;
    }

    this.topAthletes = mapped;

    const topPoints = mapped.find((m) => m.points)?.points;
    if (topPoints) {
      this.summaryCards = this.summaryCards.map((card) =>
        card.key === 'records' ? { ...card, value: `${topPoints}+`, helper: 'Refrescado con ranking' } : card
      );
    }
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
}
