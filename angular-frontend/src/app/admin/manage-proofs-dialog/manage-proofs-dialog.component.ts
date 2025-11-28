import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProofService, Proof } from '../../services/proof.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { EditProofDialogComponent } from '../edit-proof-dialog/edit-proof-dialog.component';

@Component({
  selector: 'app-manage-proofs-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="proof-manager-container">
      <h2 mat-dialog-title>Gestionar Pruebas</h2>
      
      <mat-dialog-content>
        <mat-tab-group>
          <!-- TAB 1: Crear nueva prueba -->
          <mat-tab label="Nueva Prueba">
            <div class="tab-content">
              <form [formGroup]="proofForm">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nombre Prueba</mat-label>
                  <input matInput formControlName="nombre_prueba" placeholder="ej: 100m Freestyle">
                  <mat-error>Campo requerido</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Distancia (m)</mat-label>
                  <mat-select formControlName="distancia">
                    <mat-option value="50">50m</mat-option>
                    <mat-option value="100">100m</mat-option>
                    <mat-option value="200">200m</mat-option>
                    <mat-option value="400">400m</mat-option>
                    <mat-option value="800">800m</mat-option>
                    <mat-option value="1500">1500m</mat-option>
                  </mat-select>
                  <mat-error>Selecciona una distancia</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Estilo</mat-label>
                  <mat-select formControlName="estilo">
                    <mat-option value="Libre">Libre</mat-option>
                    <mat-option value="Espalda">Espalda</mat-option>
                    <mat-option value="Pecho">Pecho</mat-option>
                    <mat-option value="Mariposa">Mariposa</mat-option>
                    <mat-option value="Combinado">Combinado</mat-option>
                  </mat-select>
                  <mat-error>Selecciona un estilo</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Género</mat-label>
                  <mat-select formControlName="genero">
                    <mat-option value="M">Masculino</mat-option>
                    <mat-option value="F">Femenino</mat-option>
                    <mat-option value="Mixto">Mixto</mat-option>
                  </mat-select>
                  <mat-error>Selecciona un género</mat-error>
                </mat-form-field>

                <button 
                  mat-raised-button 
                  color="primary" 
                  class="full-width"
                  (click)="crearPrueba()"
                  [disabled]="proofForm.invalid || saving">
                  <mat-icon *ngIf="!saving">add</mat-icon>
                  <mat-spinner *ngIf="saving" diameter="20"></mat-spinner>
                  {{ saving ? 'Creando...' : 'Crear Prueba' }}
                </button>
              </form>
            </div>
          </mat-tab>

          <!-- TAB 2: Listado de pruebas -->
          <mat-tab label="Pruebas ({{ proofs.length }})">
            <div class="tab-content">
              <div *ngIf="loading" class="loading">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loading && proofs.length === 0" class="no-data">
                No hay pruebas aún. Crea la primera prueba en la pestaña anterior.
              </div>

              <div *ngIf="!loading && proofs.length > 0" class="proofs-list">
                <div *ngFor="let proof of proofs" class="proof-card">
                  <div class="proof-header">
                    <div class="proof-info">
                      <h3>{{ proof.nombre_prueba }}</h3>
                      <div class="proof-details">
                        <mat-chip-set aria-label="Detalles">
                          <mat-chip selected>{{ proof.distancia }}m</mat-chip>
                          <mat-chip [highlighted]="true">{{ proof.estilo }}</mat-chip>
                          <mat-chip>{{ getGenderLabel(proof.genero) }}</mat-chip>
                          <mat-chip>{{ proof.total_inscripciones || 0 }} atletas</mat-chip>
                        </mat-chip-set>
                      </div>
                    </div>
                    <div class="proof-actions">
                      <button mat-icon-button matTooltip="Editar" (click)="editarPrueba(proof)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Eliminar" color="warn" (click)="eliminarPrueba(proof)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>

                  <!-- Series para esta prueba -->
                  <div *ngIf="proof.series && (proof.series | keyvalue).length > 0" class="series-section">
                    <h4>Series ({{ (proof.series | keyvalue).length }})</h4>
                    <div *ngFor="let serie of proof.series | keyvalue" class="serie-card">
                      <strong>Serie {{ serie.key }}: {{ serie.value.length }} atletas</strong>
                      <div class="athletes-list">
                        <div *ngFor="let athlete of serie.value" class="athlete-item">
                          <span class="athlete-name">{{ athlete.athlete_name }}</span>
                          <span class="athlete-country">{{ athlete.country_code }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div *ngIf="!proof.series || (proof.series | keyvalue).length === 0" class="no-athletes">
                    Sin inscripciones aún
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cerrar</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .proof-manager-container {
      min-width: 600px;
      max-width: 900px;
    }

    .tab-content {
      padding: 20px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
    }

    .no-data {
      text-align: center;
      color: #999;
      padding: 40px 20px;
    }

    .proofs-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .proof-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      background: #f9f9f9;
    }

    .proof-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .proof-info {
      flex: 1;
    }

    .proof-info h3 {
      margin: 0 0 8px 0;
      color: #0f9de8;
    }

    .proof-details {
      margin-top: 8px;
    }

    .proof-actions {
      display: flex;
      gap: 8px;
    }

    .series-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
    }

    .series-section h4 {
      margin: 0 0 12px 0;
      color: #666;
    }

    .serie-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .serie-card strong {
      display: block;
      margin-bottom: 8px;
      color: #0c7cc0;
    }

    .athletes-list {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .athlete-item {
      display: flex;
      flex-direction: column;
      font-size: 12px;
      padding: 8px;
      background: #f0f7ff;
      border-radius: 4px;
      border-left: 3px solid #0f9de8;
    }

    .athlete-name {
      font-weight: 600;
      color: #333;
    }

    .athlete-country {
      color: #999;
      font-size: 11px;
    }

    .no-athletes {
      color: #999;
      font-style: italic;
      padding: 12px;
      text-align: center;
    }

    mat-dialog-actions {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }

    :host ::ng-deep .mat-mdc-tab-header {
      margin-bottom: 0;
    }

    @media (max-width: 768px) {
      .proof-manager-container {
        min-width: auto;
        max-width: 100%;
      }

      .athletes-list {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class ManageProofsDialogComponent implements OnInit {
  proofs: Proof[] = [];
  proofForm!: FormGroup;
  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<ManageProofsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competicion_id: number },
    private proofService: ProofService,
    private fb: FormBuilder,
    private confirmation: ConfirmationService,
    private dialog: MatDialog
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadProofs();
  }

  private initForm(): void {
    this.proofForm = this.fb.group({
      nombre_prueba: ['', Validators.required],
      distancia: ['', Validators.required],
      estilo: ['', Validators.required],
      genero: ['Mixto', Validators.required]
    });
  }

  private loadProofs(): void {
    this.loading = true;
    this.proofService.getProofsByCompetition(this.data.competicion_id).subscribe({
      next: (response: any) => {
        this.proofs = response.proofs || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading proofs:', error);
        this.loading = false;
      }
    });
  }

  crearPrueba(): void {
    if (this.proofForm.invalid) return;

    this.saving = true;
    const formValue = this.proofForm.value;

    this.proofService.createProof(this.data.competicion_id, {
      nombre_prueba: formValue.nombre_prueba,
      distancia: parseInt(formValue.distancia),
      estilo: formValue.estilo,
      genero: formValue.genero
    }).subscribe({
      next: () => {
        this.proofForm.reset({ genero: 'Mixto' });
        this.loadProofs();
        this.saving = false;
      },
      error: (error) => {
        console.error('Error creating proof:', error);
        this.saving = false;
      }
    });
  }

  editarPrueba(proof: Proof): void {
    const dialogRef = this.dialog.open(EditProofDialogComponent, {
      data: { proof },
      width: '450px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result || !proof.id) return;

      this.proofService.updateProof(proof.id, result).subscribe({
        next: () => {
          this.loadProofs();
        },
        error: (error) => {
          console.error('Error updating proof:', error);
        }
      });
    });
  }

  eliminarPrueba(proof: Proof): void {
    this.confirmation.confirm({
      title: 'Eliminar Prueba',
      message: `¿Estás seguro de que deseas eliminar "${proof.nombre_prueba}"? Se eliminarán todas las inscripciones.`,
      confirmText: 'Eliminar',
      confirmColor: 'warn'
    }).subscribe(confirmed => {
      if (!confirmed || !proof.id) return;

      this.proofService.deleteProof(proof.id).subscribe({
        next: () => {
          this.loadProofs();
        },
        error: (error) => {
          console.error('Error deleting proof:', error);
        }
      });
    });
  }

  getGenderLabel(gender: string): string {
    const labels: { [key: string]: string } = {
      'M': 'Masculino',
      'F': 'Femenino',
      'Mixto': 'Mixto'
    };
    return labels[gender] || gender;
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
