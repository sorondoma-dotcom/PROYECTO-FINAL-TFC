import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

export type NotificationStatus = 'pendiente' | 'aceptada' | 'rechazada' | 'leida';

export interface NotificationItem {
  id: number;
  athleteId: number;
  competitionId: number;
  inscripcionId: number;
  type: string;
  status: NotificationStatus;
  title: string;
  message?: string;
  readAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  competitionName?: string | null;
  competitionStart?: string | null;
  competitionEnd?: string | null;
  canRespond: boolean;
}

export interface NotificationsPayload {
  notifications: NotificationItem[];
  pending: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly baseUrl = API_CONFIG.phpApiBase;
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<NotificationsPayload> {
    return this.http.get<NotificationsPayload>(`${this.baseUrl}/notifications`, this.httpOptions);
  }

  markAsRead(notificationId: number): Observable<{ notification: NotificationItem }> {
    return this.http.post<{ notification: NotificationItem }>(
      `${this.baseUrl}/notifications/${notificationId}/mark-read`,
      {},
      this.httpOptions
    );
  }

  respond(notificationId: number, action: 'accept' | 'reject'): Observable<{ notification: NotificationItem }> {
    return this.http.post<{ notification: NotificationItem }>(
      `${this.baseUrl}/notifications/${notificationId}/respond`,
      { action },
      this.httpOptions
    );
  }
}
