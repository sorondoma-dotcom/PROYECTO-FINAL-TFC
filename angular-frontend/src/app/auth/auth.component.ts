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
import { animate, style, transition, trigger } from '@angular/animations';

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
  styleUrls: ['./auth.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
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
  private readonly namePattern = /^[a-zA-ZÁÉÍÓÚáéíóúÑñ]+(?:\s[a-zA-ZÁÉÍÓÚáéíóúÑñ]+)*$/;
  private readonly emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
      email: ['', [Validators.required, Validators.email, Validators.pattern(this.emailPattern)]],
      confirmEmail: [''],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(this.passwordPattern),
          this.noRepeatedWhitespace
        ]
      ],
      confirmPassword: ['']
    }, {
      validators: [this.emailMatchValidator, this.passwordMatchValidator]
    });
    this.updateNameValidators();
  }

  private updateNameValidators(): void {
    const nameControl = this.authForm.get('name');
    const confirmEmailControl = this.authForm.get('confirmEmail');
    const confirmPasswordControl = this.authForm.get('confirmPassword');
    
    if (this.mode === 'register') {
      nameControl?.setValidators([Validators.required, Validators.minLength(3), Validators.pattern(this.namePattern)]);
      confirmEmailControl?.setValidators([Validators.required, Validators.email]);
      confirmPasswordControl?.setValidators([Validators.required]);
    } else {
      nameControl?.clearValidators();
      confirmEmailControl?.clearValidators();
      confirmPasswordControl?.clearValidators();
    }
    
    nameControl?.updateValueAndValidity();
    confirmEmailControl?.updateValueAndValidity();
    confirmPasswordControl?.updateValueAndValidity();
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
        title: this.mode === 'login' ? 'Confirmar inicio de sesion' : 'Confirmar registro',
        message: this.mode === 'login'
          ? 'Deseas iniciar sesion con las credenciales ingresadas?'
          : 'Deseas crear la nueva cuenta con estos datos?',
        confirmText: this.mode === 'login' ? 'Iniciar sesion' : 'Registrarme',
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
            if (this.mode === 'login') {
              this.message = 'Inicio de sesion exitoso';
              setTimeout(() => {
                this.router.navigate(['/']);
              }, 1000);
              return;
            }

            this.message = 'Registro exitoso. Revisa tu correo y confirma tu cuenta.';
            this.mode = 'login';
            this.passwordVisible = false;
            this.authForm.reset({ email: formValue.email });
            this.formSubmitted = false;
            this.updateNameValidators();

            setTimeout(() => {
              this.router.navigate(['/verify-email'], { queryParams: { email: formValue.email } });
            }, 1000);
          },
          error: (err: any) => {
            this.loading = false;
            this.error = err?.error?.message || 'Ocurrio un error';
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

  get confirmEmailControl() {
    return this.authForm.get('confirmEmail');
  }

  get confirmPasswordControl() {
    return this.authForm.get('confirmPassword');
  }

  private emailMatchValidator(group: AbstractControl): ValidationErrors | null {
    const email = group.get('email')?.value;
    const confirmEmail = group.get('confirmEmail')?.value;
    
    if (!email || !confirmEmail) {
      return null;
    }
    
    return email === confirmEmail ? null : { emailMismatch: true };
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (!password || !confirmPassword) {
      return null;
    }
    
    return password === confirmPassword ? null : { passwordMismatch: true };
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
      return 'Ingresa un correo valido';
    }

    if (control.hasError('minlength')) {
      const minLength = control.getError('minlength').requiredLength;
      return `Minimo ${minLength} caracteres`;
    }

    if (control.hasError('pattern')) {
      if (controlName === 'password') {
        return 'Usa al menos una mayuscula, una minuscula y un numero.';
      }
      if (controlName === 'name') {
        return 'Solo letras y espacios.';
      }
    }

    if (control.hasError('whitespace')) {
      return 'Evita espacios consecutivos.';
    }

    // Errores de coincidencia en nivel de formulario
    if (controlName === 'confirmEmail' && this.authForm.hasError('emailMismatch')) {
      return 'Los correos no coinciden';
    }

    if (controlName === 'confirmPassword' && this.authForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
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

  emailsMatch(): boolean {
    const email = this.authForm.get('email')?.value;
    const confirmEmail = this.authForm.get('confirmEmail')?.value;
    return !!email && !!confirmEmail && email === confirmEmail;
  }

  emailsDontMatch(): boolean {
    const email = this.authForm.get('email')?.value;
    const confirmEmail = this.authForm.get('confirmEmail')?.value;
    const confirmTouched = this.authForm.get('confirmEmail')?.touched;
    return !!confirmEmail && !!confirmTouched && email !== confirmEmail;
  }

  passwordsMatch(): boolean {
    const password = this.authForm.get('password')?.value;
    const confirmPassword = this.authForm.get('confirmPassword')?.value;
    return !!password && !!confirmPassword && password === confirmPassword;
  }

  passwordsDontMatch(): boolean {
    const password = this.authForm.get('password')?.value;
    const confirmPassword = this.authForm.get('confirmPassword')?.value;
    const confirmTouched = this.authForm.get('confirmPassword')?.touched;
    return !!confirmPassword && !!confirmTouched && password !== confirmPassword;
  }
}
