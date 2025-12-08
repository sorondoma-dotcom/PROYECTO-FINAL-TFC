import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { API_CONFIG, resolvePhpAssetUrl } from '../config/api.config';

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
  private readonly baseUrl = API_CONFIG.phpApiBase;
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
      tap((res: any) => {
        if (res?.user?.isVerified) {
          this.saveUser(res.user);
        }
      })
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

  sendVerificationCode(email: string): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/email/send-code`,
      { email },
      this.httpOptions
    );
  }

  verifyEmail(email: string, code: string): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/email/verify`,
      { email, code },
      this.httpOptions
    ).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  fetchCurrentUser(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/me`, this.httpOptions).pipe(
      tap((res: any) => this.saveUser(res?.user))
    );
  }

  updateProfile(payload: { name?: string | null; lastName?: string | null }, avatar?: File | null): Observable<any> {
    const formData = new FormData();
    if (payload.name !== undefined && payload.name !== null) {
      formData.append('name', payload.name);
    }
    if (payload.lastName !== undefined && payload.lastName !== null) {
      formData.append('lastName', payload.lastName);
    }
    if (avatar instanceof File) {
      formData.append('avatar', avatar);
    }

    return this.http.post(`${this.baseUrl}/auth/profile`, formData, this.httpOptions).pipe(
      tap((res: any) => this.saveUser(res?.user))
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
      // Clone the user object to avoid side effects
      const userToSave = { ...user };
      
      // Resolve avatar URLs through the proxy
      if (userToSave.avatarUrl) {
        userToSave.avatarUrl = resolvePhpAssetUrl(userToSave.avatarUrl);
      }
      if (userToSave.avatarThumbUrl) {
        userToSave.avatarThumbUrl = resolvePhpAssetUrl(userToSave.avatarThumbUrl);
      }
      if (userToSave.avatarLargeUrl) {
        userToSave.avatarLargeUrl = resolvePhpAssetUrl(userToSave.avatarLargeUrl);
      }
      if (userToSave.avatarFullUrl) {
        userToSave.avatarFullUrl = resolvePhpAssetUrl(userToSave.avatarFullUrl);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(userToSave));
    }
  }

  private clearUser(): void {
    localStorage.removeItem(this.storageKey);
  }

  updateCachedUser(user: any): void {
    this.saveUser(user);
  }
}
