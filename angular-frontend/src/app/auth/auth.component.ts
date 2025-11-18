import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  mode: 'login' | 'register' = 'login';
  form = { name: '', email: '', password: '' };
  loading = false;
  message = '';
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Si ya está logueado, redirigir al dashboard
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  switchMode(newMode: 'login' | 'register') {
    this.mode = newMode;
    this.message = '';
    this.error = '';
    this.form = { name: '', email: '', password: '' };
  }

  submit() {
    this.loading = true;
    this.message = '';
    this.error = '';

    const request = this.mode === 'login'
      ? this.authService.login({
          email: this.form.email,
          password: this.form.password
        })
      : this.authService.register({
          name: this.form.name,
          email: this.form.email,
          password: this.form.password
        });

    request.subscribe({
      next: (res: any) => {
        this.loading = false;
        this.message = this.mode === 'login'
          ? 'Inicio de sesión exitoso'
          : 'Registro exitoso';

        // Redirigir al dashboard después de login/registro exitoso
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Ocurrió un error';
      }
    });
  }
}
