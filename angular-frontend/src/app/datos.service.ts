import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  url = "http://localhost:3000/api/natacion";
  constructor(private http:HttpClient ) { }
  getDatosApi(){
    return this.http.get(this.url);
  }
}
