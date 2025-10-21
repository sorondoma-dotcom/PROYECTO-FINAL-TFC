import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { CommonModule } from '@angular/common';

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
    MatBadgeModule
  ],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent {
  menuOpen = false;
  isDarkMode = false;

  menuItems = [
    { label: 'Inicio', icon: 'home', route: '/' },
    { label: 'Competiciones', icon: 'pool', route: '/competiciones' },
    { label: 'Nadadores', icon: 'person', route: '/nadadores' },
    { label: 'Estadísticas', icon: 'analytics', route: '/estadisticas' },
    { label: 'Contacto', icon: 'email', route: '/contacto' }
  ];

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
  

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    // Aquí podrías implementar lógica para cambiar el tema global
    document.body.classList.toggle('dark-theme');
  }
}
