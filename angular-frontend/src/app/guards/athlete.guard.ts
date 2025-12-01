import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const athleteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    const user = authService.currentUser();
    const role = (user?.role ?? '').toString().toLowerCase();
    const allowedRoles = ['usuario', 'user', 'nadador'];
    if (user?.athleteId || allowedRoles.includes(role)) {
      return true;
    }
  }

  router.navigate(['/']);
  return false;
};
