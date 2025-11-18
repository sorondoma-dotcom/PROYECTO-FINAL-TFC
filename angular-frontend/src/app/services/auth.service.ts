import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest extends LoginRequest {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // URL directa al backend PHP en XAMPP
  private readonly baseUrl = 'http://localhost/backend-php/auth-php/public/api';

  // Si prefieres usar proxy, cambia a: private readonly baseUrl = '/api';
  // Y ejecuta: ng serve --proxy-config proxy.conf.json

  private readonly storageKey = 'auth_user';

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, payload).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  register(payload: RegisterRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, payload).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.storageKey);
  }

  currentUser(): any | null {
    const raw = localStorage.getItem(this.storageKey);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveUser(user: any): void {
    if (user) {
      localStorage.setItem(this.storageKey, JSON.stringify(user));
    }
  }
}
