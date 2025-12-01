import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: 'session-expired-dialog.component.html',
  styleUrls: ['session-expired-dialog.component.scss'],
})
export class SessionExpiredDialogComponent {
  readonly message = 'La sesión ha caducado. Debes volver a iniciar sesión.';
  readonly actions = [
    { label: 'Ir al login', color: 'primary' as const, handler: () => this.goLogin() }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialogRef: MatDialogRef<SessionExpiredDialogComponent>
  ) {}

  goLogin(): void {
    // Intentar cerrar sesión en el backend (silenciosamente)
    try {
      this.authService.logout()
        .pipe(catchError(() => of(null)))
        .subscribe({
          next: () => {},
          error: () => {},
          complete: () => {}
        });
    } catch {}
    
    // Limpiar localStorage
    try { 
      localStorage.removeItem('auth_user'); 
    } catch {}
    
    // Cerrar diálogo y redirigir
    this.dialogRef.close();
    this.router.navigate(['/auth']);
  }
}
