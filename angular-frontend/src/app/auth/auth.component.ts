import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { ConfirmationService } from '../shared/services/confirmation.service';

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
  formSubmitted = false;

  private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  private readonly namePattern = /^[a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+)*$/;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private confirmation: ConfirmationService
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
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(this.passwordPattern),
          this.noRepeatedWhitespace
        ]
      ]
    });
    this.updateNameValidators();
  }

  private updateNameValidators(): void {
    const control = this.authForm.get('name');
    if (this.mode === 'register') {
      control?.setValidators([Validators.required, Validators.minLength(3), Validators.pattern(this.namePattern)]);
    } else {
      control?.clearValidators();
    }
    control?.updateValueAndValidity();
  }

  switchMode(newMode: 'login' | 'register') {
    this.mode = newMode;
    this.message = '';
    this.error = '';
    this.formSubmitted = false;
    this.authForm.reset();
    this.passwordVisible = false;
    this.updateNameValidators();
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  submit() {
    this.formSubmitted = true;
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

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

    this.confirmation
      .confirm({
        title: this.mode === 'login' ? 'Confirmar inicio de sesión' : 'Confirmar registro',
        message: this.mode === 'login'
          ? '¿Deseas iniciar sesión con las credenciales ingresadas?'
          : '¿Deseas crear la nueva cuenta con estos datos?',
        confirmText: this.mode === 'login' ? 'Iniciar sesión' : 'Registrarme',
        confirmColor: 'primary'
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.loading = true;
        this.message = '';
        this.error = '';

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
      });
  }

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
    if (!control || (!control.touched && !this.formSubmitted)) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Este campo es requerido';
    }

    if (control.hasError('email')) {
      return 'Ingresa un correo válido';
    }

    if (control.hasError('minlength')) {
      const minLength = control.getError('minlength').requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }

    if (control.hasError('pattern')) {
      if (controlName === 'password') {
        return 'Usa al menos una mayúscula, una minúscula y un número.';
      }
      if (controlName === 'name') {
        return 'Solo letras y espacios.';
      }
    }

    if (control.hasError('whitespace')) {
      return 'Evita espacios consecutivos.';
    }

    return '';
  }

  private noRepeatedWhitespace(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (value && /\s{2,}/.test(value)) {
      return { whitespace: true };
    }
    return null;
  }
}
