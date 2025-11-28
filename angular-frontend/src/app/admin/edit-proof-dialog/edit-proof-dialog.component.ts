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
  templateUrl: './edit-proof-dialog.component.html',
  styleUrls: ['./edit-proof-dialog.component.scss']
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
