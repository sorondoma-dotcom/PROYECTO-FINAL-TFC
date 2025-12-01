import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Competition {
  id?: number;
  nombre: string;
  descripcion?: string;
  pais?: string;
  ciudad?: string;
  tipo_piscina: '25m' | '50m';
  fecha_inicio: string;
  fecha_fin?: string;
  lugar_evento?: string;
  estado?: 'pendiente' | 'en_curso' | 'finalizada' | 'cancelada';
  total_inscritos?: number;
  logo_path?: string | null;
  logo_url?: string | null;
}

export interface Inscription {
  id?: number;
  competicion_id: number;
  athlete_id: number;
  numero_dorsal?: number;
  estado_inscripcion?: 'inscrito' | 'confirmado' | 'retirado' | 'descalificado';
  notas?: string;
  inscrito_en?: string;
  confirmado_en?: string;
  athlete_name?: string;
  country_code?: string;
  gender?: string;
  image_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private readonly baseUrl = 'http://localhost/PROYECTO-FINAL-TFC/backend-php/auth-php/public/api';
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  // Competiciones - CRUD
  getAllCompetitions(estado?: string): Observable<any> {
    let url = `${this.baseUrl}/competitions`;
    if (estado) {
      url += `?estado=${estado}`;
    }
    return this.http.get<any>(url, this.httpOptions);
  }

  getCompetition(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/competitions/${id}`, this.httpOptions);
  }

  createCompetition(competition: Competition | FormData): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/competitions`, competition, this.httpOptions);
  }

  updateCompetition(id: number, competition: Partial<Competition>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/competitions/${id}`, competition, this.httpOptions);
  }

  deleteCompetition(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/competitions/${id}`, this.httpOptions);
  }

  // Inscripciones de atletas
  registerAthlete(competicionId: number, athleteId: number, numeroDorsal?: number, notas?: string): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/competitions/${competicionId}/athletes`,
      { athlete_id: athleteId, numero_dorsal: numeroDorsal, notas },
      this.httpOptions
    );
  }

  unregisterAthlete(inscripcionId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/inscriptions/${inscripcionId}`, this.httpOptions);
  }

  updateInscription(inscripcionId: number, data: Partial<Inscription>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/inscriptions/${inscripcionId}`, data, this.httpOptions);
  }
}
