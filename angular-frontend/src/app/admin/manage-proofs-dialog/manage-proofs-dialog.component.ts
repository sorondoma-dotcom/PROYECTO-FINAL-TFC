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
  templateUrl: './manage-proofs-dialog.component.html',
  styleUrls: ['./manage-proofs-dialog.component.scss']
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
