import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-edit-competition-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Editar competición</h2>
    <mat-dialog-content>
      <form [formGroup]="editForm" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="descripcion" rows="3"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>País</mat-label>
            <input matInput formControlName="pais" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Ciudad</mat-label>
            <input matInput formControlName="ciudad" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="estado">
              <mat-option value="pendiente">Pendiente</mat-option>
              <mat-option value="en_curso">En curso</mat-option>
              <mat-option value="finalizada">Finalizada</mat-option>
              <mat-option value="cancelada">Cancelada</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Tipo piscina</mat-label>
            <mat-select formControlName="tipo_piscina">
              <mat-option value="25m">25m</mat-option>
              <mat-option value="50m">50m</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="onSave()">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .half-width {
      width: 100%;
    }
  `]
})
export class EditCompetitionDialogComponent {
  editForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<EditCompetitionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competition: any }
  ) {
    const comp = data.competition;
    this.editForm = this.fb.group({
      nombre: [comp.nombre],
      descripcion: [comp.descripcion],
      pais: [comp.pais],
      ciudad: [comp.ciudad],
      estado: [comp.estado],
      tipo_piscina: [comp.tipo_piscina]
    });
  }

  onSave(): void {
    this.dialogRef.close(this.editForm.value);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
