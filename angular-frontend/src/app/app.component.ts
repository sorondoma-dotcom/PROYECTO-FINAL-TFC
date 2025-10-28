import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './nav/nav.component';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [NavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'angular-frontend';
  toggleTheme(): void {
    document.body.classList.toggle('dark-theme');
  }
 constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Solo se ejecuta en el navegador
      const theme = localStorage.getItem('theme') || 'light';
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }




}
