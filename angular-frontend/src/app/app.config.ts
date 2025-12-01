import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { routes } from './app.routes';
// import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { SessionExpiredInterceptor } from './core/session-expired.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // provideClientHydration(withEventReplay()), // Comentado temporalmente para evitar errores SSR
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: SessionExpiredInterceptor, multi: true },
    importProvidersFrom(MatDialogModule, MatButtonModule),
    provideAnimations()
  ]
};
