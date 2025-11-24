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
import { ActivatedRoute, Route } from '@angular/router';

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
  nadadores: any[] = [];
  loading = false;
  error: string | null = null;
  datosDashboard: any

  // Paginación
  currentLimit = 20; // Empezar con 20 registros
  totalAvailable = 0; // Total de registros disponibles en cache/backend
  cachedLimit = 0; // Límite máximo cacheado

  // Expresiones regulares para validaciones
  private readonly GENDER_REGEX = /^[MF]$/;
  private readonly DISTANCE_REGEX = /^(50|100|200|400|800|1500)$/;
  private readonly STROKE_REGEX = /^(BACKSTROKE|BREASTSTROKE|BUTTERFLY|MEDLEY|FREESTYLE|FREESTYLE_RELAY|MEDLEY_RELAY)$/;
  private readonly POOL_REGEX = /^(LCM|SCM)$/

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
  formSubmitted = false;

  constructor(
    private datosService: DatosService,
    private dialog: MatDialog,
    private active: ActivatedRoute,
    private confirmation: ConfirmationService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarRankings();
    if (this.active) {
    this.active.queryParams.subscribe((params:any) => {
      if (params['gender']) this.rankingForm.patchValue({ gender: params['gender'] });
      if (params['distance']) this.rankingForm.patchValue({ distance: params['distance'] });
      if (params['stroke']) this.rankingForm.patchValue({ stroke: params['stroke'] });
      if (params['poolConfiguration']) this.rankingForm.patchValue({ poolConfiguration: params['poolConfiguration'] });

      const formValues = this.rankingForm.value;
      this.datosService.getRankings({
        gender: formValues.gender,
        distance: formValues.distance,
        stroke: formValues.stroke,
        poolConfiguration: formValues.poolConfiguration,
        clearCache: false,
      }).subscribe({
        next: (res) => {
          console.log('Respuesta completa rankings desde queryParams:', res);
          const datos = res?.rankings ?? res?.data ?? [];
          this.nadadores = datos;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.message || 'Error al obtener rankings';
          this.loading = false;
        },
      });
     });
    }
  }

  cargarRankings(clearCache: boolean = false, incremental: boolean = false): void {
    if (this.loading) return; // Evita llamadas simultáneas
    this.loading = true;
    this.error = null;

    // Si no es incremental, resetear los nadadores
    if (!incremental) {
      this.nadadores = [];
    }

    const formValues = this.rankingForm.value;
    this.datosService
      .getRankings({
        gender: formValues.gender,
        distance: formValues.distance,
        stroke: formValues.stroke,
        poolConfiguration: formValues.poolConfiguration,
        limit: this.currentLimit,
        clearCache: clearCache,
      })
      .subscribe({
        next: (res) => {
          const datos = res?.rankings ?? res?.data ?? [];
          this.nadadores = datos;

          // Actualizar información de paginación
          this.totalAvailable = res?.total ?? datos.length;
          this.cachedLimit = res?.cachedLimit ?? this.totalAvailable;

          // Log para debugging
          const conImagen = this.nadadores.filter(n => n.imageUrl && n.imageUrl.length > 0).length;
          console.log('Primeros 3 nadadores:', this.nadadores.slice(0, 3));
          console.log(`📊 Mostrando ${this.nadadores.length} de ${this.cachedLimit} registros disponibles`);

          this.loading = false;
        },
        error: (err) => {
          this.error = err?.message || 'Error al obtener rankings';
          this.loading = false;
        },
      });
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
    // Resetear límite al buscar nuevos filtros
    this.currentLimit = 20;

    this.confirmation
      .confirm({
        title: 'Actualizar rankings',
        message: 'Se consultará la API con los filtros seleccionados. ¿Deseas continuar?',
        confirmText: 'Actualizar',
        confirmColor: 'primary'
      })
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.cargarRankings(false);
        }
      });
  }

  /**
   * Carga más registros incrementando el límite
   */
  cargarMasRegistros(): void {
    if (this.loading) return;

    // Incrementar en pasos de 20
    this.currentLimit += 20;

    console.log(`📈 Cargando más registros. Nuevo límite: ${this.currentLimit}`);

    // Recargar con el nuevo límite
    this.cargarRankings(false, true);
  }

  /**
   * Verifica si hay más registros disponibles para cargar
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
   * Obtiene el mensaje de error para un campo específico del formulario
   * @param fieldName - Nombre del campo del formulario
   * @returns Mensaje de error descriptivo o cadena vacía si no hay error
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
      return `El valor mínimo permitido es ${control.errors['min'].min}`;
    }

    if (control.errors['max']) {
      return `El valor máximo permitido es ${control.errors['max'].max}`;
    }

    return 'Error de validación';
  }

  /**
   * Obtiene la etiqueta legible de un campo
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      gender: 'Sexo',
      distance: 'Distancia',
      stroke: 'Estilo',
      poolConfiguration: 'Configuración de piscina'
    };
    return labels[fieldName] || fieldName;
  }

  /**
   * Obtiene el mensaje de error específico para errores de patrón (regex)
   */
  private getPatternErrorMessage(fieldName: string): string {
    switch (fieldName) {
      case 'gender':
        return 'El sexo debe ser M (Masculino) o F (Femenino)';
      case 'distance':
        return 'La distancia debe ser: 50, 100, 200, 400, 800 o 1500 metros';
      case 'stroke':
        return 'El estilo seleccionado no es válido';
      case 'poolConfiguration':
        return 'La configuración debe ser LCM (50m) o SCM (25m)';
      default:
        return 'El formato del campo no es válido';
    }
  }

  /**
   * Verifica si un campo tiene error y ha sido tocado
   */
  hasError(fieldName: string): boolean {
    const control = this.rankingForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
  verTimeline(nadador: any) {
    const tiempos = this.nadadores.filter((nd) => nd.name === nadador.name);
    // Abrir diÃ¡logo con el componente TimelineChartComponent
    this.dialog.open(TimelineChartComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        name: nadador.name,
        times: tiempos,
      },
      // los componentes standalone pueden necesitar que el diÃ¡logo los trate como componentes normales
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
}

