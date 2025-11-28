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
  templateUrl: './edit-competition-dialog.component.html',
  styleUrls: ['./edit-competition-dialog.component.scss']
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
