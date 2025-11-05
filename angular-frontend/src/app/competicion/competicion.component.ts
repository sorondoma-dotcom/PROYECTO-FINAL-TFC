import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatosService } from '../datos.service';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { CityNamePipe } from '../pipes/city-name.pipe';

interface Competition {
  name: string;
  stage: string | null;
  date: string | null;
  startDate: string | null;
  endDate: string | null;
  poolName: string | null;
  city: string | null;
  countryCode: string | null;
  flagImage: string | null;
  logo: string | null;
  url: string | null;
  month: string | null;
  year: string | null;
  monthNumber: number | null;
}

interface CompetitionGroup {
  key: string;
  label: string;
  competitions: Competition[];
  sortValue: number;
}

@Component({
  selector: 'app-competicion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CountryFlagPipe,
    CityNamePipe
  ],
  templateUrl: './competicion.component.html',
  styleUrls: ['competicion.component.scss']
})
export class CompeticionComponent implements OnInit {
  private readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  private readonly monthNamesLower = this.monthNames.map(name => name.toLowerCase());

  competitions: Competition[] = [];
  groupedCompetitions: CompetitionGroup[] = [];
  loading = false;
  error: string | null = null;
  filterText = '';

  selectedYear = new Date().getFullYear();
  yearOptions: number[] = [this.selectedYear];
  selectedDiscipline = 'SW';
  readonly disciplineOptions = [
    { value: 'SW', label: 'Natación' },
    { value: 'DV', label: 'Saltos' },
    { value: 'WP', label: 'Water Polo' },
    { value: 'AS', label: 'Natación artística' },
    { value: 'OWS', label: 'Aguas abiertas' }
  ];

  private readonly selectedMonth = 'latest';

  constructor(private datos: DatosService) {}

  ngOnInit(): void {
    this.loadCompetitions();
  }

  loadCompetitions(refresh = false): void {
    this.loading = true;
    this.error = null;

    this.datos.getWorldAquaticsCompetitions({
      group: 'FINA',
      discipline: this.selectedDiscipline,
      month: this.selectedMonth,
      year: this.selectedYear,
      refresh
    }).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data?.competitions) ? data.competitions : [];
        this.handleCompetitions(list);
      },
      error: (err) => {
        console.error('Error cargando competiciones de World Aquatics', err);
        this.error = 'No se pudieron cargar las competiciones en este momento.';
        this.competitions = [];
        this.groupedCompetitions = [];
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const normalizedFilter = this.filterText.trim().toLowerCase();
    const filtered = normalizedFilter
      ? this.competitions.filter(comp => this.matchesFilter(comp, normalizedFilter))
      : [...this.competitions];

    const sorted = this.sortCompetitions(filtered);
    this.groupedCompetitions = this.buildGroups(sorted);
  }

  clearFilter(): void {
    this.filterText = '';
    this.applyFilters();
  }

  onFiltersChanged(): void {
    this.loadCompetitions();
  }

  onRefresh(): void {
    this.loadCompetitions(true);
  }

  trackGroup = (_index: number, group: CompetitionGroup) => group.key;
  trackCompetition = (_index: number, competition: Competition) =>
    competition.url || `${competition.name}-${competition.startDate ?? ''}-${competition.endDate ?? ''}`;

  private handleCompetitions(list: any[]): void {
    this.competitions = list.map((item, index) => this.normalizeCompetition(item, index));
    this.updateYearOptions(this.competitions);
    this.applyFilters();
  }

  private normalizeCompetition(raw: any, index: number): Competition {
    const sanitize = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text.length ? text : null;
    };

    const startDate = typeof raw?.startDate === 'string' ? raw.startDate : null;
    const endDate = typeof raw?.endDate === 'string' ? raw.endDate : null;
    const monthNumber = this.resolveMonthNumber(raw?.monthNumber, raw?.month, startDate);
    const year = this.resolveYear(raw?.year, startDate);

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
      year,
      monthNumber
    };
  }

  private matchesFilter(competition: Competition, filter: string): boolean {
    return [
      competition.name,
      competition.stage,
      competition.city,
      competition.poolName,
      competition.countryCode,
      competition.date
    ].some(value => value?.toLowerCase().includes(filter));
  }

  private sortCompetitions(list: Competition[]): Competition[] {
    return [...list].sort((a, b) => {
      const aTime = this.getSortTimestamp(a);
      const bTime = this.getSortTimestamp(b);
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });
  }

  private getSortTimestamp(competition: Competition): number {
    const candidates = [competition.startDate, competition.endDate];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const time = Date.parse(candidate);
      if (!Number.isNaN(time)) return time;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  private buildGroups(list: Competition[]): CompetitionGroup[] {
    const groups = new Map<string, CompetitionGroup>();

    list.forEach(competition => {
      const yearValue = this.parseYearNumber(competition);
      const monthValue = this.parseMonthNumber(competition);
      const label = this.buildGroupLabel(competition, monthValue, yearValue);
      const key = `${yearValue ?? 'none'}-${monthValue ?? 'none'}`;
      const sortValue = (yearValue ?? 9999) * 100 + (monthValue ?? 99);

      if (!groups.has(key)) {
        groups.set(key, { key, label, competitions: [], sortValue });
      }

      groups.get(key)!.competitions.push(competition);
    });

    const orderedGroups = Array.from(groups.values());
    orderedGroups.forEach(group => {
      group.competitions = this.sortCompetitions(group.competitions);
    });
    orderedGroups.sort((a, b) => a.sortValue - b.sortValue);

    return orderedGroups;
  }

  private buildGroupLabel(competition: Competition, monthValue: number | null, yearValue: number | null): string {
    const monthName = monthValue ? this.monthNames[monthValue - 1] : competition.month;
    if (monthName && yearValue) return `${monthName} ${yearValue}`;
    if (yearValue) return `Año ${yearValue}`;
    return 'Fechas por confirmar';
  }

  private updateYearOptions(list: Competition[]): void {
    const years = new Set<number>();
    list.forEach(competition => {
      const year = this.parseYearNumber(competition);
      if (year !== null) {
        years.add(year);
      }
    });

    if (!years.has(this.selectedYear)) {
      years.add(this.selectedYear);
    }

    this.yearOptions = Array.from(years).sort((a, b) => a - b);
  }

  private parseYearNumber(competition: Competition): number | null {
    if (competition.year) {
      const value = Number.parseInt(competition.year, 10);
      if (!Number.isNaN(value)) return value;
    }

    const candidates = [competition.startDate, competition.endDate];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) return date.getUTCFullYear();
    }

    return null;
  }

  private parseMonthNumber(competition: Competition): number | null {
    if (typeof competition.monthNumber === 'number' && Number.isFinite(competition.monthNumber)) {
      return competition.monthNumber;
    }

    if (competition.month) {
      const index = this.monthNamesLower.indexOf(competition.month.toLowerCase());
      if (index !== -1) return index + 1;
    }

    const candidates = [competition.startDate, competition.endDate];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) return date.getUTCMonth() + 1;
    }

    return null;
  }

  private resolveMonthNumber(rawMonth: unknown, rawMonthName: unknown, startDate: string | null): number | null {
    if (typeof rawMonth === 'number' && Number.isFinite(rawMonth)) {
      return rawMonth;
    }

    const parsed = Number.parseInt(rawMonth as string, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      return parsed;
    }

    const monthName = rawMonthName ? String(rawMonthName).trim() : null;
    if (monthName) {
      const index = this.monthNamesLower.indexOf(monthName.toLowerCase());
      if (index !== -1) return index + 1;
    }

    if (startDate) {
      const date = new Date(startDate);
      if (!Number.isNaN(date.getTime())) return date.getUTCMonth() + 1;
    }

    return null;
  }

  private resolveYear(rawYear: unknown, startDate: string | null): string | null {
    if (rawYear !== undefined && rawYear !== null) {
      const text = String(rawYear).trim();
      if (text.length) return text;
    }

    if (startDate) {
      const date = new Date(startDate);
      if (!Number.isNaN(date.getTime())) return String(date.getUTCFullYear());
    }

    return null;
  }
}
