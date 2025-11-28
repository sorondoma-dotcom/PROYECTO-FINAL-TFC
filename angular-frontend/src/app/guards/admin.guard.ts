import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    // Verificar si hay sesión iniciada
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/auth']);
      return false;
    }

    // Verificar si el usuario tiene rol de admin
    const currentUser = this.auth.currentUser();
    if (!currentUser || !currentUser.isAdmin) {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }
}
