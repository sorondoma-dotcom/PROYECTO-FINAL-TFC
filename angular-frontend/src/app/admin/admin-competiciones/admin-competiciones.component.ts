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
    MatTooltipModule
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
  }

  ngOnInit(): void {
    this.loadCompeticiones();
  }

  private initForm(): void {
    this.competicionForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      pais: [''],
      ciudad: [''],
      tipo_piscina: ['50m', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      lugar_evento: ['']
    });
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

    return '';
  }
}
