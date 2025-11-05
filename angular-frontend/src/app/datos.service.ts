import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  private url = "http://localhost:3000/api/natacion";
  private rankingsUrl = "http://localhost:3000/api/world-aquatics/rankings";
  private competitionsUrl = "http://localhost:3000/api/world-aquatics/competitions";

  constructor(private http:HttpClient ) { }
  getDatosApi(){
    return this.http.get(this.url);
  }
  // getCompeticionDetalle(id: string): Observable<any> {
  //   return this.http.get(`${this.url}/${id}`);
  // }

  // nuevo método: obtiene rankings desde la API pasando filtros
  getRankings(params: {
    gender: 'M' | 'F',
    distance: string,
    stroke: string,
    poolConfiguration: 'LCM' | 'SCM',
    limit?: number,
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
    if (params.year) httpParams = httpParams.set('year', params.year);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
    if (params.clearCache) httpParams = httpParams.set('clearCache', 'true');

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
    if (filters.discipline) params = params.set('disciplines', filters.discipline);
    if (filters.refresh) params = params.set('refresh', 'true');
    if (filters.cacheTtl != null) params = params.set('cacheTtl', String(filters.cacheTtl));

    return this.http.get(this.competitionsUrl, { params });
  }
}
