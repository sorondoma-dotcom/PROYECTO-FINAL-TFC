import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  step: 'request' | 'reset' = 'request';
  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  message = '';
  error = '';
  resetCode = '';
  expiresAt = '';
  passwordVisible = false;
  confirmPasswordVisible = false;
  requestSubmitted = false;
  resetSubmitted = false;

  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

  constructor(
    private authService: AuthService,
    private confirmation: ConfirmationService
  ) {}

  requestCode(): void {
    this.requestSubmitted = true;

    if (!this.emailPattern.test(this.email)) {
      this.error = 'Ingresa un correo válido';
      return;
    }

    this.confirmation
      .confirm({
        title: 'Enviar código de recuperación',
        message: `Enviaremos un código a ${this.email}. ¿Deseas continuar?`,
        confirmText: 'Enviar código',
        confirmColor: 'primary'
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.loading = true;
        this.message = '';
        this.error = '';
        this.resetCode = '';
        this.expiresAt = '';

        this.authService.requestPasswordReset(this.email).subscribe({
          next: (res) => {
            this.loading = false;
            this.message = res?.message || 'Código generado correctamente';
            this.resetCode = res?.reset?.code || res?.code || '';
            this.expiresAt = res?.reset?.expiresAt || res?.expiresAt || '';

            if (this.resetCode) {
              setTimeout(() => {
                this.step = 'reset';
                this.message = '';
              }, 1500);
            }
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.error?.message || err?.error?.error || 'No pudimos generar el código';
          }
        });
      });
  }

  resetPassword(): void {
    this.resetSubmitted = true;

    if (!this.code || !this.newPassword || !this.confirmPassword) {
      this.error = 'Completa todos los campos';
      return;
    }

    if (!this.passwordPattern.test(this.newPassword)) {
      this.error = 'Incluye mayúsculas, minúsculas y números en la contraseña.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    this.confirmation
      .confirm({
        title: 'Confirmar actualización',
        message: 'Se reemplazará la contraseña actual por la nueva. ¿Deseas continuar?',
        confirmText: 'Actualizar',
        confirmColor: 'accent'
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.loading = true;
        this.message = '';
        this.error = '';

        this.authService.resetPassword(this.code, this.newPassword).subscribe({
          next: (res) => {
            this.loading = false;
            this.message = res?.message || 'Contraseña actualizada correctamente';

            setTimeout(() => {
              // Redirigir al login después de 2 segundos
              window.location.href = '/auth';
            }, 2000);
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.error?.error || err?.error?.message || 'No se pudo actualizar la contraseña';
          }
        });
      });
  }

  togglePasswordVisibility(field: 'new' | 'confirm'): void {
    if (field === 'new') {
      this.passwordVisible = !this.passwordVisible;
    } else {
      this.confirmPasswordVisible = !this.confirmPasswordVisible;
    }
  }

  goBackToRequest(): void {
    this.step = 'request';
    this.code = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.message = '';
    this.error = '';
    this.resetSubmitted = false;
  }
}
