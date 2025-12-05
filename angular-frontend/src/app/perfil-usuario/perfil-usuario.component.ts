import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../services/auth.service';

type RoleShortcutAction = 'ATHLETE_PROFILE' | 'ADMIN_PANEL' | 'RANKINGS';

interface RoleMeta {
  key: string;
  label: string;
  description: string;
  color: 'primary' | 'accent' | 'warn';
  icon: string;
  guidance: string;
  capabilities: string[];
  highlights: Array<{ title: string; subtitle: string }>;
  allowProfileEditing: boolean;
}

interface RoleShortcut {
  label: string;
  icon: string;
  action: RoleShortcutAction;
  color: 'primary' | 'accent' | 'warn';
}

interface TimelineItem {
  label: string;
  date: string;
  icon: string;
  status: 'done' | 'pending';
  description?: string;
}

interface AccountStat {
  label: string;
  value: string;
  helper?: string;
  icon: string;
  accent: 'primary' | 'accent' | 'warn';
}

const ROLE_DEFINITIONS: Record<string, RoleMeta> = {
  admin: {
    key: 'admin',
    label: 'Administrador',
    description: 'Gestión del sistema.',
    color: 'warn',
    icon: 'admin_panel_settings',
    guidance: 'Acceso completo al panel de administración.',
    capabilities: [
      'Gestionar competiciones y usuarios'
    ],
    highlights: [
      { title: 'Panel administrativo', subtitle: 'Acceso completo' }
    ],
    allowProfileEditing: true
  },
  nadador: {
    key: 'nadador',
    label: 'Nadador vinculado',
    description: 'Perfil deportivo verificado.',
    color: 'primary',
    icon: 'pool',
    guidance: 'Consulta tus rankings y notificaciones.',
    capabilities: [
      'Ver ranking personal y convocatorias'
    ],
    highlights: [
      { title: 'Rol deportivo', subtitle: 'Perfil del nadador' }
    ],
    allowProfileEditing: true
  },
  usuario: {
    key: 'usuario',
    label: 'Usuario general',
    description: 'Acceso a rankings y estadísticas.',
    color: 'accent',
    icon: 'person',
    guidance: 'Explora el sistema y visualiza datos.',
    capabilities: [
      'Explorar rankings y competiciones'
    ],
    highlights: [
      { title: 'Acceso completo', subtitle: 'Explora dashboards' }
    ],
    allowProfileEditing: true
  },
  user: {
    key: 'user',
    label: 'Usuario general',
    description: 'Acceso a rankings y estadísticas.',
    color: 'accent',
    icon: 'person',
    guidance: 'Explora el sistema y visualiza datos.',
    capabilities: [
      'Explorar rankings y competiciones'
    ],
    highlights: [
      { title: 'Acceso completo', subtitle: 'Explora dashboards' }
    ],
    allowProfileEditing: true
  },
  default: {
    key: 'default',
    label: 'Rol sin clasificar',
    description: 'Contacta a un administrador.',
    color: 'accent',
    icon: 'help',
    guidance: 'Rol no reconocido.',
    capabilities: [
      'Acceso limitado'
    ],
    highlights: [
      { title: 'Validación pendiente', subtitle: 'Actualiza tu perfil' }
    ],
    allowProfileEditing: false
  }
};

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule
  ],
  templateUrl: './perfil-usuario.component.html',
  styleUrl: './perfil-usuario.component.scss'
})
export class PerfilUsuarioComponent implements OnInit, OnDestroy {
  loadingUser = true;
  profileForm!: FormGroup;
  user: any = null;
  profileError: string | null = null;
  savingProfile = false;
  avatarPreview: string | null = null;
  selectedAvatar: File | null = null;
  roleMeta: RoleMeta = ROLE_DEFINITIONS['default'];
  shortcuts: RoleShortcut[] = [];
  timeline: TimelineItem[] = [];
  stats: AccountStat[] = [];
  private avatarObjectUrl: string | null = null;
  private initialProfile = { name: '', lastName: '' };

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initProfileForm(null);
    this.loadUserContext();
  }

  ngOnDestroy(): void {
    this.releaseAvatarObjectUrl();
  }

  get currentRoleRaw(): string {
    return (this.user?.role ?? '').toString();
  }

  get userDisplayName(): string {
    const first = (this.user?.name ?? '').trim();
    const last = (this.user?.lastName ?? '').trim();
    const composed = [first, last].filter(Boolean).join(' ').trim();
    return composed || first || this.user?.email || 'Usuario';
  }

  get userEmail(): string {
    return (this.user?.email ?? '').trim();
  }

  get isVerified(): boolean {
    return !!(this.user?.emailVerifiedAt || this.user?.email_verified_at);
  }

  get canSubmitProfile(): boolean {
    if (!this.profileForm || !this.roleMeta.allowProfileEditing || this.savingProfile) {
      return false;
    }
    return this.profileForm.valid && this.isProfileDirty;
  }

  get isProfileDirty(): boolean {
    return this.hasProfileChanges() || !!this.selectedAvatar;
  }

  get verificationLabel(): string {
    if (this.isVerified) {
      return 'Correo verificado';
    }
    return 'Verificaci\u00f3n pendiente';
  }

  onAvatarSelected(event: Event): void {
    if (!this.roleMeta.allowProfileEditing) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const file = input?.files && input.files.length ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.openSnackBar('Formato no permitido. Usa JPG, PNG o WebP.');
      input.value = '';
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      this.openSnackBar('La imagen debe pesar menos de 2 MB.');
      input.value = '';
      return;
    }

    this.releaseAvatarObjectUrl();
    this.selectedAvatar = file;
    this.avatarObjectUrl = URL.createObjectURL(file);
    this.avatarPreview = this.avatarObjectUrl;
    if (input) {
      input.value = '';
    }
  }

  clearSelectedAvatar(): void {
    this.selectedAvatar = null;
    this.releaseAvatarObjectUrl();
    this.avatarPreview = this.user?.avatarLargeUrl || this.user?.avatarUrl || null;
  }

  resetProfileForm(): void {
    if (!this.profileForm) {
      return;
    }
    this.profileForm.reset({
      name: this.initialProfile.name,
      lastName: this.initialProfile.lastName
    });
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
    this.clearSelectedAvatar();
  }

  submitProfile(): void {
    if (!this.canSubmitProfile) {
      return;
    }

    const value = this.profileForm.value;
    const payload: { name?: string; lastName?: string } = {};
    const currentName = (value.name ?? '').toString().trim();
    const currentLastName = (value.lastName ?? '').toString().trim();

    if (currentName !== (this.initialProfile.name ?? '').trim()) {
      payload.name = currentName;
    }
    if (currentLastName !== (this.initialProfile.lastName ?? '').trim()) {
      payload.lastName = currentLastName;
    }

    this.savingProfile = true;
    this.profileError = null;

    this.authService.updateProfile(payload, this.selectedAvatar).subscribe({
      next: (response) => {
        const updatedUser = response?.user ?? response;
        this.refreshUser(updatedUser);
        this.savingProfile = false;
        this.openSnackBar('Perfil actualizado correctamente.');
      },
      error: (error) => {
        this.savingProfile = false;
        this.profileError = error?.error?.error || 'No pudimos actualizar tu perfil.';
        this.openSnackBar(this.profileError || 'No pudimos actualizar tu perfil.', 'Cerrar');
      }
    });
  }

  triggerShortcut(shortcut: RoleShortcut): void {
    switch (shortcut.action) {
      case 'ATHLETE_PROFILE':
        this.redirectToAthleteProfile();
        break;
      case 'ADMIN_PANEL':
        this.router.navigate(['/admin/competiciones']);
        break;
      default:
        this.router.navigate(['/nadadores']);
        break;
    }
  }

  private loadUserContext(): void {
    const cached = this.authService.currentUser();
    if (cached) {
      this.applyUser(cached);
      this.loadingUser = false;
      return;
    }

    this.authService.fetchCurrentUser().subscribe({
      next: (response) => {
        const fetched = response?.user ?? response;
        this.refreshUser(fetched);
        this.loadingUser = false;
      },
      error: () => {
        this.loadingUser = false;
      }
    });
  }

  private refreshUser(user: any): void {
    if (!user) {
      return;
    }
    this.authService.updateCachedUser(user);
    this.applyUser(user);
  }

  private applyUser(user: any): void {
    this.user = user;
    this.roleMeta = this.buildRoleMeta(user);
    this.avatarPreview = user?.avatarLargeUrl || user?.avatarUrl || null;
    this.initProfileForm(user);
    this.timeline = this.buildTimeline(user, this.roleMeta);
    this.stats = this.buildStats(user, this.roleMeta);
    this.shortcuts = this.buildShortcuts(user);
  }

  private buildRoleMeta(user: any): RoleMeta {
    const role = (user?.role ?? '').toString().trim().toLowerCase();
    return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS['default'];
  }

  private buildShortcuts(user: any): RoleShortcut[] {
    const shortcuts: RoleShortcut[] = [];
    if (user?.athleteId) {
      shortcuts.push({
        label: 'Ver perfil de nadador',
        icon: 'person_pin',
        action: 'ATHLETE_PROFILE',
        color: 'primary'
      });
    }
    if (user?.isAdmin || this.roleMeta.key === 'admin') {
      shortcuts.push({
        label: 'Panel de administraci\u00f3n',
        icon: 'admin_panel_settings',
        action: 'ADMIN_PANEL',
        color: 'warn'
      });
    }
    shortcuts.push({
      label: 'Ranking general',
      icon: 'leaderboard',
      action: 'RANKINGS',
      color: 'accent'
    });
    return shortcuts;
  }

  private buildTimeline(user: any, meta: RoleMeta): TimelineItem[] {
    const items: TimelineItem[] = [];
    const createdAt = this.toDate(user?.createdAt || user?.created_at);
    if (createdAt) {
      items.push({
        label: 'Cuenta creada',
        date: this.formatDateLabel(createdAt),
        icon: 'calendar_today',
        status: 'done'
      });
    }

    const verifiedAt = this.toDate(user?.emailVerifiedAt || user?.email_verified_at);
    items.push({
      label: 'Verificaci\u00f3n de correo',
      date: verifiedAt ? this.formatDateLabel(verifiedAt) : 'Pendiente',
      icon: 'mark_email_read',
      status: verifiedAt ? 'done' : 'pending'
    });

    return items;
  }

  private buildStats(user: any, meta: RoleMeta): AccountStat[] {
    const stats: AccountStat[] = [];

    stats.push({
      label: 'Rol',
      value: meta.label,
      icon: 'verified_user',
      accent: meta.color
    });

    if (user?.athleteId) {
      stats.push({
        label: 'Perfil deportivo',
        value: `ID #${user.athleteId}`,
        icon: 'pool',
        accent: 'primary'
      });
    }

    return stats;
  }

  private redirectToAthleteProfile(): void {
    if (!this.user?.athleteId) {
      return;
    }
    const displayName = encodeURIComponent(this.userDisplayName || 'mi-perfil');
    this.router.navigate([`/nadadores/perfil/${displayName}`], {
      queryParams: {
        athleteId: this.user.athleteId
      },
      state: {
        performer: {
          name: this.userDisplayName,
          athleteId: this.user.athleteId,
          imageUrl: this.user?.avatarLargeUrl || this.user?.avatarUrl
        }
      }
    });
  }

  private initProfileForm(user: any | null): void {
    this.initialProfile = {
      name: (user?.name ?? '').trim(),
      lastName: (user?.lastName ?? '').trim()
    };

    if (!this.profileForm) {
      this.profileForm = this.fb.group({
        name: [
          this.initialProfile.name,
          [Validators.required, Validators.minLength(3), Validators.maxLength(80)]
        ],
        lastName: [
          this.initialProfile.lastName,
          [Validators.maxLength(80), (control: AbstractControl) => this.optionalLastNameValidator(control)]
        ]
      });
    } else {
      this.profileForm.reset({
        name: this.initialProfile.name,
        lastName: this.initialProfile.lastName
      });
    }

    if (this.roleMeta.allowProfileEditing) {
      this.profileForm.enable({ emitEvent: false });
    } else {
      this.profileForm.disable({ emitEvent: false });
    }
  }

  private optionalLastNameValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value ?? '').toString().trim();
    if (value === '') {
      return null;
    }
    if (value.length < 2) {
      return { minlength: true };
    }
    return null;
  }

  private hasProfileChanges(): boolean {
    if (!this.profileForm) {
      return false;
    }
    const name = (this.profileForm.get('name')?.value ?? '').toString().trim();
    const lastName = (this.profileForm.get('lastName')?.value ?? '').toString().trim();
    return (
      name !== (this.initialProfile.name ?? '').trim() ||
      lastName !== (this.initialProfile.lastName ?? '').trim()
    );
  }

  private releaseAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  private openSnackBar(message: string, action: string = 'Aceptar'): void {
    this.snackBar.open(message, action, {
      duration: 3500,
      horizontalPosition: 'end',
      verticalPosition: 'bottom'
    });
  }

  private toDate(value: any): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private formatDateLabel(date: Date): string {
    return date.toLocaleDateString();
  }
}
