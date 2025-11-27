import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { DatosService } from '../services/datos.service';
import { Competition } from '../models/competition.interface';

interface AthleteProfile {
  name: string;
  athleteId?: number | null;
  country?: string;
  nationality?: string;
  imageUrl?: string;
  profileUrl?: string;
  gender?: string;
  age?: number | null;
  birth?: string | null;
  distance?: string;
  stroke?: string;
  pool?: string;
  points?: number | string | null;
  height?: string | null;
  weight?: string | null;
  club?: string | null;
  medals?: { gold: number; silver: number; bronze: number };
}

interface PersonalRecord {
  label: string;
  bestTime: string;
  competition?: string;
  date?: string;
  location?: string;
  points?: number | string | null;
}

interface AverageInfo {
  athleteBest: number | null;
  categoryAverage: number | null;
  diff: number | null;
}

@Component({
  selector: 'app-perfil-nadador',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatProgressBarModule,
    BaseChartDirective
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './perfil-nadador.component.html',
  styleUrls: ['./perfil-nadador.component.scss']
})
export class PerfilNadadorComponent implements OnInit {
  loading = true;
  loadingCompetitions = true;
  loadingBio = false;
  rankingError: string | null = null;
  competitionsError: string | null = null;

  athlete: AthleteProfile = {
    name: '',
    athleteId: null,
    country: '',
    nationality: '',
    imageUrl: '',
    profileUrl: '',
    gender: 'F',
    age: null,
    birth: null,
    distance: '100',
    stroke: 'BACKSTROKE',
    pool: 'LCM',
    points: null,
    height: null,
    weight: null,
    club: null
  };

  upcomingEvents: Competition[] = [];
  performances: any[] = [];
  dbResults: any[] = [];
  rankingData: any[] = [];
  records: PersonalRecord[] = [];
  averages: AverageInfo = { athleteBest: null, categoryAverage: null, diff: null };
  profileRecords: PersonalRecord[] = [];

  get hasChartData(): boolean {
    const datasets: any[] = (this.lineChartData as any)?.datasets || [];
    if (!datasets.length) return false;
    const data = datasets[0]?.data;
    return Array.isArray(data) && data.length > 0;
  }

  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Progreso',
        fill: false,
        tension: 0.3,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        pointBackgroundColor: '#1976d2',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        borderWidth: 3
      }
    ]
  };

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Tiempo: ${this.formatSeconds(Number(ctx.parsed.y))}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 35,
          autoSkip: true,
          maxTicksLimit: 10,
          font: {
            size: 11
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        ticks: {
          callback: (value) => this.formatSeconds(Number(value)),
          padding: 10,
          font: {
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        }
      }
    },
    layout: {
      padding: {
        top: 20,
        right: 20,
        bottom: 10,
        left: 10
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private datosService: DatosService
  ) {}

  ngOnInit(): void {
    this.populateFromRoute();
    this.loadAthleteBio();
    this.loadRankingData();
    this.loadDbResults();
    this.loadUpcomingCompetitions();
  }

  populateFromRoute(): void {
    const navState = this.router.getCurrentNavigation()?.extras.state as any;
    const params = this.route.snapshot.params;
    const query = this.route.snapshot.queryParams;

    const paramName = params['name'] ? decodeURIComponent(params['name']) : '';
    const stateAthlete = navState?.performer || {};
    const filters = navState?.filters || {};

    this.athlete = {
      ...this.athlete,
      name: paramName || stateAthlete.name || '',
      athleteId: stateAthlete.athleteId ?? null,
      country: query['country'] || stateAthlete.country || '',
      nationality: stateAthlete.nationality || '',
      imageUrl: query['imageUrl'] || stateAthlete.imageUrl || '',
      profileUrl: query['profileUrl'] || stateAthlete.profileUrl || '',
      gender: query['gender'] || filters.gender || 'F',
      age: query['age'] ? Number(query['age']) : (stateAthlete.age ?? null),
      distance: query['distance'] || filters.distance || '100',
      stroke: query['stroke'] || filters.stroke || 'BACKSTROKE',
      pool: query['pool'] || filters.poolConfiguration || 'LCM',
      points: query['points'] || stateAthlete.points || null
    };
  }

  loadDbResults(): void {
    const athleteId = this.athlete.athleteId;
    if (!athleteId) {
      return;
    }

    this.datosService.getAthleteResults(athleteId).subscribe({
      next: (res) => {
        const list = Array.isArray(res?.results) ? res.results : [];
        this.dbResults = list;
      },
      error: () => {
        this.dbResults = [];
      }
    });
  }

  loadAthleteBio(): void {
    if (!this.athlete.name) return;
    this.loadingBio = true;

    const profileCall = this.athlete.profileUrl
      ? this.datosService.getAthleteProfile({ url: this.athlete.profileUrl })
      : null;

    const listCall = this.datosService.getAthletes({
      name: this.athlete.name,
      gender: this.athlete.gender || undefined,
      discipline: 'SW'
    });

    (profileCall || listCall).subscribe({
      next: (res) => {
        if (res?.bestResults && Array.isArray(res.bestResults)) {
          this.profileRecords = res.bestResults.map((r: any) => ({
            label: r.event,
            bestTime: r.time,
            competition: r.competition || '',
            date: r.date || '',
            location: r.compCountry || '',
            points: null
          }));
          if (res.profileImage) this.athlete.imageUrl = res.profileImage;
          if (res.nationality) this.athlete.nationality = res.nationality;
          if (res.birth) this.athlete.birth = res.birth;
          if (!this.athlete.age && res.birth) this.athlete.age = this.calculateAge(res.birth);
          this.athlete.medals = res.medals;
        } else {
          const list = Array.isArray(res?.atletas) ? res.atletas : [];
          const bestMatch = list.find((a: any) =>
            this.normalize(a.name) === this.normalize(this.athlete.name)
          ) || list[0];

          if (bestMatch) {
            this.athlete.birth = bestMatch.birth || this.athlete.birth;
            this.athlete.nationality = bestMatch.nationality || this.athlete.nationality;
            this.athlete.imageUrl = this.athlete.imageUrl || bestMatch.imageUrl;
            if (!this.athlete.age && bestMatch.birth) {
              this.athlete.age = this.calculateAge(bestMatch.birth);
            }
          }
        }
        this.loadingBio = false;
      },
      error: () => {
        this.loadingBio = false;
      }
    });
  }

  loadRankingData(): void {
    this.loading = true;
    this.rankingError = null;
    this.datosService
      .getRankings({
        gender: (this.athlete.gender as 'M' | 'F') || 'F',
        distance: this.athlete.distance || '100',
        stroke: this.athlete.stroke || 'BACKSTROKE',
        poolConfiguration: (this.athlete.pool as 'LCM' | 'SCM') || 'LCM',
        limit: 150
      })
      .subscribe({
        next: (res) => {
          const datos = res?.rankings ?? res?.data ?? [];
          this.rankingData = datos;
          this.performances = datos
            .filter((d: any) => this.normalize(d.name) === this.normalize(this.athlete.name))
            .map((d: any) => ({
              ...d,
              stroke: this.athlete.stroke,
              distance: this.athlete.distance,
              poolConfiguration: this.athlete.pool
            }));

          this.records = this.buildRecords(this.performances);
          this.averages = this.buildAverages(datos, this.performances);
          this.updateChart();
          this.loading = false;
        },
        error: (err) => {
          this.rankingError = err?.message || 'No se pudieron cargar las marcas.';
          this.loading = false;
        }
      });
  }

  loadUpcomingCompetitions(): void {
    this.loadingCompetitions = true;
    const currentYear = new Date().getFullYear();

    this.datosService
      .getWorldAquaticsCompetitions({
        group: 'FINA',
        discipline: 'SW',
        year: currentYear,
        month: 'latest',
      })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res?.competitions) ? res.competitions : [];
          const now = new Date();

          const normalizedCountry = (this.athlete.country || '').toUpperCase();
          const mapped = list
            .map((c: any) => ({
              ...c,
              start: this.toDate(c.startDate || c.date || c.endDate)
            }))
            .filter((c: any) => c.start && c.start >= now);

          const filtered = normalizedCountry
            ? mapped.filter((c: any) => (c.countryCode || '').toUpperCase() === normalizedCountry)
            : mapped;

          this.upcomingEvents = filtered
            .sort((a: any, b: any) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0))
            .slice(0, 4);

          this.loadingCompetitions = false;
        },
        error: (err) => {
          this.competitionsError = err?.message || 'No se pudieron cargar los eventos.';
          this.loadingCompetitions = false;
        }
      });
  }

  buildRecords(performances: any[]): PersonalRecord[] {
    if (this.profileRecords.length) {
      return this.profileRecords;
    }
    if (!performances || performances.length === 0) return [];

    const timesWithValue = performances
      .map((p) => ({ ...p, value: this.parseTimeToSeconds(p.time) }))
      .filter((p) => Number.isFinite(p.value));

    if (!timesWithValue.length) return [];

    const best = timesWithValue.reduce((bestItem, current) => {
      if (!bestItem) return current;
      return current.value < bestItem.value ? current : bestItem;
    });

    const label = `${this.athlete.distance}m ${this.getStrokeLabel(this.athlete.stroke)} (${this.athlete.pool})`;

    return [
      {
        label,
        bestTime: this.formatSeconds(best.value),
        competition: best.competition || best.tag || '',
        date: best.date || '',
        location: best.location || '',
        points: best.points || null
      }
    ];
  }

  buildAverages(dataset: any[], athletePerformances: any[]): AverageInfo {
    const categoryTimes = (dataset || [])
      .map((d) => this.parseTimeToSeconds(d.time))
      .filter((v) => Number.isFinite(v));

    const athleteTimes = (athletePerformances || [])
      .map((p) => this.parseTimeToSeconds(p.time))
      .filter((v) => Number.isFinite(v));

    if (!categoryTimes.length || !athleteTimes.length) {
      return { athleteBest: null, categoryAverage: null, diff: null };
    }

    const athleteBest = Math.min(...athleteTimes);
    const categoryAverage = categoryTimes.reduce((acc, v) => acc + v, 0) / categoryTimes.length;

    return {
      athleteBest,
      categoryAverage,
      diff: athleteBest - categoryAverage
    };
  }

  updateChart(): void {
    if (!this.performances || this.performances.length === 0) {
      this.lineChartData = { labels: [], datasets: [{ ...this.lineChartData.datasets[0], data: [] }] };
      return;
    }

    const sorted = [...this.performances]
      .map((p) => ({ ...p, value: this.parseTimeToSeconds(p.time) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => {
        const aDate = this.toDate(a.date);
        const bDate = this.toDate(b.date);
        if (aDate && bDate) return aDate.getTime() - bDate.getTime();
        return a.value - b.value;
      });

    const labels = sorted.map((p) => this.buildLabel(p));
    const data = sorted.map((p) => p.value as number);

    this.lineChartData = {
      labels,
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data
        }
      ]
    };
  }

  buildLabel(performance: any): string {
    const date = this.toDate(performance.date);
    const dateStr = date ? date.toLocaleDateString() : (performance.date || '');
    const competition = performance.competition || performance.tag || 'Marca registrada';
    return `${competition} - ${dateStr}`;
  }

  openExternalProfile(): void {
    if (this.athlete.profileUrl) {
      window.open(this.athlete.profileUrl, '_blank', 'noopener');
    }
  }

  getStrokeLabel(stroke?: string): string {
    const map: Record<string, string> = {
      BACKSTROKE: 'Espalda',
      BREASTSTROKE: 'Braza',
      BUTTERFLY: 'Mariposa',
      MEDLEY: 'Combinado',
      FREESTYLE: 'Libre',
      FREESTYLE_RELAY: 'Libre relevo',
      MEDLEY_RELAY: 'Combinado relevo'
    };
    return map[stroke || ''] || (stroke || '');
  }

  averageDiffLabel(): string {
    if (this.averages.diff === null || this.averages.categoryAverage === null) return 'Sin datos';
    const diff = this.averages.diff;
    if (Math.abs(diff) < 0.01) return 'Igual que el promedio de la categoria';
    return diff < 0 ? 'Por encima del promedio' : 'Por debajo del promedio';
  }

  averageGapSeconds(): string {
    if (this.averages.diff === null) return '-';
    const sign = this.averages.diff > 0 ? '+' : '';
    return `${sign}${this.formatSeconds(Math.abs(this.averages.diff))}`;
  }

  progressValue(): number {
    if (this.averages.categoryAverage === null || this.averages.categoryAverage <= 0 || this.averages.diff === null) return 0;
    const percent = Math.abs(this.averages.diff) / this.averages.categoryAverage * 100;
    return Math.min(100, Math.max(0, percent));
  }

  parseTimeToSeconds(raw: any): number {
    if (!raw) return NaN;
    const s = String(raw).replace(/WR/gi, '').replace(/[^\d:.]/g, '').trim();

    if (s.includes(':')) {
      const parts = s.split(':').map((p) => p.trim());
      const nums = parts.map((p) => parseFloat(p));
      if (parts.length === 2) {
        return (nums[0] || 0) * 60 + (nums[1] || 0);
      }
      if (parts.length === 3) {
        return (nums[0] || 0) * 3600 + (nums[1] || 0) * 60 + (nums[2] || 0);
      }
    }

    const numeric = parseFloat(s);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  formatSeconds(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    const total = Number(value);
    const minutes = Math.floor(total / 60);
    const seconds = total - minutes * 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds.toFixed(2)}s`;
    }
    return `${seconds.toFixed(2)}s`;
  }

  calculateAge(birth: string): number | null {
    const date = this.toDate(birth);
    if (!date) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  normalize(value: string): string {
    return (value || '').toLowerCase().trim();
  }

  formatDateLabel(value: string | null | undefined): string {
    const d = this.toDate(value);
    if (!d) return value || '';
    return d.toLocaleDateString();
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    const str = String(value).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    // Intentar dd/mm/yyyy
    const parts = str.split('/').map((p) => p.trim());
    if (parts.length === 3) {
      const [day, month, year] = parts.map((p) => parseInt(p, 10));
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const parsed = new Date(year, month - 1, day);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return null;
  }
}
