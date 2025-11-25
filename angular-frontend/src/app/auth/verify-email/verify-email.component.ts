import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-verify-email',
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
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class VerifyEmailComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  message = '';
  error = '';
  expiresAt = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const emailFromQuery = this.route.snapshot.queryParamMap.get('email') || '';
    this.form = this.fb.group({
      email: [emailFromQuery, [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  sendCode(): void {
    this.message = '';
    this.error = '';
    this.expiresAt = '';

    if (this.form.get('email')?.invalid) {
      this.form.get('email')?.markAsTouched();
      return;
    }

    this.loading = true;
    const email = this.form.get('email')?.value;

    this.authService.sendVerificationCode(email).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res?.message || 'Codigo enviado. Revisa tu correo.';
        this.expiresAt = res?.verification?.expiresAt || '';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.error?.message || 'No pudimos enviar el codigo';
      }
    });
  }

  verify(): void {
    this.message = '';
    this.error = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const email = this.form.get('email')?.value;
    const code = this.form.get('code')?.value;

    this.authService.verifyEmail(email, code).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res?.message || 'Correo verificado correctamente';

        setTimeout(() => {
          this.router.navigate(['/auth']);
        }, 1200);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.error?.message || 'No pudimos verificar el codigo';
      }
    });
  }
}
