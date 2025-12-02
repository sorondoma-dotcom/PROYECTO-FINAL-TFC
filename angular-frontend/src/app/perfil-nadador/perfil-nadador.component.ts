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
  private rankingKeyLoaded: string | null = null;
  private rankingInFlight = false;
  private readonly maxRecordEntries = 3;

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
    return this.canEditProfile && !this.accountUser?.avatarUrl;
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
    if (!this.canUploadAvatar) {
      this.openSnackBar('Ya tienes una foto de perfil asignada.');
      return;
    }

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
    this.avatarPreview = this.accountUser?.avatarUrl || null;
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
    this.avatarPreview = user?.avatarUrl || this.avatarPreview;

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

    if (this.accountUser.avatarUrl) {
      this.athlete.imageUrl = this.accountUser.avatarUrl;
      this.avatarPreview = this.accountUser.avatarUrl;
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
    return source.map((item: any) => {
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
        monthNumber: competition.monthNumber ?? null
      } as Competition;
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
    const filters = navState?.filters || {};

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

    console.log('✅ Atleta populado:', this.athlete);
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
    } else {
      this.loadSuggestedCalendar();
    }
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

        this.loadSuggestedCalendar();
      },
      error: () => {
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
      return this.profileRecords.slice(0, this.maxRecordEntries);
    }
    if (!Array.isArray(performances) || performances.length === 0) return [];

    const enriched = performances
      .map((p) => ({ ...p, value: this.parseTimeToSeconds(p.time) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity))
      .slice(0, this.maxRecordEntries)
      .map((p) => this.performanceToPersonalRecord(p, this.formatSeconds(p.value)));

    return enriched;
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
    if (!source) {
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
