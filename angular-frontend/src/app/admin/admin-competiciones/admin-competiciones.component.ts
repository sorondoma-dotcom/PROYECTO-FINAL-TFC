import { Component, OnInit, Inject } from '@angular/core';
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
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CompetitionService, Competition, Inscription } from '../../services/competition.service';
import { ProofService } from '../../services/proof.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
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
export class AdminCompeticionesComponent implements OnInit {
  // Estado
  loading = false;
  competiciones: Competition[] = [];
  selectedCompetition: Competition | null = null;
  inscripciones: Inscription[] = [];
  
  // Formularios
  competicionForm!: FormGroup;
  tomorrow: Date = new Date();
  
  // Tablas
  displayedColumns: string[] = ['id', 'nombre', 'fecha_inicio', 'pais', 'tipo_piscina', 'estado', 'total_inscritos', 'acciones'];
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

    this.competicionForm = this.fb.group(
      {
        nombre: ['', [Validators.required, Validators.minLength(3), Validators.pattern(nombrePattern)]],
        descripcion: [''],
        pais: ['', [Validators.pattern(paisPattern)]],
        ciudad: ['', [Validators.pattern(noSpecialCharsPattern)]],
        tipo_piscina: ['50m', Validators.required],
        fecha_inicio: ['', Validators.required],
        fecha_inicio_hora: ['', Validators.required],
        fecha_fin: [''],
        fecha_fin_hora: [''],
        lugar_evento: ['', [Validators.pattern(noSpecialCharsPattern)]]
      },
      { validators: [this.fechaInicioFuturoValidator(), this.fechaFinNoPosteriorHoraValidator()] }
    );
  }

  loadCompeticiones(): void {
    this.loading = true;
    this.competitionService.getAllCompetitions().subscribe({
      next: (response) => {
        this.competiciones = response.competitions || [];
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
      this.competitionService.createCompetition(this.competicionForm.value).subscribe({
        next: (response) => {
          this.loadCompeticiones();
          this.competicionForm.reset({ tipo_piscina: '50m' });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error creando competición:', error);
          this.loading = false;
        }
      });
    });
  }

  selectCompetition(competition: Competition): void {
    this.selectedCompetition = competition;
    if (competition.id) {
      this.loadInscripciones(competition.id);
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

  editarCompeticion(): void {
    if (!this.selectedCompetition) return;

    const dialogRef = this.dialog.open(EditCompetitionDialogComponent, {
      data: { competition: this.selectedCompetition },
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.competitionService.updateCompetition(this.selectedCompetition!.id!, result).subscribe({
          next: () => {
            this.loadCompeticiones();
            this.selectedCompetition = null;
          },
          error: (error) => console.error('Error actualizando competición:', error)
        });
      }
    });
  }

  eliminarCompeticion(): void {
    if (!this.selectedCompetition) return;

    this.confirmation.confirm({
      title: 'Eliminar competición',
      message: `¿Estás seguro de que deseas eliminar "${this.selectedCompetition.nombre}"?`,
      confirmText: 'Eliminar',
      confirmColor: 'warn'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.competitionService.deleteCompetition(this.selectedCompetition!.id!).subscribe({
        next: () => {
          this.loadCompeticiones();
          this.selectedCompetition = null;
          this.inscripciones = [];
        },
        error: (error) => console.error('Error eliminando competición:', error)
      });
    });
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

  cambiarEstadoInscripcion(inscripcion: Inscription): void {
    if (!inscripcion.id) return;

    const nuevoEstado = inscripcion.estado_inscripcion === 'confirmado' ? 'inscrito' : 'confirmado';

    this.competitionService.updateInscription(inscripcion.id, {
      estado_inscripcion: nuevoEstado as 'inscrito' | 'confirmado'
    }).subscribe({
      next: () => {
        this.loadInscripciones(this.selectedCompetition!.id!);
      },
      error: (error) => console.error('Error actualizando inscripción:', error)
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
    if ((fieldName === 'fecha_fin' || fieldName === 'fecha_fin_hora') && this.competicionForm.hasError('fechaFinPosterior')) {
      return 'La fecha/hora de finalización no puede ser posterior a la de inicio';
    }

    return '';
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

  private fechaFinNoPosteriorHoraValidator() {
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

      // Regla: fin debe ser >= inicio; si fin < inicio => error
      return finDate.getTime() >= inicioDate.getTime() ? null : { fechaFinPosterior: true };
    };
  }
}
