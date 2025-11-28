import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Proof } from '../../services/proof.service';

@Component({
  selector: 'app-edit-proof-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="edit-proof-container">
      <h2 mat-dialog-title>Editar Prueba</h2>
      
      <mat-dialog-content>
        <form [formGroup]="proofForm">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nombre Prueba</mat-label>
            <input matInput formControlName="nombre_prueba" placeholder="ej: 100m Freestyle">
            <mat-error *ngIf="proofForm.get('nombre_prueba')?.hasError('required')">
              Campo requerido
            </mat-error>
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
            <mat-error *ngIf="proofForm.get('distancia')?.hasError('required')">
              Selecciona una distancia
            </mat-error>
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
            <mat-error *ngIf="proofForm.get('estilo')?.hasError('required')">
              Selecciona un estilo
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Género</mat-label>
            <mat-select formControlName="genero">
              <mat-option value="M">Masculino</mat-option>
              <mat-option value="F">Femenino</mat-option>
              <mat-option value="Mixto">Mixto</mat-option>
            </mat-select>
            <mat-error *ngIf="proofForm.get('genero')?.hasError('required')">
              Selecciona un género
            </mat-error>
          </mat-form-field>

          <div class="info-box">
            <p><strong>Inscripciones actuales:</strong> {{ data.proof.total_inscripciones || 0 }}</p>
            <p class="note">⚠️ Al cambiar distancia/estilo/género, la prueba se modificará para todos los atletas inscritos.</p>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancelar</button>
        <button 
          mat-raised-button 
          color="primary"
          [disabled]="proofForm.invalid || saving"
          (click)="onSave()">
          <mat-icon *ngIf="!saving">save</mat-icon>
          {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .edit-proof-container {
      min-width: 400px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .info-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      font-size: 14px;
    }

    .info-box p {
      margin: 4px 0;
    }

    .note {
      color: #856404;
      font-size: 12px;
      font-style: italic;
    }

    mat-dialog-actions {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
      margin-top: 16px;
    }
  `]
})
export class EditProofDialogComponent {
  proofForm!: FormGroup;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<EditProofDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { proof: Proof },
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  private initForm(): void {
    this.proofForm = this.fb.group({
      nombre_prueba: [this.data.proof.nombre_prueba, Validators.required],
      distancia: [this.data.proof.distancia.toString(), Validators.required],
      estilo: [this.data.proof.estilo, Validators.required],
      genero: [this.data.proof.genero, Validators.required]
    });
  }

  onSave(): void {
    if (this.proofForm.invalid) return;

    this.saving = true;
    const formValue = this.proofForm.value;

    // Retornar los datos editados
    this.dialogRef.close({
      nombre_prueba: formValue.nombre_prueba,
      distancia: parseInt(formValue.distancia),
      estilo: formValue.estilo,
      genero: formValue.genero
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
