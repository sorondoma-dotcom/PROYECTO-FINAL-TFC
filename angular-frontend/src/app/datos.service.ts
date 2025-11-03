import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  private url = "http://localhost:3000/api/natacion";
  private rankingsUrl = "http://localhost:3000/api/world-aquatics/rankings";

  constructor(private http:HttpClient ) { }
  getDatosApi(){
    return this.http.get(this.url);
  }
  getCompeticionDetalle(id: string): Observable<any> {
    return this.http.get(`${this.url}/${id}`);
  }

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
}
