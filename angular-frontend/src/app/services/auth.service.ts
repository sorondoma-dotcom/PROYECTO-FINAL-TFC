import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

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
  private readonly baseUrl = 'http://localswimlive/api';
  private readonly storageKey = 'auth_user';
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, payload, this.httpOptions).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  register(payload: RegisterRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, payload, this.httpOptions).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/logout`, {}, this.httpOptions).pipe(
      finalize(() => this.clearUser())
    );
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/password-reset`,
      { email },
      this.httpOptions
    );
  }

  resetPassword(code: string, newPassword: string): Observable<any> {
    return this.http.put(
      `${this.baseUrl}/password-reset`,
      { code, newPassword },
      this.httpOptions
    );
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

  private clearUser(): void {
    localStorage.removeItem(this.storageKey);
  }
}
