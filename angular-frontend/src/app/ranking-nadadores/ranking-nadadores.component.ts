import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DatosService } from '../services/datos.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { ConfirmationService } from '../shared/services/confirmation.service';
import { ActivatedRoute, Router } from '@angular/router';

type Gender = 'M' | 'F';
type PoolConfiguration = 'LCM' | 'SCM';
type Stroke =
  | 'BACKSTROKE'
  | 'BREASTSTROKE'
  | 'BUTTERFLY'
  | 'MEDLEY'
  | 'FREESTYLE'
  | 'FREESTYLE_RELAY'
  | 'MEDLEY_RELAY';

interface RankingFilters {
  gender: Gender;
  distance: string;
  stroke: Stroke;
  poolConfiguration: PoolConfiguration;
  limit?: number;
  offset?: number;
  year?: string;
  startDate?: string;
  endDate?: string;
}

interface RankingEntry {
  id?: number;
  overallRank: number;
  country: string;
  name: string;
  age?: number;
  time: string;
  points?: number;
  tag?: string;
  recordTag?: string;
  competition?: string;
  location?: string;
  date?: string;
  profileUrl?: string;
  imageUrl?: string;
  poolConfiguration?: PoolConfiguration;
  stroke?: Stroke;
  distance?: number | string;
  gender?: Gender;
  athleteId?: number;
}

@Component({
  selector: 'app-ranking-nadadores',
  standalone: true,
  templateUrl: './ranking-nadadores.component.html',
  imports: [
    CommonModule,
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
  // Formulario reactivo
  rankingForm!: FormGroup;

  // datos
  nadadores: RankingEntry[] = [];
  loading = false;
  error: string | null = null;

  // Paginacion
  currentLimit = 20; // Empezar con 20 registros
  totalAvailable = 0; // Total de registros disponibles en cache/backend
  cachedLimit = 0; // Limite maximo cacheado

  // Expresiones regulares para validaciones
  private readonly GENDER_REGEX = /^[MF]$/;
  private readonly DISTANCE_REGEX = /^(50|100|200|400|800|1500)$/;
  private readonly STROKE_REGEX = /^(BACKSTROKE|BREASTSTROKE|BUTTERFLY|MEDLEY|FREESTYLE|FREESTYLE_RELAY|MEDLEY_RELAY)$/;
  private readonly POOL_REGEX = /^(LCM|SCM)$/

  // opciones minimas para selects
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
  selectedTimeline: { name: string; times: RankingEntry[] } | null = null;
  formSubmitted = false;

  constructor(
    private datosService: DatosService,
    private dialog: MatDialog,
    private active: ActivatedRoute,
    private confirmation: ConfirmationService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    if (this.active) {
      this.active.queryParams.subscribe((params: any) => {
        this.applyQueryParams(params);
        this.cargarRankings();
      });
    } else {
      this.cargarRankings();
    }
  }

  cargarRankings(incremental: boolean = false): void {
    if (this.loading) return; // Evita llamadas simultaneas
    this.loading = true;
    this.error = null;

    if (!incremental) {
      this.nadadores = [];
    }

    const filters = this.buildFilters();
    this.datosService
      .getRankings(filters)
      .subscribe({
        next: (res) => this.handleRankingsResponse(res),
        error: (err) => this.handleRankingsError(err),
      });
  }

  private applyQueryParams(params: any): void {
    if (!params) return;

    const updates: Partial<RankingFilters> = {};
    if (params['gender'] && this.GENDER_REGEX.test(params['gender'])) {
      updates.gender = params['gender'];
    }
    if (params['distance'] && this.DISTANCE_REGEX.test(params['distance'])) {
      updates.distance = params['distance'];
    }
    if (params['stroke'] && this.STROKE_REGEX.test(params['stroke'])) {
      updates.stroke = params['stroke'];
    }
    if (params['poolConfiguration'] && this.POOL_REGEX.test(params['poolConfiguration'])) {
      updates.poolConfiguration = params['poolConfiguration'];
    }

    if (Object.keys(updates).length > 0) {
      this.rankingForm.patchValue(updates, { emitEvent: false });
    }
  }

  private buildFilters(): RankingFilters {
    const formValues = this.rankingForm.value;
    return {
      gender: formValues.gender,
      distance: formValues.distance,
      stroke: formValues.stroke,
      poolConfiguration: formValues.poolConfiguration,
      limit: this.currentLimit,
    };
  }

  private handleRankingsResponse(res: any): void {
    const datos = this.mapRankingsResponse(res);
    this.nadadores = datos;

    this.totalAvailable = res?.total ?? datos.length;
    this.cachedLimit = res?.cachedLimit ?? this.totalAvailable;

    this.loading = false;
  }

  private handleRankingsError(err: any): void {
    this.error = err?.error?.error || err?.message || 'Error al obtener rankings';
    this.loading = false;
  }

  private mapRankingsResponse(res: any): RankingEntry[] {
    const base = Array.isArray(res)
      ? res
      : Array.isArray(res?.rankings)
        ? res.rankings
        : Array.isArray(res?.data)
          ? res.data
          : [];

    return base.map((item: any) => ({
      id: item?.id ?? null,
      gender: item?.gender ?? this.rankingForm.value.gender,
      distance: item?.distance ?? this.rankingForm.value.distance,
      stroke: item?.stroke ?? this.rankingForm.value.stroke,
      poolConfiguration: item?.poolConfiguration ?? this.rankingForm.value.poolConfiguration,
      overallRank: Number(item?.overallRank ?? item?.rank ?? 0),
      country: item?.country ?? item?.countryCode ?? '',
      name: item?.name ?? item?.athleteName ?? '',
      age: item?.age ?? null,
      time: item?.time ?? item?.timeText ?? '',
      points: item?.points ?? null,
      tag: item?.tag ?? null,
      recordTag: item?.recordTag ?? null,
      competition: item?.competition ?? '',
      location: item?.location ?? item?.locationCountryCode ?? '',
      date: item?.date ?? item?.raceDate ?? '',
      profileUrl: item?.profileUrl ?? item?.athleteProfileUrl ?? '',
      imageUrl: item?.imageUrl ?? '',
      athleteId: item?.athleteId ?? item?.athlete_id ?? null,
    }));
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.formSubmitted = true;

    // Marcar todos los campos como tocados para mostrar errores
    Object.keys(this.rankingForm.controls).forEach(key => {
      this.rankingForm.get(key)?.markAsTouched();
    });

    if (!this.rankingForm.valid) {
      this.error = 'Por favor corrige los errores en el formulario antes de continuar.';
      return;
    }

    this.error = null;
    // Resetear limite al buscar nuevos filtros
    this.currentLimit = 20;

    this.confirmation
      .confirm({
        title: 'Actualizar rankings',
        message: 'Se consultara la API con los filtros seleccionados. Deseas continuar?',
        confirmText: 'Actualizar',
        confirmColor: 'primary'
      })
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.cargarRankings();
        }
      });
  }

  /**
   * Carga mas registros incrementando el limite
   */
  cargarMasRegistros(): void {
    if (this.loading) return;

    // Incrementar en pasos de 20
    this.currentLimit += 20;

    console.log(`Cargando mas registros. Nuevo limite: ${this.currentLimit}`);

    // Recargar con el nuevo limite
    this.cargarRankings(true);
  }

  /**
   * Verifica si hay mas registros disponibles para cargar
   */
  get hayMasRegistros(): boolean {
    return this.nadadores.length < this.cachedLimit;
  }

  /**
   * Obtiene el texto informativo de registros cargados
   */
  get textoRegistrosCargados(): string {
    return `Mostrando ${this.nadadores.length} de ${this.cachedLimit} registros`;
  }

  /**
   * Inicializa el formulario reactivo con validaciones mediante expresiones regulares
   */
  private initForm(): void {
    this.rankingForm = this.fb.group({
      gender: ['F', [Validators.required, Validators.pattern(this.GENDER_REGEX)]],
      distance: ['100', [Validators.required, Validators.pattern(this.DISTANCE_REGEX)]],
      stroke: ['BACKSTROKE', [Validators.required, Validators.pattern(this.STROKE_REGEX)]],
      poolConfiguration: ['LCM', [Validators.required, Validators.pattern(this.POOL_REGEX)]]
    });
  }

  /**
   * Obtiene el mensaje de error para un campo especifico del formulario
   * @param fieldName - Nombre del campo del formulario
   * @returns Mensaje de error descriptivo o cadena vacia si no hay error
   */
  getErrorMessage(fieldName: string): string {
    const control = this.rankingForm.get(fieldName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return `El campo ${this.getFieldLabel(fieldName)} es obligatorio`;
    }

    if (control.errors['pattern']) {
      return this.getPatternErrorMessage(fieldName);
    }

    if (control.errors['min']) {
      return `El valor minimo permitido es ${control.errors['min'].min}`;
    }

    if (control.errors['max']) {
      return `El valor maximo permitido es ${control.errors['max'].max}`;
    }

    return 'Error de validacion';
  }

  /**
   * Obtiene la etiqueta legible de un campo
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      gender: 'Sexo',
      distance: 'Distancia',
      stroke: 'Estilo',
      poolConfiguration: 'Configuracion de piscina'
    };
    return labels[fieldName] || fieldName;
  }

  /**
   * Obtiene el mensaje de error especifico para errores de patron (regex)
   */
  private getPatternErrorMessage(fieldName: string): string {
    switch (fieldName) {
      case 'gender':
        return 'El sexo debe ser M (Masculino) o F (Femenino)';
      case 'distance':
        return 'La distancia debe ser: 50, 100, 200, 400, 800 o 1500 metros';
      case 'stroke':
        return 'El estilo seleccionado no es valido';
      case 'poolConfiguration':
        return 'La configuracion debe ser LCM (50m) o SCM (25m)';
      default:
        return 'El formato del campo no es valido';
    }
  }

  /**
   * Verifica si un campo tiene error y ha sido tocado
   */
  hasError(fieldName: string): boolean {
    const control = this.rankingForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
  verTimeline(nadador: RankingEntry) {
    const tiempos = this.nadadores.filter((nd) => nd.name === nadador.name);
    // Abrir dialogo con el componente TimelineChartComponent
    this.dialog.open(TimelineChartComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        name: nadador.name,
        times: tiempos,
      },
      // los componentes standalone pueden necesitar que el dialogo los trate como componentes normales
    });
  }

  // Para cerrar el timeline
  cerrarTimeline() {
    this.selectedTimeline = null;
  }

  get filteredStrokes() {
    const dist = Number(this.rankingForm?.get('distance')?.value || '100');
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

  onImageError(event: Event) {
    // Si la imagen falla al cargar, ocultarla
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  verPerfil(nadador: RankingEntry) {
    const filters = this.rankingForm?.value || {};
    const nameParam = encodeURIComponent(nadador?.name || '');
    const profileUrl = nadador?.profileUrl || '';
    const imageUrl = nadador?.imageUrl || '';
    this.router.navigate(['/nadadores', 'perfil', nameParam], {
      queryParams: {
        country: nadador?.country,
        imageUrl,
        profileUrl,
        age: nadador?.age,
        gender: filters.gender,
        distance: filters.distance,
        stroke: filters.stroke,
        pool: filters.poolConfiguration,
        points: nadador?.points,
        athleteId: nadador?.athleteId || null
      },
      state: {
        performer: {
          ...nadador,
          athleteId: nadador?.athleteId || null
        },
        filters,
        rankingData: this.nadadores,
        selectedRankingEntry: nadador
      }
    });
  }
}

