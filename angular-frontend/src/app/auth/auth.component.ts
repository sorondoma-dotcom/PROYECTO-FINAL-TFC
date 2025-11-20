import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
    ReactiveFormsModule,
    RouterLink,
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
export class AuthComponent implements OnInit {
  mode: 'login' | 'register' = 'login';
  authForm!: FormGroup;
  loading = false;
  message = '';
  error = '';
  passwordVisible = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.authForm = this.fb.group({
      name: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.updateNameValidators();
  }

  private updateNameValidators(): void {
    const nameControl = this.authForm.get('name');
    if (this.mode === 'register') {
      nameControl?.setValidators([Validators.required, Validators.minLength(3)]);
    } else {
      nameControl?.clearValidators();
    }
    nameControl?.updateValueAndValidity();
  }

  switchMode(newMode: 'login' | 'register') {
    this.mode = newMode;
    this.message = '';
    this.error = '';
    this.authForm.reset();
    this.passwordVisible = false;
    this.updateNameValidators();
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  submit() {
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    this.error = '';

    const formValue = this.authForm.value;

    const request = this.mode === 'login'
      ? this.authService.login({
          email: formValue.email,
          password: formValue.password
        })
      : this.authService.register({
          name: formValue.name,
          email: formValue.email,
          password: formValue.password
        });

    request.subscribe({
      next: () => {
        this.loading = false;
        this.message = this.mode === 'login'
          ? 'Inicio de sesión exitoso'
          : 'Registro exitoso';

        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1000);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Ocurrió un error';
      }
    });
  }

  // Métodos auxiliares para acceder a los controles del formulario
  get nameControl() {
    return this.authForm.get('name');
  }

  get emailControl() {
    return this.authForm.get('email');
  }

  get passwordControl() {
    return this.authForm.get('password');
  }

  getErrorMessage(controlName: string): string {
    const control = this.authForm.get(controlName);
    if (!control || !control.touched) return '';

    if (control.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control.hasError('email')) {
      return 'Ingresa un email válido';
    }
    if (control.hasError('minlength')) {
      const minLength = control.getError('minlength').requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    return '';
  }
}
