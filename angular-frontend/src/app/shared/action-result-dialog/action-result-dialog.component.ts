import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ActionResultDialogData {
  title?: string;
  message: string;
  icon?: string;
  confirmText?: string;
}

@Component({
  selector: 'app-action-result-dialog',
  standalone: true,
  templateUrl: './action-result-dialog.component.html',
  styleUrls: ['./action-result-dialog.component.scss'],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class ActionResultDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ActionResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ActionResultDialogData
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  get icon(): string {
    return this.data.icon || 'check_circle';
  }

  get title(): string {
    return this.data.title || 'Acción realizada';
  }

  get confirmText(): string {
    return this.data.confirmText || 'Aceptar';
  }
}
