import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../services/auth.service';
import { SessionExpirationService } from './session-expiration.service';
import { SessionExpiredDialogComponent } from './session-expired-dialog.component';

@Injectable()
export class SessionExpiredInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private sessionExpirationService: SessionExpirationService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        // Detectar 401 con mensaje de sesión cerrada
        if (err && err.status === 401 && this.isBackendRequest(req.url)) {
          const serverMsg = err.error?.error || err.statusText || '';
          const lowered = serverMsg.toString().toLowerCase();
          
          // Verificar si es un error de sesión caducada
          if (lowered.includes('sesion') || lowered.includes('sesión') || 
              lowered.includes('session') || lowered.includes('autenticar')) {
            
            // Evitar abrir múltiples diálogos si ya hay uno abierto
            if (!this.sessionExpirationService.isOpen()) {
              this.sessionExpirationService.setOpen(true);
              
              // Intentar cerrar sesión en el backend (silenciosamente)
              try { 
                this.authService.logout()
                  .pipe(catchError(() => of(null)))
                  .subscribe({});
              } catch {}
              
              // Limpiar localStorage
              try { 
                localStorage.removeItem('auth_user'); 
              } catch {}

              // Abrir diálogo modal (no se puede cerrar hasta que el usuario actúe)
              const dialogRef = this.dialog.open(SessionExpiredDialogComponent, { 
                disableClose: true,
                width: '400px'
              });
              
              dialogRef.afterClosed().subscribe(() => {
                this.sessionExpirationService.setOpen(false);
                // El componente del diálogo ya se encarga de navegar a /auth
              });
            }
          }
        }
        
        return throwError(() => err);
      })
    );
  }

  private isBackendRequest(url: string): boolean {
    const normalized = url.toLowerCase();
    return (
      normalized.includes('/auth-api/') ||
      normalized.includes('/backend-php/auth-php/public/api')
    );
  }
}
