import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './nav/nav.component';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, NavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'angular-frontend';
  toggleTheme(): void {
    document.body.classList.toggle('dark-theme');
  }
 constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Solo se ejecuta en el navegador
      const theme = localStorage.getItem('theme') || 'light';
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }




}
