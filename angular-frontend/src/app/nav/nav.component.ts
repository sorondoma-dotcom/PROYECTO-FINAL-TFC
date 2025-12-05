import { Component, DoCheck, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ConfirmationService } from '../shared/services/confirmation.service';
import { NotificationService, NotificationItem } from '../services/notification.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatTooltipModule,
    MatBadgeModule,
    MatDialogModule,
    MatMenuModule,
    RouterOutlet
  ],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent implements OnDestroy, DoCheck {
  menuOpen = false;
  isDarkMode = false;
  theme: string = 'light';
  notifications: NotificationItem[] = [];
  pendingNotifications = 0;
  loadingNotifications = false;
  private notificationBellEnabled = false;
  private notificationsTimer?: ReturnType<typeof setInterval>;

  menuItems = [
    { label: 'Inicio', icon: 'home', route: '/' },
    { label: 'Competiciones', icon: 'pool', route: '/competiciones' },
    { label: 'Nadadores', icon: 'person', route: '/nadadores' },
    { label: 'Estadisticas', icon: 'analytics', route: '/estadisticas' },
  ];

  adminMenuItems = [
    { label: 'Administración', icon: 'admin_panel_settings', route: '/admin/competiciones' }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    public authService: AuthService,
    private router: Router,
    private confirmation: ConfirmationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.theme = localStorage.getItem('theme') || 'light';
      this.isDarkMode = this.theme === 'dark';
      document.body.classList.toggle('dark-theme', this.isDarkMode);
    }

    this.notificationBellEnabled = this.canShowNotificationBell();

    if (this.notificationBellEnabled) {
      this.loadNotifications();
      this.startNotificationPolling();
    }
  }

  ngOnDestroy(): void {
    this.stopNotificationPolling();
  }

  ngDoCheck(): void {
    const canShow = this.canShowNotificationBell();
    if (canShow && !this.notificationBellEnabled) {
      this.notificationBellEnabled = true;
      this.loadNotifications();
      this.startNotificationPolling();
    } else if (!canShow && this.notificationBellEnabled) {
      this.notificationBellEnabled = false;
      this.stopNotificationPolling();
      this.notifications = [];
      this.pendingNotifications = 0;
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  toggleTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.isDarkMode = this.theme === 'dark';
      localStorage.setItem('theme', this.theme);
      document.body.classList.toggle('dark-theme', this.isDarkMode);
    }
  }

  logout(): void {
    this.confirmation
      .confirm({
        title: 'Cerrar sesión',
        message: '¿Deseas cerrar tu sesión actual? Necesitarás volver a autenticarte.',
        confirmText: 'Cerrar sesión',
        confirmColor: 'warn'
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.authService.logout().subscribe({
          next: () => this.router.navigate(['/auth']),
          error: () => this.router.navigate(['/auth'])
        });
        this.stopNotificationPolling();
        this.notifications = [];
        this.pendingNotifications = 0;
      });
  }

  isUserAdmin(): boolean {
    const user = this.authService.currentUser();
    return user && user.isAdmin === true;
  }

  get userFullName(): string {
    const user = this.authService.currentUser();
    const firstName = (user?.name ?? '').trim();
    const lastName = (user?.lastName ?? '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      return fullName;
    }
    const email = (user?.email ?? '').trim();
    return email || 'Usuario';
  }

  get userInitials(): string {
    const user = this.authService.currentUser();
    const firstName = (user?.name ?? '').trim();
    const lastName = (user?.lastName ?? '').trim();
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '');
    if (initials) {
      return initials;
    }
    const fallback = (user?.email ?? '').trim();
    return fallback ? fallback.charAt(0).toUpperCase() : 'U';
  }

  get userAvatar(): string | null {
    const user = this.authService.currentUser();
    return user?.avatarThumbUrl || user?.avatarUrl || null;
  }

  get visibleMenuItems() {
    let items = [...this.menuItems];

    if (this.isUserAdmin()) {
      items = items.concat(this.adminMenuItems);
    }
    return items;
  }

  canShowNotificationBell(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    const user = this.authService.currentUser();
    return !!user?.athleteId;
  }

  loadNotifications(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.canShowNotificationBell()) {
      this.notifications = [];
      this.pendingNotifications = 0;
      return;
    }

    this.loadingNotifications = true;
    this.notificationService.getNotifications().subscribe({
      next: (response) => {
        this.notifications = response.notifications ?? [];
        this.pendingNotifications = response.pending ?? 0;
        this.loadingNotifications = false;
      },
      error: (error) => {
        console.error('Error cargando notificaciones:', error);
        this.loadingNotifications = false;
      }
    });
  }

  onNotificationsMenuOpened(): void {
    const unread = this.notifications.filter((notification) => !notification.readAt && notification.status === 'pendiente');
    unread.forEach((notification) => {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: (response) => {
          if (response?.notification) {
            this.updateNotification(response.notification);
          }
        },
        error: (error) => console.error('Error marcando notificación como vista:', error)
      });
    });
  }

  respondToNotification(notification: NotificationItem, action: 'accept' | 'reject', event?: MouseEvent): void {
    event?.stopPropagation();

    const execute = () => {
      this.notificationService.respond(notification.id, action).subscribe({
        next: (response) => {
          if (response?.notification) {
            this.updateNotification(response.notification);
            this.loadNotifications();
          }
        },
        error: (error) => console.error('Error actualizando notificación:', error)
      });
    };

    if (action === 'reject') {
      this.confirmation
        .confirm({
          title: 'Rechazar participación',
          message: '¿Seguro que deseas rechazar tu participación en esta competición?',
          confirmText: 'Rechazar',
          confirmColor: 'warn'
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            execute();
          }
        });
      return;
    }

    execute();
  }

  notificationStatusLabel(notification: NotificationItem): string {
    switch (notification.status) {
      case 'aceptada':
        return 'Confirmada';
      case 'rechazada':
        return 'Rechazada';
      default:
        return 'Pendiente';
    }
  }

  private updateNotification(data: NotificationItem): void {
    const index = this.notifications.findIndex((item) => item.id === data.id);
    if (index !== -1) {
      this.notifications[index] = {
        ...this.notifications[index],
        ...data
      };
    }
  }

  private startNotificationPolling(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.stopNotificationPolling();
    this.notificationsTimer = setInterval(() => this.loadNotifications(), 60000);
  }

  private stopNotificationPolling(): void {
    if (this.notificationsTimer) {
      clearInterval(this.notificationsTimer);
      this.notificationsTimer = undefined;
    }
  }

  get profileRoute(): string {
    const user = this.authService.currentUser();
    if (user?.athleteId) {
      return '/mi-perfil/nadador';
    }
    return '/mi-perfil';
  }

  goToProfile(): void {
    this.router.navigate([this.profileRoute]);
  }
}
