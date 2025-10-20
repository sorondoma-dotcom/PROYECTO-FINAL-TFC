import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  url = "http://localhost:3000/api/natacion";
  constructor(private http:HttpClient ) { }
  getDatosApi(){
    return this.http.get(this.url);
  }
  getCompeticionDetalle(id: string): Observable<any> {
    return this.http.get(`${this.url}/${id}`);
  }
}
