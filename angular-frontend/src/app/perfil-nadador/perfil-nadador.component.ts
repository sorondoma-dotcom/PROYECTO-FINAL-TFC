import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { finalize } from 'rxjs/operators';
import { DatosService } from '../services/datos.service';
import { Competition } from '../models/competition.interface';
import { AuthService } from '../services/auth.service';
import { RankingFilters } from '../models/filters/ranking-filters.interface';

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
  stroke?: string | null;
  course?: string | null;
  distance?: string | null;
  raw?: any;
}

interface AverageInfo {
  athleteBest: number | null;
  categoryAverage: number | null;
  diff: number | null;
}

interface ChartEventResult {
  raw: any;
  event: string;
  distance?: string | null;
  stroke?: string | null;
  pool?: 'LCM' | 'SCM' | null;
  timeValue: number;
  timeText: string;
  competition: string;
  date: string;
  country?: string;
}

interface ChartEventOption {
  key: string;
  label: string;
  entries: ChartEventResult[];
}

interface RankingComparisonRow {
  position: number | null;
  name: string;
  country?: string;
  timeText: string;
  diffSeconds: number | null;
  diffLabel: string;
  isTarget: boolean;
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './perfil-nadador.component.html',
  styleUrls: ['./perfil-nadador.component.scss']
})
export class PerfilNadadorComponent implements OnInit, OnDestroy {
  loading = true;
  loadingCompetitions = true;
  loadingBio = false;
  rankingError: string | null = null;
  competitionsError: string | null = null;
  viewingSelf = false;
  profileError: string | null = null;
  profileForm!: FormGroup;
  savingProfile = false;
  canEditProfile = false;
  accountUser: any = null;
  avatarPreview: string | null = null;
  selectedAvatar: File | null = null;
  private avatarObjectUrl: string | null = null;
  private initialProfile = { name: '', lastName: '' };

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
  eventOptions: ChartEventOption[] = [];
  selectedEventKey: string | null = null;
  bestPerformanceRecord: PersonalRecord | null = null;
  bestPerformanceSeconds: number | null = null;
  comparisonEventLabel: string | null = null;
  rankingComparisons: RankingComparisonRow[] = [];
  athleteComparisonRow: RankingComparisonRow | null = null;
  private rankingFiltersLocked = false;
  private rankingKeyLoaded: string | null = null;
  private rankingInFlight = false;
  private readonly maxRecordEntries = 3;
  private rankingFallbackEvent: Competition | null = null;

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
          label: (ctx:any) => `Tiempo: ${this.formatSeconds(Number(ctx.parsed.y))}`
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
          callback: (value:any) => this.formatSeconds(Number(value)),
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
    private datosService: DatosService,
    private authService: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const currentPath = this.route.snapshot.routeConfig?.path ?? '';
    this.viewingSelf = currentPath === 'mi-perfil/nadador';
    this.setupAccountContext();

    if (this.viewingSelf) {
      this.applyAccountDetailsToAthlete();
      this.loadSelfProfile();
      return;
    }

    this.populateFromRoute();
    // Agregar pequeño delay para asegurar que populateFromRoute se completó
    setTimeout(() => {
      this.loadAthleteBio();
      this.loadRankingData();
      this.loadDbResults();
      this.loadUpcomingCompetitions();
    }, 0);
  }

  ngOnDestroy(): void {
    this.releaseAvatarObjectUrl();
  }

  get canUploadAvatar(): boolean {
    return this.canEditProfile;
  }

  get canSubmitProfile(): boolean {
    if (!this.profileForm || this.savingProfile) {
      return false;
    }
    return this.profileForm.valid && this.isProfileDirty;
  }

  get isProfileDirty(): boolean {
    return this.hasProfileChanges() || !!this.selectedAvatar;
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files && input.files.length ? input.files[0] : null;

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.openSnackBar('Formato de imagen no permitido. Usa JPG, PNG o WebP.');
      input.value = '';
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      this.openSnackBar('La imagen no puede superar los 2 MB.');
      input.value = '';
      return;
    }

    this.releaseAvatarObjectUrl();
    this.selectedAvatar = file;
    this.profileError = null;
    this.avatarObjectUrl = URL.createObjectURL(file);
    this.avatarPreview = this.avatarObjectUrl;
    if (input) {
      input.value = '';
    }
  }

  clearSelectedAvatar(): void {
    this.selectedAvatar = null;
    this.profileError = null;
    this.releaseAvatarObjectUrl();
    this.avatarPreview = this.accountUser?.avatarLargeUrl || this.accountUser?.avatarUrl || null;
  }

  resetProfileForm(): void {
    if (!this.profileForm) {
      return;
    }

    this.profileForm.reset({
      name: this.initialProfile.name,
      lastName: this.initialProfile.lastName
    });
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
    this.clearSelectedAvatar();
  }

  submitProfile(): void {
    if (!this.canEditProfile || !this.profileForm || !this.canSubmitProfile) {
      return;
    }

    const formValue = this.profileForm.value;
    const currentName = (formValue.name ?? '').toString().trim();
    const currentLastName = (formValue.lastName ?? '').toString().trim();

    const payload: { name?: string; lastName?: string } = {};
    if (currentName !== (this.initialProfile.name ?? '').trim()) {
      payload.name = currentName;
    }
    if (currentLastName !== (this.initialProfile.lastName ?? '').trim()) {
      payload.lastName = currentLastName;
    }

    this.profileError = null;
    this.savingProfile = true;

    this.authService.updateProfile(payload, this.selectedAvatar).subscribe({
      next: (response) => {
        const updatedUser = response?.user ?? response;
        if (updatedUser) {
          this.accountUser = updatedUser;
          this.authService.updateCachedUser(updatedUser);
          this.initialProfile = {
            name: (updatedUser.name ?? '').trim(),
            lastName: (updatedUser.lastName ?? '').trim()
          };
          this.profileForm.patchValue(this.initialProfile, { emitEvent: false });
          this.profileForm.markAsPristine();
          this.profileForm.markAsUntouched();
          this.applyAccountDetailsToAthlete();
        }

        this.clearSelectedAvatar();
        this.savingProfile = false;
        this.openSnackBar('Perfil actualizado correctamente.');
      },
      error: (error) => {
        this.savingProfile = false;
        this.profileError = error?.error?.error || error?.message || 'No pudimos actualizar tu perfil.';
        this.openSnackBar(this.profileError ?? 'No pudimos actualizar tu perfil.', 'Cerrar');
      }
    });
  }

  private hasProfileChanges(): boolean {
    if (!this.profileForm) {
      return false;
    }

    const name = (this.profileForm.get('name')?.value ?? '').toString().trim();
    const lastName = (this.profileForm.get('lastName')?.value ?? '').toString().trim();
    return (
      name !== (this.initialProfile.name ?? '').trim() ||
      lastName !== (this.initialProfile.lastName ?? '').trim()
    );
  }

  private setupAccountContext(): void {
    const user = this.authService.currentUser();
    this.initProfileForm(user);
    this.applyUserCapabilities(user);

    if (!user) {
      this.authService.fetchCurrentUser().subscribe({
        next: (response) => {
          const fetchedUser = response?.user ?? response;
          this.refreshAccountUser(fetchedUser);
        },
        error: () => {
          /* Silenciar errores de refresco en contexto carga */
        }
      });
    }
  }

  private applyUserCapabilities(user: any | null): void {
    this.accountUser = user;
    const role = (user?.role ?? '').toString().toLowerCase();
    this.canEditProfile = ['usuario', 'user', 'nadador'].includes(role);
    this.avatarPreview = user?.avatarLargeUrl || user?.avatarUrl || this.avatarPreview;

    if (this.canEditProfile) {
      this.profileForm.enable({ emitEvent: false });
    } else {
      this.profileForm.disable({ emitEvent: false });
    }
  }

  private refreshAccountUser(user: any): void {
    if (!user) {
      return;
    }

    this.authService.updateCachedUser(user);
    this.initProfileForm(user);
    this.applyUserCapabilities(user);

    if (this.viewingSelf) {
      this.applyAccountDetailsToAthlete();
    }
  }

  private initProfileForm(user: any | null): void {
    this.initialProfile = {
      name: (user?.name ?? '').trim(),
      lastName: (user?.lastName ?? '').trim()
    };

    this.profileForm = this.fb.group({
      name: [
        this.initialProfile.name,
        [Validators.required, Validators.minLength(3), Validators.maxLength(80)]
      ],
      lastName: [
        this.initialProfile.lastName,
        [Validators.maxLength(80), (control: AbstractControl) => this.optionalLastNameValidator(control)]
      ]
    });
  }

  private optionalLastNameValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value ?? '').toString().trim();
    if (value === '') {
      return null;
    }
    if (value.length < 2) {
      return { minlength: true };
    }
    return null;
  }

  private applyAccountDetailsToAthlete(): void {
    if (!this.accountUser) {
      return;
    }

    const displayName = this.buildAccountDisplayName();
    if (displayName) {
      this.athlete.name = displayName;
    }

    if (this.accountUser.avatarUrl || this.accountUser.avatarLargeUrl) {
      const preferred = this.accountUser.avatarLargeUrl || this.accountUser.avatarUrl;
      if (preferred) {
        this.athlete.imageUrl = preferred;
        this.avatarPreview = preferred;
      }
    }
  }

  private buildAccountDisplayName(): string {
    const firstName = (this.accountUser?.name ?? '').trim();
    const lastName = (this.accountUser?.lastName ?? '').trim();
    return [firstName, lastName].filter(Boolean).join(' ').trim();
  }

  private releaseAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  private openSnackBar(message: string, action: string = 'Aceptar'): void {
    this.snackBar.open(message, action, {
      duration: 3500,
      horizontalPosition: 'end',
      verticalPosition: 'bottom'
    });
  }

  private loadSelfProfile(): void {
    this.rankingError = null;
    this.competitionsError = null;
    this.loadingCompetitions = true;

    if (!this.accountUser?.athleteId) {
      this.loading = false;
      this.loadingCompetitions = false;
      this.upcomingEvents = [];
      this.performances = [];
      this.records = [];
      this.profileRecords = [];
      this.averages = { athleteBest: null, categoryAverage: null, diff: null };
      this.applyAccountDetailsToAthlete();
      this.updateChart();
      return;
    }

    this.datosService.getCurrentAthleteProfile().subscribe({
      next: (res) => {
        const athlete = res?.athlete ?? {};
        this.athlete = {
          ...this.athlete,
          name: athlete.name || '',
          athleteId: athlete.athleteId ?? null,
          country: athlete.countryCode || '',
          nationality: athlete.countryCode || '',
          imageUrl: athlete.imageUrl || '',
          profileUrl: athlete.profileUrl || '',
          gender: athlete.gender || this.athlete.gender,
          age: typeof athlete.age === 'number' ? athlete.age : this.athlete.age
        };

        const schedule: any[] = Array.isArray(res?.upcomingCompetitions) ? res.upcomingCompetitions : [];
        this.upcomingEvents = this.mapUpcomingCompetitions(schedule);
        this.loadingCompetitions = false;

        this.applyAccountDetailsToAthlete();

        this.loadAthleteBio();
        this.loadRankingData();
        this.loadDbResults();
      },
      error: (err) => {
        this.loadingCompetitions = false;
        if (err?.status === 403) {
          this.router.navigate(['/']);
          return;
        }
        this.rankingError = err?.error?.error || 'No pudimos cargar tu perfil.';
      }
    });
  }

  private mapUpcomingCompetitions(schedule: any[]): Competition[] {
    const source = Array.isArray(schedule) ? schedule : [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return source
      .map((item: any) => {
        const competition = item?.competition ?? {};
        const name = competition.nombre || competition.name || '';
        const country = competition.pais || competition.country || '';
        const city = competition.ciudad || competition.city || '';
        const startDate = competition.fecha_inicio || item?.startDate || null;
        const endDate = competition.fecha_fin || item?.endDate || null;
        const pool = competition.tipo_piscina || item?.poolType || null;

        return {
          id: competition.id ?? item?.competitionId ?? null,
          competitionId: competition.id ?? item?.competitionId ?? null,
          nombre: name,
          name,
          stage: competition.stage ?? null,
          date: startDate,
          pais: country,
          countryCode: country,
          ciudad: city,
          city,
          fecha_inicio: startDate,
          startDate,
          fecha_fin: endDate,
          endDate,
          tipo_piscina: pool,
          poolName: pool,
          estado: competition.estado || item?.competitionStatus || null,
          status: item?.status || null,
          logo_path: competition.logo_path || item?.logoPath || null,
          logoPath: competition.logo_path || item?.logoPath || null,
          lugar_evento: competition.lugar_evento || item?.venue || null,
          flagImage: competition.flagImage ?? null,
          logo: competition.logo ?? null,
          url: competition.url ?? null,
          month: competition.month ?? null,
          year: competition.year ?? null,
          monthNumber: competition.monthNumber ?? null,
          _parsedStart: this.toDate(startDate || endDate)
        } as Competition & { _parsedStart?: Date | null };
      })
      .filter((comp: any) => {
        // Filtrar solo competiciones futuras o actuales
        const start = comp._parsedStart;
        return start && start >= startOfToday;
      })
      .sort((a: any, b: any) => {
        // Ordenar por fecha de inicio
        const timeA = a._parsedStart?.getTime() || 0;
        const timeB = b._parsedStart?.getTime() || 0;
        return timeA - timeB;
      });
  }

  populateFromRoute(): void {
    // Intentar obtener datos de getCurrentNavigation primero (para navegaciones recientes)
    let navState = this.router.getCurrentNavigation()?.extras.state as any;

    // Si no hay nav state, intentar obtener del navegador history
    if (!navState) {
      navState = (window.history.state) || {};
      console.log('📍 Usando window.history.state:', navState);
    }

    const params = this.route.snapshot.params;
    const query = this.route.snapshot.queryParams;

    const paramName = params['name'] ? decodeURIComponent(params['name']) : '';
    const stateAthlete = navState?.performer || {};
    const filters: Partial<RankingFilters> = navState?.filters || {};
    const selectedRankingEntry = navState?.selectedRankingEntry || null;
    this.prepareRankingFallbackEvent(selectedRankingEntry);

    console.log('📍 populateFromRoute - params:', params);
    console.log('📍 populateFromRoute - paramName:', paramName);
    console.log('📍 populateFromRoute - stateAthlete:', stateAthlete);
    console.log('📍 populateFromRoute - query params:', query);

    // Intentar obtener athleteId de query params o del state
    const athleteIdFromQuery = query['athleteId'] ? Number(query['athleteId']) : null;
    const athleteIdFromState = stateAthlete.athleteId ?? null;

    this.athlete = {
      ...this.athlete,
      name: paramName || stateAthlete.name || '',
      athleteId: athleteIdFromQuery || athleteIdFromState,
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

    const normalizedGender = this.normalizeGender(this.athlete.gender);
    if (normalizedGender) {
      this.athlete.gender = normalizedGender;
    }

    const sanitizedDistance = this.cleanDistance(this.athlete.distance);
    if (sanitizedDistance) {
      this.athlete.distance = sanitizedDistance;
    }

    const normalizedStroke = this.normalizeStrokeCode(this.athlete.stroke);
    if (normalizedStroke) {
      this.athlete.stroke = normalizedStroke;
    }

    const normalizedPool = this.normalizePoolCode(this.athlete.pool);
    if (normalizedPool) {
      this.athlete.pool = normalizedPool;
    }

    if ((filters.distance && filters.stroke && filters.poolConfiguration) || selectedRankingEntry) {
      this.rankingFiltersLocked = true;
    }

    const rankingSnapshot = Array.isArray(navState?.rankingData) ? navState.rankingData : null;
    if (rankingSnapshot?.length) {
      this.hydrateRankingFromSnapshot(rankingSnapshot, filters, selectedRankingEntry);
    } else if (selectedRankingEntry) {
      this.seedFromSelectedRankingEntry(selectedRankingEntry);
    }
  }

  private hydrateRankingFromSnapshot(entries: any[], filters?: Partial<RankingFilters>, selectedEntry?: any): void {
    if (!Array.isArray(entries) || !entries.length) {
      return;
    }
    if (filters || selectedEntry) {
      this.rankingFiltersLocked = true;
    }

    if (filters?.gender) {
      const normalizedGender = this.normalizeGender(filters.gender);
      if (normalizedGender) {
        this.athlete.gender = normalizedGender;
      }
    }
    if (filters?.distance) {
      const cleanDistance = this.cleanDistance(filters.distance);
      if (cleanDistance) {
        this.athlete.distance = cleanDistance;
      }
    }
    if (filters?.stroke) {
      const normalizedStroke = this.normalizeStrokeCode(filters.stroke);
      if (normalizedStroke) {
        this.athlete.stroke = normalizedStroke;
      }
    }
    if (filters?.poolConfiguration) {
      const normalizedPool = this.normalizePoolCode(filters.poolConfiguration);
      if (normalizedPool) {
        this.athlete.pool = normalizedPool;
      }
    }

    this.rankingData = entries;

    const normalizedName = this.normalize(this.athlete.name);
    const fallbackDistance = this.athlete.distance;
    const fallbackStroke = this.athlete.stroke;
    const fallbackPool = this.athlete.pool;

    this.performances = entries
      .filter((item: any) => this.normalize(item?.name) === normalizedName)
      .map((item: any) => ({
        ...item,
        distance: item?.distance ?? fallbackDistance,
        stroke: item?.stroke ?? fallbackStroke,
        poolConfiguration: item?.poolConfiguration ?? fallbackPool
      }));

    if (selectedEntry && this.performances.length === 0) {
      this.performances = [
        {
          ...selectedEntry,
          distance: selectedEntry.distance ?? fallbackDistance,
          stroke: selectedEntry.stroke ?? fallbackStroke,
          poolConfiguration: selectedEntry.poolConfiguration ?? fallbackPool
        }
      ];
    }

    if (!this.performances.length && entries.length) {
      const bestEntry = this.selectBestResult(entries);
      if (bestEntry) {
        this.performances = [
          {
            ...bestEntry,
            distance: bestEntry.distance ?? fallbackDistance,
            stroke: bestEntry.stroke ?? fallbackStroke,
            poolConfiguration: bestEntry.poolConfiguration ?? fallbackPool
          }
        ];
      }
    }

    this.records = this.buildRecords(this.performances);
    if (!this.profileRecords.length && this.records.length) {
      this.profileRecords = [...this.records];
    }
    if (!this.records.length && this.profileRecords.length) {
      this.records = this.profileRecords.slice(0, this.maxRecordEntries);
    }

    this.averages = this.buildAverages(entries, this.performances);
    this.updateBestPerformanceContext();
    this.updateRankingComparisons();
    this.updateChart();
  }

  private seedFromSelectedRankingEntry(entry: any): void {
    if (!entry) {
      return;
    }
    this.rankingFiltersLocked = true;

    const normalizedStroke = this.normalizeStrokeCode(entry.stroke) || this.athlete.stroke;
    const normalizedPool = this.normalizePoolCode(entry.poolConfiguration) || this.athlete.pool;
    const cleanDistance = this.cleanDistance(entry.distance) || this.athlete.distance;

    if (normalizedStroke) this.athlete.stroke = normalizedStroke;
    if (normalizedPool) this.athlete.pool = normalizedPool;
    if (cleanDistance) this.athlete.distance = cleanDistance;

    this.performances = [
      {
        ...entry,
        distance: cleanDistance,
        stroke: normalizedStroke,
        poolConfiguration: normalizedPool
      }
    ];

    this.records = this.buildRecords(this.performances);
    if (!this.records.length) {
      const formatted = this.performanceToPersonalRecord(entry, entry.time || entry.timeText || entry.bestTime);
      this.records = formatted ? [formatted] : [];
    }

    this.updateBestPerformanceContext();
    this.averages = this.buildAverages(this.rankingData, this.performances);
    this.updateRankingComparisons();
    this.updateChart();
  }
  loadDbResults(): void {
    const athleteId = this.athlete.athleteId;
    const athleteName = this.athlete.name;

    console.log('🔍 loadDbResults - athleteId:', athleteId, '| athleteName:', athleteName);
    console.log('🔍 loadDbResults - full athlete:', this.athlete);

    // Si no tiene ID, intenta buscar por nombre
    if (!athleteId && !athleteName) {
      console.warn('⚠️ No se puede cargar resultados: athleteId y nombre están vacíos');
      return;
    }

    if (athleteId) {
      // Buscar por ID
      console.log('📊 Buscando resultados por ID:', athleteId);
      this.datosService.getAthleteResults(athleteId).subscribe({
        next: (res) => {
          const list = Array.isArray(res?.results) ? res.results : [];
          this.dbResults = list;
          console.log(`✅ ${list.length} resultados encontrados por ID`);
          console.log('📊 Respuesta completa:', res);
          this.processDatabaseResults(list);
        },
        error: (err) => {
          console.error('❌ Error al cargar resultados por ID:', err);
          console.error('❌ Error status:', err.status);
          console.error('❌ Error message:', err.message);
          this.dbResults = [];
          this.processDatabaseResults([]);
        }
      });
    } else if (athleteName) {
      // Buscar por nombre si no tiene ID
      console.log(`🔍 Buscando resultados para: ${athleteName}`);
      console.log(`🔍 Nombre codificado: ${encodeURIComponent(athleteName)}`);
      this.datosService.getAthleteResultsByName(athleteName).subscribe({
        next: (res) => {
          const list = Array.isArray(res?.results) ? res.results : [];
          this.dbResults = list;
          console.log(`✅ ${list.length} resultados encontrados para ${athleteName}`);
          console.log('📊 Respuesta completa:', res);
          this.processDatabaseResults(list);
        },
        error: (err) => {
          console.error('❌ Error al cargar resultados por nombre:', err);
          console.error('❌ Error status:', err.status);
          console.error('❌ Error message:', err.message);
          console.error('❌ Error headers:', err.headers);
          this.dbResults = [];
          this.processDatabaseResults([]);
        }
      });
    }
  }

  loadAthleteBio(): void {
    if (!this.athlete.name) return;
    this.loadingBio = true;
    const previousRankingKey = this.buildRankingKey();

    const listCall = this.datosService.getAthletes({
      name: this.athlete.name,
      gender: this.athlete.gender || undefined,
      discipline: 'SW'
    });

    listCall.subscribe({
      next: (res) => {
        let rankingKeyChanged = false;

        const normalizedGender = this.normalizeGender(
          res?.gender || res?.profileGender || res?.profile?.gender || res?.personalData?.gender
        );
        if (normalizedGender && normalizedGender !== this.athlete.gender) {
          this.athlete.gender = normalizedGender;
          rankingKeyChanged = true;
        }

        if (res?.bestResults && Array.isArray(res.bestResults)) {
          const mappedRecords = res.bestResults.map((r: any) => ({
            label: r.event,
            bestTime: r.time,
            competition: r.competition || '',
            date: r.date || '',
            location: r.compCountry || '',
            points: r.points ?? r.finaPoints ?? null,
            stroke: r.stroke || r.style || null,
            course: r.course || r.pool || r.courseCode || r.courseShort || null,
            distance: r.distance ? String(r.distance) : this.extractDistanceFromEvent(r.event),
            raw: r
          }));
          this.profileRecords = this.orderRecords(mappedRecords);
          if (res.profileImage) this.athlete.imageUrl = res.profileImage;
          if (res.nationality) this.athlete.nationality = res.nationality;
          if (res.birth) this.athlete.birth = res.birth;
          if (!this.athlete.age && res.birth) this.athlete.age = this.calculateAge(res.birth);
          this.athlete.medals = res.medals;

          const bestRecordRaw = this.selectBestResult(res.bestResults);
          if (bestRecordRaw) {
            rankingKeyChanged = this.applyEventFromSource(bestRecordRaw) || rankingKeyChanged;
          } else if (this.profileRecords.length) {
            rankingKeyChanged = this.applyEventFromSource(this.profileRecords[0]) || rankingKeyChanged;
          }
        } else {
          const list = Array.isArray(res?.atletas) ? res.atletas : [];
          const bestMatch = list.find((a: any) =>
            this.normalize(a.name) === this.normalize(this.athlete.name)
          ) || list[0];

          if (bestMatch) {
            this.athlete.birth = bestMatch.birth || this.athlete.birth;
            this.athlete.nationality = bestMatch.nationality || this.athlete.nationality;
            this.athlete.imageUrl = this.athlete.imageUrl || bestMatch.imageUrl;
            const matchGender = this.normalizeGender(bestMatch.gender || bestMatch.sex || bestMatch.genderShort);
            if (matchGender && matchGender !== this.athlete.gender) {
              this.athlete.gender = matchGender;
              rankingKeyChanged = true;
            }
            if (!this.athlete.age && bestMatch.birth) {
              this.athlete.age = this.calculateAge(bestMatch.birth);
            }

            const bestMatchRecord = bestMatch.bestResult || bestMatch.bestPerformance || bestMatch.events?.[0];
            if (bestMatchRecord) {
              rankingKeyChanged = this.applyEventFromSource(bestMatchRecord) || rankingKeyChanged;
            }
          }
        }

        const newRankingKey = this.buildRankingKey();
        if (rankingKeyChanged || newRankingKey !== previousRankingKey) {
          this.loadRankingData(true);
        }
        this.loadingBio = false;
      },
      error: () => {
        this.loadingBio = false;
      }
    });
  }

  loadRankingData(force = false): void {
    const gender = this.normalizeGender(this.athlete.gender);
    const distance = this.cleanDistance(this.athlete.distance);
    const stroke = this.normalizeStrokeCode(this.athlete.stroke);
    const pool = this.normalizePoolCode(this.athlete.pool);

    if (!gender || !distance || !stroke || !pool) {
      console.warn('⏸️ Omitiendo carga de rankings: faltan datos del evento', {
        gender,
        distance,
        stroke,
        pool
      });
      return;
    }

    const rankingKey = this.buildRankingKey();
    if (!force && rankingKey === this.rankingKeyLoaded && this.performances.length) {
      return;
    }

    this.loading = true;
    this.rankingError = null;
    this.rankingInFlight = true;

    this.datosService
      .getRankings({
        gender,
        distance,
        stroke,
        poolConfiguration: pool as 'LCM' | 'SCM',
        limit: 150
      })
      .pipe(
        finalize(() => {
          this.rankingInFlight = false;
          this.rankingKeyLoaded = rankingKey;
        })
      )
      .subscribe({
        next: (res) => {
          const datos = res?.rankings ?? res?.data ?? [];
          this.rankingData = datos;
          this.performances = datos
            .filter((d: any) => this.normalize(d.name) === this.normalize(this.athlete.name))
            .map((d: any) => ({
              ...d,
              stroke: this.normalizeStrokeCode(this.athlete.stroke) || this.athlete.stroke,
              distance,
              poolConfiguration: pool
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
    if (this.viewingSelf) {
      return;
    }

    if (this.athlete.athleteId) {
      this.loadUpcomingCompetitionsFromProfile(this.athlete.athleteId);
      return;
    }

    if (this.applyFallbackEventIfAvailable()) {
      return;
    }

    this.loadSuggestedCalendar();
  }

  private loadUpcomingCompetitionsFromProfile(athleteId: number): void {
    this.loadingCompetitions = true;
    this.competitionsError = null;

    this.datosService.getAthleteProfile(athleteId).subscribe({
      next: (response) => {
        if (response?.athlete) {
          this.mergeAthleteProfile(response.athlete);
        }

        const schedule: any[] = Array.isArray(response?.upcomingCompetitions) ? response.upcomingCompetitions : [];
        if (schedule.length) {
          this.upcomingEvents = this.mapUpcomingCompetitions(schedule);
          this.loadingCompetitions = false;
          return;
        }

        if (this.applyFallbackEventIfAvailable()) {
          return;
        }
        this.loadSuggestedCalendar();
      },
      error: () => {
        if (this.applyFallbackEventIfAvailable()) {
          return;
        }
        this.loadSuggestedCalendar();
      }
    });
  }

  private mergeAthleteProfile(athleteData: any): void {
    if (!athleteData) {
      return;
    }

    this.athlete = {
      ...this.athlete,
      athleteId: this.athlete.athleteId ?? athleteData.athleteId ?? athleteData.athlete_id ?? null,
      name: this.athlete.name || athleteData.name || athleteData.athlete_name || '',
      country: this.athlete.country || athleteData.countryCode || athleteData.country || '',
      nationality: this.athlete.nationality || athleteData.countryCode || '',
      imageUrl: this.athlete.imageUrl || athleteData.imageUrl || '',
      profileUrl: this.athlete.profileUrl || athleteData.profileUrl || '',
      gender: this.athlete.gender ?? athleteData.gender ?? null,
      age: this.athlete.age ?? (typeof athleteData.age === 'number' ? athleteData.age : null)
    };
  }

  private loadSuggestedCalendar(): void {
    this.loadingCompetitions = true;
    this.competitionsError = null;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    this.datosService
      .getWorldAquaticsCompetitions({
        group: 'FINA',
        discipline: 'SW',
        year: currentYear,
        month: currentMonth.toString(),
      })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res?.competitions) ? res.competitions : [];

          const normalizedCountry = (this.athlete.country || '').toUpperCase();
          const mapped = list
            .map((c: any) => ({
              ...c,
              start: this.toDate(c.startDate || c.date || c.endDate)
            }))
            .filter((c: any) => {
              if (!c.start) return false;
              // Filtrar solo eventos futuros (incluye hoy)
              const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              return c.start >= startOfToday;
            });

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

  private prepareRankingFallbackEvent(entry: any): void {
    if (!entry) {
      this.rankingFallbackEvent = null;
      return;
    }

    const eventName = entry.competition || entry.tag || entry.meet || entry.event || 'Competencia';
    const date = this.toDate(entry.date || entry.raceDate || entry.eventDate || entry.startDate || entry.endDate);
    const isoDate = date ? date.toISOString() : null;
    const country =
      entry.locationCountryCode || entry.countryCode || entry.country || entry.compCountryCode || '';
    const city = entry.city || entry.location || entry.compCity || '';
    const pool = entry.poolConfiguration || entry.poolLength || entry.pool || null;

    this.rankingFallbackEvent = {
      id: entry.competitionId ?? null,
      competitionId: entry.competitionId ?? null,
      nombre: eventName,
      name: eventName,
      date: isoDate,
      startDate: isoDate,
      endDate: isoDate,
      pais: country,
      countryCode: country,
      ciudad: city,
      city,
      stage: entry.stage ?? null,
      poolName: pool,
      tipo_piscina: pool,
      status: entry.status ?? entry.phase ?? null,
      flagImage: entry.flagImage ?? null,
      logo_path: entry.logoPath ?? null,
      logoPath: entry.logoPath ?? null,
      logo: entry.logo ?? null,
      url: entry.profileUrl ?? entry.eventUrl ?? null,
      month: date ? date.getMonth() + 1 : null,
      year: date ? date.getFullYear() : null,
      monthNumber: date ? date.getMonth() + 1 : null
    } as Competition;
  }

  private applyFallbackEventIfAvailable(): boolean {
    const fallback = this.rankingFallbackEvent;
    if (!fallback) {
      return false;
    }

    const start = this.toDate(fallback.startDate || fallback.date || fallback.endDate);
    const now = new Date();
    
    // Solo aplicar el fallback si la fecha es futura o actual
    if (!start || start < now) {
      return false;
    }

    this.upcomingEvents = [fallback];
    this.loadingCompetitions = false;
    this.competitionsError = null;
    return true;
  }

  buildRecords(performances: any[]): PersonalRecord[] {
    const hasPerformances = Array.isArray(performances) && performances.length > 0;
    if (!hasPerformances) {
      return this.profileRecords.slice(0, this.maxRecordEntries);
    }

    const enriched = performances
      .map((p) => ({ ...p, value: this.parseTimeToSeconds(p.time) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity))
      .slice(0, this.maxRecordEntries)
      .map((p) => this.performanceToPersonalRecord(p, this.formatSeconds(p.value)));

    return enriched;
  }

  buildAverages(dataset: any[], athletePerformances: any[]): AverageInfo {
    // Parsear todos los tiempos del dataset (ranking) a segundos
    const categoryTimes = (dataset || [])
      .map((d) => {
        const timeValue = d.time ?? d.bestTime ?? d.timeText ?? d.mark;
        return this.parseTimeToSeconds(timeValue);
      })
      .filter((v) => Number.isFinite(v) && v > 0);

    // Parsear todos los tiempos del atleta a segundos
    const athleteTimes = (athletePerformances || [])
      .map((p) => {
        const timeValue = p.time ?? p.bestTime ?? p.timeText ?? p.mark;
        return this.parseTimeToSeconds(timeValue);
      })
      .filter((v) => Number.isFinite(v) && v > 0);

    if (!categoryTimes.length || !athleteTimes.length) {
      return { athleteBest: null, categoryAverage: null, diff: null };
    }

    // Mejor tiempo del atleta (menor es mejor en natación)
    const athleteBest = Math.min(...athleteTimes);
    
    // Promedio de la categoría calculado en segundos
    const categoryAverage = categoryTimes.reduce((acc, v) => acc + v, 0) / categoryTimes.length;

    // Diferencia: negativo = más rápido que el promedio, positivo = más lento
    return {
      athleteBest,
      categoryAverage,
      diff: athleteBest - categoryAverage
    };
  }

  private updateBestPerformanceContext(): void {
    const primaryRecords = this.records.length ? this.records : this.profileRecords;
    if (primaryRecords.length) {
      this.bestPerformanceRecord = primaryRecords[0];
      const seconds = this.parseTimeToSeconds(this.bestPerformanceRecord.bestTime);
      this.bestPerformanceSeconds = Number.isFinite(seconds) ? seconds : null;
      this.comparisonEventLabel = this.buildComparisonEventLabel(this.bestPerformanceRecord);
    } else {
      this.bestPerformanceRecord = null;
      this.bestPerformanceSeconds = null;
      this.comparisonEventLabel = null;
    }
  }

  private buildComparisonEventLabel(record?: PersonalRecord | null): string | null {
    if (!record) {
      return null;
    }
    const distance = record.distance || this.athlete.distance;
    const stroke = record.stroke || this.athlete.stroke;
    const pool = record.course || this.athlete.pool;
    const parts: string[] = [];
    if (distance) {
      parts.push(`${distance}m`);
    }
    if (stroke) {
      parts.push(this.getStrokeLabel(this.normalizeStrokeCode(stroke) || stroke));
    }
    if (pool) {
      parts.push(pool);
    }
    return parts.length ? parts.join(' - ') : null;
  }

  private updateRankingComparisons(): void {
    if (!Array.isArray(this.rankingData) || !this.rankingData.length) {
      this.rankingComparisons = [];
      this.athleteComparisonRow = null;
      return;
    }

    const limit = 6;
    const rows: RankingComparisonRow[] = [];
    this.rankingData.slice(0, limit).forEach((entry: any, index: number) => {
      const mapped = this.mapComparisonRow(entry, index);
      if (mapped) {
        rows.push(mapped);
      }
    });

    const normalizedTarget = this.normalize(this.athlete.name);
    let athleteRow = rows.find((row) => row.isTarget) ?? null;

    if (!athleteRow) {
      const athleteEntries = this.rankingData.filter((entry: any) => this.normalize(entry?.name) === normalizedTarget);
      const bestEntry = this.selectBestResult(athleteEntries);
      const fallbackRow = this.mapComparisonRow(bestEntry);
      if (fallbackRow) {
        fallbackRow.isTarget = true;
        rows.push(fallbackRow);
        athleteRow = fallbackRow;
      }
    }

    rows.sort((a, b) => {
      const aPosition = a.position ?? Number.MAX_SAFE_INTEGER;
      const bPosition = b.position ?? Number.MAX_SAFE_INTEGER;
      return aPosition - bPosition;
    });

    this.rankingComparisons = rows;
    this.athleteComparisonRow = athleteRow;
  }

  private mapComparisonRow(entry: any, fallbackIndex?: number): RankingComparisonRow | null {
    if (!entry) {
      return null;
    }

    const positionSource = entry?.overallRank ?? entry?.rank ?? entry?.position ?? null;
    const rawTime = entry?.time ?? entry?.bestTime ?? entry?.timeText ?? entry?.mark ?? entry?.result ?? '';
    const parsedSeconds = this.parseTimeToSeconds(rawTime);
    const timeSeconds = Number.isFinite(parsedSeconds) ? parsedSeconds : null;
    const diffSeconds =
      this.bestPerformanceSeconds != null && timeSeconds !== null
        ? timeSeconds - this.bestPerformanceSeconds
        : null;

    return {
      position:
        positionSource != null && !Number.isNaN(Number(positionSource)) && Number(positionSource) > 0
          ? Number(positionSource)
          : fallbackIndex != null
            ? fallbackIndex + 1
            : null,
      name: entry?.name ?? entry?.athleteName ?? 'Nadador',
      country: entry?.country ?? entry?.countryCode ?? entry?.locationCountryCode ?? '',
      timeText: rawTime || (timeSeconds !== null ? this.formatSeconds(timeSeconds) : '-'),
      diffSeconds,
      diffLabel: diffSeconds === null ? '-' : `${diffSeconds > 0 ? '+' : ''}${this.formatSeconds(Math.abs(diffSeconds))}`,
      isTarget: this.normalize(entry?.name ?? '') === this.normalize(this.athlete.name)
    };
  }

  updateChart(): void {
    let sourceType: 'database' | 'performances' | 'records' = 'records';
    let source: any[] = [];

    const selectedGroup = this.getSelectedEventGroup();
    if (selectedGroup && selectedGroup.entries.length) {
      sourceType = 'database';
      source = selectedGroup.entries;
    } else if (Array.isArray(this.performances) && this.performances.length > 0) {
      sourceType = 'performances';
      source = this.performances;
    } else {
      source = this.profileRecords;
    }

    if (!source || source.length === 0) {
      this.lineChartData = { labels: [], datasets: [{ ...this.lineChartData.datasets[0], data: [] }] };
      return;
    }

    const sorted = [...source]
      .map((entry) => {
        if (sourceType === 'database') {
          const dbEntry = entry as ChartEventResult;
          const label = `${dbEntry.competition || 'Competencia'} - ${this.formatDateLabel(dbEntry.date || '')}`;
          return {
            timeValue: dbEntry.timeValue,
            date: this.toDate(dbEntry.date),
            label
          };
        }

        if (sourceType === 'performances') {
          const timeValue = this.parseTimeToSeconds((entry as any).time);
          const rawDate = (entry as any).date;
          return {
            timeValue,
            date: this.toDate(rawDate),
            label: this.buildLabel(entry)
          };
        }

        const record = entry as PersonalRecord;
        const timeValue = this.parseTimeToSeconds(record.bestTime);
        const rawDate = record.date;
        const date = this.toDate(rawDate);
        const competition = record.competition || record.label;
        const label = `${competition} - ${this.formatDateLabel(rawDate || '')}`;
        return { timeValue, date, label };
      })
      .filter((item) => Number.isFinite(item.timeValue))
      .sort((a, b) => {
        if (a.date && b.date) return a.date.getTime() - b.date.getTime();
        return (a.timeValue || 0) - (b.timeValue || 0);
      });

    const labels = sorted.map((item) => item.label);
    const data = sorted.map((item) => item.timeValue as number);

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

  onEventSelected(optionKey: string | null): void {
    this.selectedEventKey = optionKey;
    this.updateChart();
  }

  private selectBestResult(records: any[]): any | null {
    if (!Array.isArray(records) || records.length === 0) {
      return null;
    }

    let bestRecord: any | null = null;
    let bestValue = Number.POSITIVE_INFINITY;
    records.forEach((record) => {
      const candidate = this.parseTimeToSeconds(record?.time || record?.bestTime || record?.mark);
      if (!Number.isFinite(candidate)) {
        return;
      }
      if (candidate < bestValue) {
        bestValue = candidate;
        bestRecord = record;
      }
    });

    return bestRecord;
  }

  private applyEventFromSource(source: any): boolean {
    if (!source || this.rankingFiltersLocked) {
      return false;
    }

    const previousKey = this.buildRankingKey();
    const details = this.extractEventDetails(source);
    let changed = false;

    const currentDistance = this.cleanDistance(this.athlete.distance);
    if (details.distance && details.distance !== currentDistance) {
      this.athlete.distance = details.distance;
      changed = true;
    }

    const currentStroke = this.normalizeStrokeCode(this.athlete.stroke);
    if (details.stroke && details.stroke !== currentStroke) {
      this.athlete.stroke = details.stroke;
      changed = true;
    }

    const currentPool = this.normalizePoolCode(this.athlete.pool);
    if (details.pool && details.pool !== currentPool) {
      this.athlete.pool = details.pool;
      changed = true;
    }

    const newKey = this.buildRankingKey();
    return changed || newKey !== previousKey;
  }

  private extractEventDetails(source: any): {
    distance?: string;
    stroke?: string;
    pool?: 'LCM' | 'SCM' | null;
  } {
    const eventName = source?.event || source?.label || source?.name || source?.description || '';
    const distanceFromField = this.cleanDistance(
      source?.distance ?? source?.eventDistance ?? source?.length ?? source?.meters
    );
    const distanceFromEvent = this.extractDistanceFromEvent(eventName);
    const strokeCandidate =
      source?.stroke ||
      source?.style ||
      source?.discipline ||
      source?.eventStroke ||
      source?.strokeName ||
      eventName;
    const poolCandidate =
      source?.course ||
      source?.pool ||
      source?.poolType ||
      source?.courseCode ||
      source?.courseShort ||
      source?.courseName ||
      source?.poolConfiguration ||
      source?.compCourse ||
      source?.courseAbbrev;

    return {
      distance: distanceFromField || distanceFromEvent || undefined,
      stroke: this.normalizeStrokeCode(strokeCandidate) || undefined,
      pool: this.normalizePoolCode(poolCandidate)
    };
  }

  private buildRankingKey(): string {
    const gender = this.normalizeGender(this.athlete.gender) ?? '';
    const distance = this.cleanDistance(this.athlete.distance) ?? '';
    const stroke = this.normalizeStrokeCode(this.athlete.stroke) ?? '';
    const pool = this.normalizePoolCode(this.athlete.pool) ?? '';
    return [gender, distance, stroke, pool].join('|');
  }

  private processDatabaseResults(results: any[]): void {
    if (!Array.isArray(results) || results.length === 0) {
      this.eventOptions = [];
      this.selectedEventKey = null;
      this.updateChart();
      return;
    }

    const enriched: ChartEventResult[] = results
      .map((raw) => {
        const timeText = raw?.timeText ?? raw?.time_text ?? '';
        const timeValue = this.parseTimeToSeconds(timeText);
        const event = raw?.event ?? '';
        const poolSource = raw?.poolLength ?? raw?.pool_length ?? null;
        const distance = this.cleanDistance(raw?.distance ?? event);
        const stroke = this.normalizeStrokeCode(raw?.stroke ?? event);
        const pool = this.normalizePoolCode(poolSource);
        return {
          raw,
          timeValue,
          timeText,
          event,
          distance,
          stroke,
          pool,
          competition: raw?.competition ?? '',
          date: raw?.raceDate ?? raw?.race_date ?? '',
          country: raw?.compCountryCode ?? raw?.comp_country_code ?? ''
        } as ChartEventResult;
      })
      .filter((entry) => Number.isFinite(entry.timeValue));

    if (!enriched.length) {
      this.eventOptions = [];
      this.selectedEventKey = null;
      this.updateChart();
      return;
    }

    this.eventOptions = this.buildEventOptions(enriched);
    this.ensureSelectedEventSelection();

    const bestEntry = [...enriched].sort((a, b) => (a.timeValue ?? Infinity) - (b.timeValue ?? Infinity))[0];
    const changed = this.applyEventFromSource({
      event: bestEntry.event,
      distance: bestEntry.distance,
      pool: bestEntry.pool,
      stroke: bestEntry.stroke
    });

    if (changed) {
      this.loadRankingData(true);
    }

    if (!this.profileRecords.length) {
      this.profileRecords = this.buildRecordsFromChartData(enriched);
    }

    this.updateChart();
  }

  private buildEventOptions(entries: ChartEventResult[]): ChartEventOption[] {
    if (!entries.length) {
      return [];
    }

    const groups = new Map<string, ChartEventOption>();

    entries.forEach((entry) => {
      const key = this.buildEventGroupKey(entry);
      const label = this.buildEventLabel(entry);
      const current = groups.get(key);
      if (current) {
        current.entries.push(entry);
      } else {
        groups.set(key, { key, label, entries: [entry] });
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.entries.length !== a.entries.length) {
        return b.entries.length - a.entries.length;
      }
      return a.label.localeCompare(b.label);
    });
  }

  private buildEventGroupKey(entry: ChartEventResult): string {
    const distance = entry.distance || '';
    const stroke = entry.stroke || '';
    const pool = entry.pool || '';
    return [distance, stroke, pool].join('|').toUpperCase();
  }

  private buildEventLabel(entry: ChartEventResult): string {
    const parts: string[] = [];
    if (entry.distance) {
      parts.push(`${entry.distance}m`);
    }
    if (entry.stroke) {
      parts.push(this.getStrokeLabel(entry.stroke));
    }
    if (entry.pool) {
      parts.push(entry.pool);
    }
    if (!parts.length) {
      return entry.event || 'Prueba';
    }
    return parts.join(' · ');
  }

  private getSelectedEventGroup(): ChartEventOption | null {
    if (!this.selectedEventKey) {
      return null;
    }
    return this.eventOptions.find((option) => option.key === this.selectedEventKey) ?? null;
  }

  private ensureSelectedEventSelection(): void {
    if (!this.eventOptions.length) {
      this.selectedEventKey = null;
      return;
    }
    if (this.selectedEventKey && this.eventOptions.some((option) => option.key === this.selectedEventKey)) {
      return;
    }
    const preferred = this.eventOptions.find((option) => option.entries.length > 1) ?? this.eventOptions[0];
    this.selectedEventKey = preferred?.key ?? null;
  }

  private buildFallbackEventLabel(distance?: string | null, stroke?: string | null): string {
    const distanceLabel = distance ? `${distance}m` : '';
    const strokeLabel = stroke ? this.getStrokeLabel(stroke) : '';
    return [distanceLabel, strokeLabel].filter(Boolean).join(' ').trim() || 'Mejor marca';
  }

  private buildRecordsFromChartData(entries: ChartEventResult[]): PersonalRecord[] {
    if (!entries.length) {
      return [];
    }

    return entries
      .filter((entry) => Number.isFinite(entry.timeValue))
      .sort((a, b) => (a.timeValue ?? Infinity) - (b.timeValue ?? Infinity))
      .slice(0, this.maxRecordEntries)
      .map((entry) => ({
        label: entry.event || this.buildFallbackEventLabel(entry.distance, entry.stroke),
        bestTime: entry.timeText || this.formatSeconds(entry.timeValue),
        competition: entry.competition,
        date: entry.date,
        location: entry.country || '',
        points: null,
        stroke: entry.stroke,
        course: entry.pool,
        distance: entry.distance,
        raw: entry.raw
      }));
  }

  private performanceToPersonalRecord(performance: any, formattedTime: string): PersonalRecord {
    const labelSource = performance.event || performance.label || performance.name || '';
    const normalizedStroke = this.normalizeStrokeCode(performance.stroke || performance.style) || null;
    const normalizedDistance =
      performance.distance ? String(performance.distance) : this.extractDistanceFromEvent(labelSource);
    const label = labelSource || this.buildFallbackEventLabel(normalizedDistance, normalizedStroke);

    return {
      label: label || `${this.athlete.distance}m ${this.getStrokeLabel(this.athlete.stroke)}`,
      bestTime: formattedTime,
      competition: performance.competition || performance.tag || performance.meet || '',
      date: performance.date || performance.eventDate || performance.raceDate || performance.updatedAt || '',
      location: performance.location || performance.city || performance.compCountry || performance.country || '',
      points: performance.points ?? performance.finaPoints ?? null,
      stroke: normalizedStroke,
      course: performance.poolConfiguration || performance.course || performance.pool || null,
      distance: normalizedDistance,
      raw: performance
    };
  }

  private orderRecords(records: PersonalRecord[]): PersonalRecord[] {
    if (!records.length) {
      return [];
    }

    return [...records]
      .sort((a, b) => {
        const aValue = this.parseTimeToSeconds(a.bestTime);
        const bValue = this.parseTimeToSeconds(b.bestTime);
        const safeA = Number.isFinite(aValue) ? aValue : Number.POSITIVE_INFINITY;
        const safeB = Number.isFinite(bValue) ? bValue : Number.POSITIVE_INFINITY;
        return safeA - safeB;
      })
      .slice(0, this.maxRecordEntries);
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
    // En natación: menor tiempo = mejor
    return diff < 0 ? 'Mejor que el promedio' : 'Peor que el promedio';
  }

  averageGapSeconds(): string {
    if (this.averages.diff === null) return '-';
    const sign = this.averages.diff > 0 ? '+' : '';
    return `${sign}${this.formatSeconds(Math.abs(this.averages.diff))}`;
  }

  get comparisonDiffSeconds(): number | null {
    if (!this.bestPerformanceRecord) {
      return null;
    }

    // Obtener el mejor tiempo del atleta en segundos
    const bestSeconds =
      this.bestPerformanceSeconds ??
      this.parseTimeToSeconds(this.bestPerformanceRecord.bestTime);
    
    if (!Number.isFinite(bestSeconds) || bestSeconds <= 0) {
      return null;
    }

    // Obtener todos los tiempos del ranking y convertirlos a segundos
    const datasetTimes = (this.rankingData || [])
      .map((entry: any) => {
        const timeValue = entry?.time ?? entry?.bestTime ?? entry?.timeText ?? entry?.mark;
        const parsed = this.parseTimeToSeconds(timeValue);
        return parsed;
      })
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!datasetTimes.length) {
      return null;
    }

    // Calcular el promedio del ranking en segundos
    const average =
      datasetTimes.reduce((sum, value) => sum + Number(value), 0) / datasetTimes.length;
    
    if (!Number.isFinite(average) || average <= 0) {
      return null;
    }

    // DEBUG: Log para verificar cálculos
    console.log('🔍 COMPARACIÓN DE PROMEDIO:');
    console.log('  Tiempo del atleta:', bestSeconds, 'segundos =', this.formatSeconds(bestSeconds));
    console.log('  Promedio del ranking:', average, 'segundos =', this.formatSeconds(average));
    console.log('  Diferencia:', bestSeconds - average, 'segundos');
    console.log('  Total de tiempos en ranking:', datasetTimes.length);
    console.log('  Primer tiempo del ranking:', datasetTimes[0], '=', this.formatSeconds(datasetTimes[0]));
    console.log('  Último tiempo del ranking:', datasetTimes[datasetTimes.length - 1], '=', this.formatSeconds(datasetTimes[datasetTimes.length - 1]));
    console.log('  Posición del atleta:', this.rankingData.findIndex((e: any) => 
      this.normalize(e?.name) === this.normalize(this.athlete.name)) + 1);

    // Retornar la diferencia: negativo = mejor que el promedio, positivo = peor que el promedio
    return Number(bestSeconds) - average;
  }

  get comparisonDiffLabel(): string {
    const diff = this.comparisonDiffSeconds;
    if (diff === null) {
      return 'Sin datos';
    }
    
    // En natación: menor tiempo = mejor rendimiento
    // diff < 0 = tiempo menor que el promedio = MEJOR (más rápido)
    // diff > 0 = tiempo mayor que el promedio = PEOR (más lento)
    const status = diff < 0 ? 'Mejor que el promedio' : 'Peor que el promedio';
    const formatted = this.formatSeconds(Math.abs(diff));
    const sign = diff > 0 ? '+' : '-';
    
    return `${status} · ${sign}${formatted}`;
  }

  progressValue(): number {
    if (this.averages.categoryAverage === null || this.averages.categoryAverage <= 0 || this.averages.diff === null) return 0;
    const percent = Math.abs(this.averages.diff) / this.averages.categoryAverage * 100;
    return Math.min(100, Math.max(0, percent));
  }

  parseTimeToSeconds(raw: any): number {
    if (!raw) return NaN;
    
    // Limpiar el string: eliminar marcas de récord (WR, OR, etc.) y caracteres no numéricos excepto : y .
    const s = String(raw)
      .replace(/WR/gi, '')
      .replace(/OR/gi, '')
      .replace(/NR/gi, '')
      .replace(/[^\d:.]/g, '')
      .trim();

    if (!s) return NaN;

    // Formato con dos puntos: mm:ss.ms o hh:mm:ss.ms
    if (s.includes(':')) {
      const parts = s.split(':').map((p) => p.trim());
      const nums = parts.map((p) => parseFloat(p)).filter((n) => Number.isFinite(n));
      
      // Formato mm:ss.ms (minutos:segundos)
      if (parts.length === 2 && nums.length === 2) {
        const minutes = nums[0] || 0;
        const seconds = nums[1] || 0;
        return minutes * 60 + seconds;
      }
      
      // Formato hh:mm:ss.ms (horas:minutos:segundos)
      if (parts.length === 3 && nums.length === 3) {
        const hours = nums[0] || 0;
        const minutes = nums[1] || 0;
        const seconds = nums[2] || 0;
        return hours * 3600 + minutes * 60 + seconds;
      }
    }

    // Formato simple: solo segundos (ej: 54.23)
    const numeric = parseFloat(s);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  formatSeconds(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    const total = Number(value);
    const minutes = Math.floor(total / 60);
    const seconds = total - minutes * 60;
    if (minutes > 0) {
      // Formato estándar de natación: MM:ss.ms
      return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
    }
    // Si es menos de 1 minuto, solo mostrar segundos
    return `${seconds.toFixed(2)}`;
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

  private cleanDistance(value: any): string | null {
    if (value == null) {
      return null;
    }
    const text = String(value).trim();
    const relayMatch = text.match(/\d\s*x\s*(\d{2,3})/i);
    if (relayMatch) {
      return relayMatch[1];
    }
    const matches = text.match(/(\d{2,4})/g);
    return matches ? matches[matches.length - 1] : null;
  }

  private normalizeStrokeCode(value: any): string | null {
    if (!value) {
      return null;
    }
    const text = String(value).toLowerCase();
    const map: Record<string, string> = {
      freestyle: 'FREESTYLE',
      free: 'FREESTYLE',
      libre: 'FREESTYLE',
      espalda: 'BACKSTROKE',
      backstroke: 'BACKSTROKE',
      back: 'BACKSTROKE',
      breaststroke: 'BREASTSTROKE',
      breast: 'BREASTSTROKE',
      braza: 'BREASTSTROKE',
      butterfly: 'BUTTERFLY',
      mariposa: 'BUTTERFLY',
      fly: 'BUTTERFLY',
      medley: 'MEDLEY',
      'individual medley': 'MEDLEY',
      'medley relay': 'MEDLEY_RELAY',
      'freestyle relay': 'FREESTYLE_RELAY',
      relay: 'FREESTYLE_RELAY'
    };

    const key = Object.keys(map).find((option) => text.includes(option));
    return key ? map[key] : String(value).toUpperCase();
  }

  private normalizePoolCode(value: any): 'LCM' | 'SCM' | null {
    if (!value) {
      return null;
    }
    const text = String(value).toUpperCase();
    if (text.includes('SC') || text.includes('25')) {
      return 'SCM';
    }
    if (text.includes('LC') || text.includes('50')) {
      return 'LCM';
    }
    return null;
  }

  private extractDistanceFromEvent(event: string | null | undefined): string | null {
    if (!event) {
      return null;
    }
    return this.cleanDistance(event);
  }

  private normalizeGender(value: any): 'M' | 'F' | null {
    if (!value) {
      return null;
    }
    const text = String(value).trim().toUpperCase();
    if (text.startsWith('M')) return 'M';
    if (text.startsWith('F')) return 'F';
    return null;
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



