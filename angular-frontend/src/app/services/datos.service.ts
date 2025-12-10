import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  private readonly nodeApiBase = API_CONFIG.nodeApiBase;
  private readonly phpApiBase = API_CONFIG.phpApiBase;
  private readonly worldAquaticsBase = `${this.nodeApiBase}/world-aquatics`;

  private readonly natacionUrl = `${this.nodeApiBase}/natacion`;
  private readonly rankingsUrl = `${this.phpApiBase}/rankings`;
  private readonly athleteResultsUrl = `${this.phpApiBase}/athletes/results`;
  private readonly athletesUrl = `${this.worldAquaticsBase}/athletes`;
  private readonly competitionsUrl = `${this.worldAquaticsBase}/competitions`;
  private readonly competitionResultsUrl = `${this.worldAquaticsBase}/competitions/results`;
  private readonly competitionEventResultsUrl = `${this.worldAquaticsBase}/competitions/results/event`;

  constructor(private http:HttpClient ) { }
  getDatosApi(){
    return this.http.get(this.natacionUrl);
  }
  getCompeticionDetalle(id: string): Observable<any> {
    return this.http.get(`${this.natacionUrl}/${id}`);
  }

  // nuevo método: obtiene rankings desde la API pasando filtros
  getRankings(params: {
    gender: 'M' | 'F',
    distance: string,
    stroke: string,
    poolConfiguration: 'LCM' | 'SCM',
    limit?: number,
    offset?: number,
    year?: string,
    startDate?: string,
    endDate?: string,
    clearCache?: boolean
  }): Observable<any> {
    let httpParams = new HttpParams()
      .set('gender', params.gender)
      .set('distance', params.distance)
      .set('stroke', params.stroke)
      .set('poolConfiguration', params.poolConfiguration);

    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset != null) httpParams = httpParams.set('offset', String(params.offset));
    if (params.year) httpParams = httpParams.set('year', params.year);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);

    return this.http.get(this.rankingsUrl, { params: httpParams });
  }

  getWorldAquaticsCompetitions(filters: {
    group?: string;
    year?: number | string;
    month?: string;
    discipline?: string;
    refresh?: boolean;
    cacheTtl?: number;
  } = {}): Observable<any> {
    let params = new HttpParams();

    if (filters.group) params = params.set('group', filters.group);
    if (filters.year != null) params = params.set('year', String(filters.year));
    if (filters.month) params = params.set('month', filters.month);
    if (filters.discipline) params = params.set('discipline', filters.discipline);
    if (filters.refresh) params = params.set('refresh', 'true');
    if (filters.cacheTtl != null) params = params.set('cacheTtl', String(filters.cacheTtl));

    return this.http.get(this.competitionsUrl, { params });
  }

  getCompetitionResultEvents(options: {
    slug?: string;
    url?: string;
    refresh?: boolean;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (options.slug) params = params.set('slug', options.slug);
    if (options.url) params = params.set('url', options.url);
    if (options.refresh) params = params.set('refresh', 'true');
    return this.http.get(this.competitionResultsUrl, { params });
  }

  getCompetitionEventResults(options: {
    eventGuid: string;
    slug?: string;
    url?: string;
    unitId?: string;
    refresh?: boolean;
  }): Observable<any> {
    if (!options.eventGuid) {
      throw new Error('Se requiere el identificador del evento (eventGuid)');
    }
    let params = new HttpParams().set('eventGuid', options.eventGuid);
    if (options.slug) params = params.set('slug', options.slug);
    if (options.url) params = params.set('url', options.url);
    if (options.unitId) params = params.set('unitId', options.unitId);
    if (options.refresh) params = params.set('refresh', 'true');
    return this.http.get(this.competitionEventResultsUrl, { params });
  }

  getAthletes(filters: {
    gender?: string;
    discipline?: string;
    nationality?: string;
    name?: string;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.gender) params = params.set('gender', filters.gender);
    if (filters.discipline) params = params.set('discipline', filters.discipline);
    if (filters.nationality) params = params.set('nationality', filters.nationality);
    if (filters.name) params = params.set('name', filters.name);
    return this.http.get(this.athletesUrl, { params });
  }

  postHighlightedRankings(payload: any): Observable<any> {
    const url = `${this.rankingsUrl}/highlighted`;
    return this.http.post(url, payload);
  }

  getAthleteResults(athleteId: number): Observable<any> {
    return this.http.get(this.athleteResultsUrl, {
      params: new HttpParams().set('athleteId', String(athleteId))
    });
  }

  getAthleteResultsByName(athleteName: string): Observable<any> {
    return this.http.get(this.athleteResultsUrl, {
      params: new HttpParams().set('name', athleteName)
    });
  }

  getAthleteProfile(athleteId: number): Observable<any> {
    return this.http.get(`${this.phpApiBase}/athletes/${athleteId}/profile`);
  }

  getCurrentAthleteProfile(): Observable<any> {
    return this.http.get(`${this.phpApiBase}/athletes/me`, {
      withCredentials: true
    });
  }

  getOlympicRecordLeader(): Observable<any> {
    return this.http.get(`${this.phpApiBase}/stats/olympic-records`);
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.phpApiBase}/stats/dashboard`);
  }

  /**
   * Obtiene sugerencias de inscripción para un atleta en una competición
   */
  getInscriptionSuggestions(athleteId: number, competicionId: number): Observable<any> {
    return this.http.get(`${this.phpApiBase}/athletes/${athleteId}/competitions/${competicionId}/suggestions`);
  }
}
