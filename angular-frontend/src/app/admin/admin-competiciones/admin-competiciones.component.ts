import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CompetitionService, Competition, Inscription } from '../../services/competition.service';
import { ProofService } from '../../services/proof.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ActionResultDialogComponent } from '../../shared/action-result-dialog/action-result-dialog.component';
import { ManageAthletesDialogComponent } from '../manage-athletes-dialog/manage-athletes-dialog.component';
import { EditCompetitionDialogComponent } from './edit-competition-dialog/edit-competition-dialog.component';
import { ManageProofsDialogComponent } from '../manage-proofs-dialog/manage-proofs-dialog.component';
import { ProofInscriptionDialogComponent } from '../proof-inscription-dialog/proof-inscription-dialog.component';

// Componente principal
@Component({
  selector: 'app-admin-competiciones',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './admin-competiciones.component.html',
  styleUrls: ['./admin-competiciones.component.scss']
})
export class AdminCompeticionesComponent implements OnInit, OnDestroy {
  // Estado
  loading = false;
  competiciones: Competition[] = [];
  selectedCompetition: Competition | null = null;
  inscripciones: Inscription[] = [];
  readonly logoBaseUrl = 'http://localhost/PROYECTO-FINAL-TFC/backend-php/auth-php/public';
  selectedTabIndex = 0;

  // Formularios
  competicionForm!: FormGroup;
  tomorrow: Date = new Date();
  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;
  logoError = '';
  logoDragActive = false;

  @ViewChild('logoInput') logoInput?: ElementRef<HTMLInputElement>;

  // Tablas
  displayedColumns: string[] = ['logo', 'id', 'nombre', 'fecha_inicio', 'pais', 'tipo_piscina', 'estado', 'total_inscritos', 'acciones'];
  displayedColumnsInscripciones: string[] = ['athlete_name', 'country_code', 'gender', 'numero_dorsal', 'estado_inscripcion', 'inscrito_en', 'acciones'];

  constructor(
    private fb: FormBuilder,
    private competitionService: CompetitionService,
    private proofService: ProofService,
    private confirmation: ConfirmationService,
    private dialog: MatDialog
  ) {
    this.initForm();
    const now = new Date();
    this.tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  ngOnInit(): void {
    this.loadCompeticiones();
  }

  private initForm(): void {
    // Regex patterns
    const nombrePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/; // solo letras, números y espacio
    const noSpecialCharsPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ,.()-]+$/; // común sin símbolos raros
    const paisPattern = /^(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3})$/; // 1 a 4 palabras
    const nonEmptyTextPattern = /^(?=.*\S).+$/; // al menos un carácter no vacío

    this.competicionForm = this.fb.group(
      {
        nombre: ['', [Validators.required, Validators.minLength(3), Validators.pattern(nombrePattern)]],
        descripcion: ['', [Validators.required, Validators.pattern(nonEmptyTextPattern)]],
        pais: ['', [Validators.required, Validators.pattern(paisPattern)]],
        ciudad: ['', [Validators.required, Validators.pattern(noSpecialCharsPattern)]],
        tipo_piscina: ['50m', Validators.required],
        fecha_inicio: ['', Validators.required],
        fecha_inicio_hora: ['', Validators.required],
        fecha_fin: ['', Validators.required],
        fecha_fin_hora: ['', Validators.required],
        lugar_evento: ['', [Validators.required, Validators.pattern(noSpecialCharsPattern)]],
        logo: [null, Validators.required]
      },
      { validators: [this.fechaInicioFuturoValidator(), this.fechaFinEnRangoValidator()] }
    );
  }

  ngOnDestroy(): void {
    this.revokeLogoPreview();
  }

  get maxFechaFin(): Date | null {
    const inicio = this.competicionForm?.get('fecha_inicio')?.value;
    if (!inicio) {
      return null;
    }

    const max = new Date(inicio);
    if (isNaN(max.getTime())) {
      return null;
    }
    max.setDate(max.getDate() + 7);
    return max;
  }

  loadCompeticiones(): void {
    this.loading = true;
    this.competitionService.getAllCompetitions().subscribe({
      next: (response) => {
        this.competiciones = response.competitions || [];
        this.ensureSelectedCompetition();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando competiciones:', error);
        this.loading = false;
      }
    });
  }

  crearCompeticion(): void {
    if (this.competicionForm.invalid) {
      this.competicionForm.markAllAsTouched();
      if (!this.logoFile) {
        this.logoError = 'Debes seleccionar un logo para la competición.';
      }
      return;
    }

    this.confirmation.confirm({
      title: 'Crear competición',
      message: `¿Deseas agendar la competición "${this.competicionForm.value.nombre}"?`,
      confirmText: 'Agendar',
      confirmColor: 'primary'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.loading = true;
        const payload = this.buildCompetitionPayload();

        this.competitionService.createCompetition(payload).subscribe({
        next: (response) => {
          this.loadCompeticiones();
            this.clearLogo();
            this.competicionForm.reset({ tipo_piscina: '50m', logo: null });
          this.loading = false;
          this.showActionResult('Se ha añadido la competición correctamente.', 'Competición añadida');
        },
        error: (error) => {
          console.error('Error creando competición:', error);
          this.loading = false;
        }
      });
    });
  }

  selectCompetition(competition: Competition, autoSwitchTab = true): void {
    this.selectedCompetition = competition;
    if (competition?.id) {
      this.loadInscripciones(competition.id);
    } else {
      this.inscripciones = [];
    }

    if (autoSwitchTab) {
      this.selectedTabIndex = 2;
    }
  }

  loadInscripciones(competicionId: number): void {
    this.competitionService.getCompetition(competicionId).subscribe({
      next: (response) => {
        this.inscripciones = response.inscriptions || [];
      },
      error: (error) => {
        console.error('Error cargando inscripciones:', error);
      }
    });
  }

  editarCompeticion(competition?: Competition, event?: Event): void {
    event?.stopPropagation();

    const target = competition ?? this.selectedCompetition;
    if (!target) return;

    const dialogRef = this.dialog.open(EditCompetitionDialogComponent, {
      data: { competition: target },
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.competitionService.updateCompetition(target.id!, result).subscribe({
          next: () => {
            this.loadCompeticiones();
            this.showActionResult('Se ha modificado la competición correctamente.', 'Competición actualizada', 'edit');
          },
          error: (error) => console.error('Error actualizando competición:', error)
        });
      }
    });
  }

  eliminarCompeticion(competition?: Competition, event?: Event): void {
    event?.stopPropagation();

    const target = competition ?? this.selectedCompetition;
    if (!target) return;

    this.confirmation.confirm({
      title: 'Eliminar competición',
      message: `¿Estás seguro de que deseas eliminar "${target.nombre}"?`,
      confirmText: 'Eliminar',
      confirmColor: 'warn'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.competitionService.deleteCompetition(target.id!).subscribe({
        next: () => {
          this.loadCompeticiones();
          if (this.selectedCompetition?.id === target.id) {
            this.selectedCompetition = null;
            this.inscripciones = [];
            this.selectedTabIndex = 1;
          }
          this.showActionResult('Se ha eliminado la competición correctamente.', 'Competición eliminada', 'delete');
        },
        error: (error) => console.error('Error eliminando competición:', error)
      });
    });
  }

  irAGestionAtletas(competition: Competition, event: Event): void {
    event.stopPropagation();
    this.selectCompetition(competition, true);
  }

  agregarAtletas(): void {
    if (!this.selectedCompetition) return;

    const dialogRef = this.dialog.open(ManageAthletesDialogComponent, {
      data: { competicion_id: this.selectedCompetition.id },
      width: '600px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInscripciones(this.selectedCompetition!.id!);
      }
    });
  }

  eliminarAtleta(inscripcion: Inscription): void {
    this.confirmation.confirm({
      title: 'Desinscribir atleta',
      message: `¿Deseas desinscribir a ${inscripcion.athlete_name}?`,
      confirmText: 'Desinscribir',
      confirmColor: 'warn'
    }).subscribe(confirmed => {
      if (!confirmed || !inscripcion.id) return;

      this.competitionService.unregisterAthlete(inscripcion.id).subscribe({
        next: () => {
          this.loadInscripciones(this.selectedCompetition!.id!);
        },
        error: (error) => console.error('Error desinscribiendo atleta:', error)
      });
    });
  }


  gestionarPruebas(): void {
    if (!this.selectedCompetition) return;

    const dialogRef = this.dialog.open(ManageProofsDialogComponent, {
      data: { competicion_id: this.selectedCompetition.id },
      width: '800px',
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe(() => {
      // Recargar datos si es necesario
    });
  }

  inscribirEnPrueba(): void {
    if (!this.selectedCompetition) return;

    // Obtener la prueba seleccionada - por ahora abrimos un diálogo para seleccionar
    this.proofService.getProofsByCompetition(this.selectedCompetition.id!).subscribe({
      next: (response: any) => {
        const proofs = response.proofs || [];

        if (proofs.length === 0) {
          this.confirmation.confirm({
            title: 'Sin pruebas',
            message: 'No hay pruebas creadas aún en esta competición. Crea pruebas primero.',
            confirmText: 'OK'
          }).subscribe();
          return;
        }

        // Si hay una prueba, abrir diálogo de inscripción
        // Por ahora usamos la primera prueba
        const proof = proofs[0];

        const dialogRef = this.dialog.open(ProofInscriptionDialogComponent, {
          data: {
            proof: proof,
            competicion_id: this.selectedCompetition!.id,
            competicionAthletes: this.inscripciones
          },
          width: '1000px',
          maxHeight: '90vh'
        });

        dialogRef.afterClosed().subscribe(() => {
          // Recargar inscripciones si es necesario
        });
      },
      error: (error) => console.error('Error loading proofs:', error)
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.competicionForm.get(fieldName);
    if (!control || !control.touched) return '';

    if (control.hasError('required')) return 'Campo requerido';
    if (control.hasError('minlength')) return `Mínimo ${control.getError('minlength').requiredLength} caracteres`;
    if (control.hasError('pattern')) {
      switch (fieldName) {
        case 'nombre':
          return 'Solo letras, números y espacios';
        case 'descripcion':
          return 'La descripción no puede estar vacía.';
        case 'pais':
          return 'Máximo 4 palabras, sin caracteres especiales';
        case 'ciudad':
        case 'lugar_evento':
          return 'Caracteres especiales no permitidos';
      }
      return 'Formato inválido';
    }
    if (fieldName === 'fecha_inicio' && this.competicionForm.hasError('fechaInicioNoFuturo')) {
      return 'La fecha de inicio debe ser posterior al día de hoy';
    }
    if (fieldName === 'fecha_fin' || fieldName === 'fecha_fin_hora') {
      if (this.competicionForm.hasError('fechaFinAntesInicio')) {
        return 'La fecha u hora de finalización debe ser posterior al inicio';
      }
      if (this.competicionForm.hasError('fechaFinFueraDeRango')) {
        return 'La competición no puede extenderse más de 7 días desde el inicio';
      }
    }

    return '';
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.logoDragActive = true;
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.logoDragActive = false;
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.logoDragActive = false;

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleLogoFile(file);
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleLogoFile(file);
    }
  }

  triggerLogoBrowser(): void {
    this.logoInput?.nativeElement.click();
  }

  removeLogo(event: Event): void {
    event.stopPropagation();
    this.clearLogo(true);
  }

  clearLogo(requireMessage = false): void {
    this.revokeLogoPreview();
    this.logoFile = null;
    this.logoPreviewUrl = null;
    this.logoError = requireMessage ? 'Debes seleccionar un logo para la competición.' : '';
    this.logoDragActive = false;
    const logoControl = this.competicionForm?.get('logo');
    logoControl?.setValue(null);
    if (requireMessage) {
      logoControl?.markAsTouched();
      logoControl?.markAsDirty();
    } else {
      logoControl?.markAsPristine();
      logoControl?.markAsUntouched();
    }
    if (this.logoInput) {
      this.logoInput.nativeElement.value = '';
    }
  }

  private handleLogoFile(file: File): void {
    if (!this.isValidLogoType(file.type)) {
      this.logoError = 'Solo se permiten imágenes PNG, JPG, WebP o SVG.';
      const control = this.competicionForm.get('logo');
      control?.markAsTouched();
      control?.markAsDirty();
      if (this.logoInput) {
        this.logoInput.nativeElement.value = '';
      }
      return;
    }

    if (file.size > this.getMaxLogoSize()) {
      this.logoError = 'El logo debe pesar menos de 5 MB.';
      const control = this.competicionForm.get('logo');
      control?.markAsTouched();
      control?.markAsDirty();
      if (this.logoInput) {
        this.logoInput.nativeElement.value = '';
      }
      return;
    }

    this.revokeLogoPreview();
    this.logoError = '';
    this.logoFile = file;
    this.logoPreviewUrl = URL.createObjectURL(file);
    const logoControl = this.competicionForm.get('logo');
    logoControl?.setValue(file);
    logoControl?.markAsDirty();
    logoControl?.markAsTouched();

    if (this.logoInput) {
      this.logoInput.nativeElement.value = '';
    }
  }

  private buildCompetitionPayload(): FormData {
    const data = new FormData();
    const raw = this.competicionForm.value;

    const nombre = (raw.nombre ?? '').toString().trim();
    data.append('nombre', nombre);

    const descripcion = raw.descripcion?.toString().trim();
    if (descripcion) {
      data.append('descripcion', descripcion);
    }
    const pais = raw.pais?.toString().trim();
    if (pais) {
      data.append('pais', pais);
    }
    const ciudad = raw.ciudad?.toString().trim();
    if (ciudad) {
      data.append('ciudad', ciudad);
    }

    data.append('tipo_piscina', raw.tipo_piscina ?? '50m');

    const fechaInicio = this.formatDateTime(raw.fecha_inicio, raw.fecha_inicio_hora);
    if (fechaInicio) {
      data.append('fecha_inicio', fechaInicio);
    }
    if (raw.fecha_inicio_hora) {
      data.append('fecha_inicio_hora', raw.fecha_inicio_hora);
    }

    const fechaFin = this.formatDateTime(raw.fecha_fin, raw.fecha_fin_hora);
    if (fechaFin) {
      data.append('fecha_fin', fechaFin);
    }
    if (raw.fecha_fin_hora) {
      data.append('fecha_fin_hora', raw.fecha_fin_hora);
    }

    const lugarEvento = raw.lugar_evento?.toString().trim();
    if (lugarEvento) {
      data.append('lugar_evento', lugarEvento);
    }

    if (this.logoFile) {
      data.append('logo', this.logoFile, this.logoFile.name);
    }

    return data;
  }

  private formatDateTime(dateValue: Date | string | null | undefined, timeValue: string | null | undefined): string | null {
    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(part => Number(part) || 0);
      date.setHours(hours, minutes, 0, 0);
    }

    return date.toISOString();
  }

  private revokeLogoPreview(): void {
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
      this.logoPreviewUrl = null;
    }
  }

  private isValidLogoType(mime: string): boolean {
    if (!mime) {
      return false;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    return allowed.includes(mime);
  }

  private getMaxLogoSize(): number {
    return 5 * 1024 * 1024; // 5 MB
  }

  // Validadores de fechas a nivel de formulario
  private fechaInicioFuturoValidator() {
    return (group: FormGroup) => {
      const inicio = group.get('fecha_inicio')?.value;
      if (!inicio) return null;

      const inicioDate = new Date(inicio);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const inicioDay = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
      const isFuture = inicioDay.getTime() > today.getTime();
      return isFuture ? null : { fechaInicioNoFuturo: true };
    };
  }

  private fechaFinEnRangoValidator() {
    return (group: FormGroup) => {
      const fechaInicio = group.get('fecha_inicio')?.value;
      const horaInicio = group.get('fecha_inicio_hora')?.value;
      const fechaFin = group.get('fecha_fin')?.value;
      const horaFin = group.get('fecha_fin_hora')?.value;

      if (!fechaInicio || !fechaFin) return null;

      const inicioDate = new Date(fechaInicio);
      const finDate = new Date(fechaFin);

      // Aplicar horas si están presentes (formato HH:mm)
      if (horaInicio) {
        const [h, m] = horaInicio.split(':').map(Number);
        inicioDate.setHours(h ?? 0, m ?? 0, 0, 0);
      } else {
        inicioDate.setHours(0, 0, 0, 0);
      }
      if (horaFin) {
        const [h, m] = horaFin.split(':').map(Number);
        finDate.setHours(h ?? 0, m ?? 0, 0, 0);
      } else {
        finDate.setHours(0, 0, 0, 0);
      }

      if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) return null;

      const errors: Record<string, boolean> = {};

      if (finDate.getTime() < inicioDate.getTime()) {
        errors['fechaFinAntesInicio'] = true;
      }

      const maxFin = new Date(inicioDate);
      maxFin.setDate(maxFin.getDate() + 7);

      if (finDate.getTime() > maxFin.getTime()) {
        errors['fechaFinFueraDeRango'] = true;
      }

      return Object.keys(errors).length ? errors : null;
    };
  }

  private ensureSelectedCompetition(): void {
    if (!this.competiciones.length) {
      this.selectedCompetition = null;
      this.inscripciones = [];
      return;
    }

    if (this.selectedCompetition) {
      const existing = this.competiciones.find(comp => comp.id === this.selectedCompetition?.id);
      if (existing) {
        this.selectCompetition(existing, false);
        return;
      }
    }

    const first = this.competiciones[0];
    this.selectCompetition(first, false);
  }

  private showActionResult(message: string, title?: string, icon?: string): void {
    this.dialog.open(ActionResultDialogComponent, {
      width: '360px',
      data: { message, title, icon }
    });
  }

  getCompetitionLogoUrl(comp: Competition): string | null {
    const candidate = comp.logo_url || comp.logo_path;
    if (!candidate) {
      return null;
    }

    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }

    const base = this.logoBaseUrl.replace(/\/$/, '');
    const normalizedPath = candidate.startsWith('/') ? candidate : `/${candidate}`;
    return `${base}${normalizedPath}`;
  }
}
