import { DatosService } from './../datos.service';
import { Component } from '@angular/core';
@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  competiciones:any;

  constructor(private datos:DatosService) {
    this.datos.getDatosApi().subscribe((data:any)=>{
      this.competiciones = data.competiciones;

    });
}

}
