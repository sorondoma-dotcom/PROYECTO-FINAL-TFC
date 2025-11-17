import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompetitionFilters } from '../models/filters/competition-filters.interface';
import { RankingFilters } from '../models/filters/ranking-filters.interface';

@Injectable({
  providedIn: 'root'
})
export class WorldAquaticsApiService {
  private readonly baseUrl = 'http://localhost:3000/api/world-aquatics';

  constructor(private http: HttpClient) {}

  getCompetitions(filters: CompetitionFilters = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.group) params = params.set('group', filters.group);
    if (filters.year != null) params = params.set('year', String(filters.year));
    if (filters.month) params = params.set('month', filters.month);
    if (filters.disciplines) params = params.set('disciplines', filters.disciplines);
    if (filters.refresh) params = params.set('refresh', 'true');
    if (filters.cacheTtl != null) params = params.set('cacheTtl', String(filters.cacheTtl));
    return this.http.get(`${this.baseUrl}/competitions`, { params });
  }

  getCompetitionResultEvents(query: { slug?: string; url?: string; refresh?: boolean } = {}): Observable<any> {
    let params = new HttpParams();
    if (query.slug) params = params.set('slug', query.slug);
    if (query.url) params = params.set('url', query.url);
    if (query.refresh) params = params.set('refresh', 'true');
    return this.http.get(`${this.baseUrl}/competitions/results`, { params });
  }

  getCompetitionEventResults(query: {
    eventGuid: string;
    slug?: string;
    url?: string;
    unitId?: string;
    refresh?: boolean;
  }): Observable<any> {
    if (!query.eventGuid) {
      throw new Error('Se requiere el identificador del evento (eventGuid)');
    }
    let params = new HttpParams().set('eventGuid', query.eventGuid);
    if (query.slug) params = params.set('slug', query.slug);
    if (query.url) params = params.set('url', query.url);
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.refresh) params = params.set('refresh', 'true');
    return this.http.get(`${this.baseUrl}/competitions/results/event`, { params });
  }

  getRankings(filters: RankingFilters): Observable<any> {
    let params = new HttpParams()
      .set('gender', filters.gender)
      .set('distance', filters.distance)
      .set('stroke', filters.stroke)
      .set('poolConfiguration', filters.poolConfiguration);

    if (filters.limit != null) params = params.set('limit', String(filters.limit));
    if (filters.year) params = params.set('year', filters.year);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.clearCache) params = params.set('clearCache', 'true');

    return this.http.get(`${this.baseUrl}/rankings`, { params });
  }
}
