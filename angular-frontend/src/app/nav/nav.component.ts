import { Component, Inject, PLATFORM_ID } from '@angular/core';
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
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ConfirmationService } from '../shared/services/confirmation.service';

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
    RouterOutlet,
    RouterLink
  ],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent {
  menuOpen = false;
  isDarkMode = false;
  theme: string = 'light';

  menuItems = [
    { label: 'Inicio', icon: 'home', route: '/' },
    { label: 'Competiciones', icon: 'pool', route: '/competiciones' },
    { label: 'Nadadores', icon: 'person', route: '/nadadores' },
    { label: 'Estadísticas', icon: 'analytics', route: '/estadisticas' },
    { label: 'Contacto', icon: 'email', route: '/contacto' }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    public authService: AuthService,
    private router: Router,
    private confirmation: ConfirmationService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.theme = localStorage.getItem('theme') || 'light';
      this.isDarkMode = this.theme === 'dark';
      document.body.classList.toggle('dark-theme', this.isDarkMode);
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
      });
  }
}
