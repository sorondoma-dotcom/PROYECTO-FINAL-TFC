import { Component, OnInit } from '@angular/core';
import { DatosService } from '../datos.service';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-ranking-nadadores',
  templateUrl: './ranking-nadadores.component.html',
  imports: [BrowserModule, FormsModule, ReactiveFormsModule],
  styleUrls: ['./ranking-nadadores.component.css']
})
export class RankingNadadoresComponent implements OnInit {
  // filtros
  gender: 'M' | 'F' = 'F';
  distance = '100';
  stroke = 'BACKSTROKE';
  poolConfiguration: 'LCM' | 'SCM' = 'LCM';
  limit = 50;

  // datos
  nadadores: any[] = [];
  loading = false;
  error: string | null = null;

  // opciones mínimas para selects
  genders = [{ val: 'F', label: 'Femenino' }, { val: 'M', label: 'Masculino' }];
  distances = ['50','100','200','400','800','1500'];
  strokes = [
    { val: 'BACKSTROKE', label: 'Backstroke' },
    { val: 'BREASTSTROKE', label: 'Breaststroke' },
    { val: 'BUTTERFLY', label: 'Butterfly' },
    { val: 'MEDLEY', label: 'Medley' },
    { val: 'FREESTYLE', label: 'Freestyle' },
    { val: 'FREESTYLE_RELAY', label: 'Freestyle Relay' },
    { val: 'MEDLEY_RELAY', label: 'Medley Relay' }
  ];
  pools = [{ val: 'LCM', label: '50m (LCM)' }, { val: 'SCM', label: '25m (SCM)' }];

  constructor(private datosService: DatosService) {}

  ngOnInit(): void {
    this.cargarRankings();
  }

  cargarRankings(): void {
    this.loading = true;
    this.error = null;
    this.nadadores = [];

    this.datosService.getRankings({
      gender: this.gender,
      distance: this.distance,
      stroke: this.stroke,
      poolConfiguration: this.poolConfiguration,
      limit: this.limit
    }).subscribe({
      next: (res) => {
        // respuesta esperada: { rankings: [...] } o directamente rankings en root
        this.nadadores = res?.rankings ?? res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'Error al obtener rankings';
        this.loading = false;
      }
    });
  }
}
