import { loadGoogleCharts } from './google-charts-loader';
import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-timeline-chart',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, FormsModule],
  templateUrl: './timeline-chart.component.html',
  styleUrls: ['./timeline-chart.component.scss']
})
export class TimelineChartComponent implements AfterViewInit, OnChanges {
  @ViewChild('googleLineChart', { static: false }) chartDiv!: ElementRef;

  async ngOnChanges(changes: SimpleChanges) {
    // Cuando cambian los inputs, recargar Google Charts y recalcular años
    await loadGoogleCharts();
    this.computeYearsFromTimes();
    setTimeout(() => this.drawGoogleLineChart(), 0);
  }

  ngAfterViewInit() {
    this.drawGoogleLineChart();
  }

  drawGoogleLineChart() {
    const timesToPlot = this.getFilteredTimes();
    console.log('[TimelineChart] drawGoogleLineChart', { times: this.times, filtered: timesToPlot, selectedYear: this.selectedYear });
    if (!window.google || !window.google.charts) {
      console.warn('[TimelineChart] Google Charts no está cargado');
      return;
    }
    const chartContainer = document.getElementById('google-line-chart');
    if (!chartContainer) {
      console.warn('[TimelineChart] No existe el div google-line-chart');
      return; // Solo dibuja si existe el div
    }
    const dataArr: (string | number)[][] = [['Fecha', 'Tiempo']];
    timesToPlot.forEach(t => {
      let timeStr = t.time || '';
      timeStr = timeStr.replace('WR', '').trim();
      let timeFloat = this.parseTimeToFloat(timeStr);
      dataArr.push([String(t.date), Number(timeFloat)]);
    });
    console.log('[TimelineChart] Datos para la gráfica', dataArr);
    const data = window.google.visualization.arrayToDataTable(dataArr);
    const options = {
      title: 'Evolución de tiempos',
      curveType: 'function',
      legend: { position: 'bottom' },
      width: '100%',
      height: 320,
      hAxis: { title: 'Fecha' },
      vAxis: { title: 'Tiempo (segundos)', direction: -1 }
    };
    const chart = new window.google.visualization.LineChart(chartContainer);
    chart.draw(data, options);
  }

  parseTimeToFloat(time: string): number {
    if (!time) return 0;
    const parts = time.split(':');
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10);
      const sec = parseFloat(parts[1]);
      return min * 60 + sec;
    }
    return parseFloat(time);
  }
  @Input() name: any;
  @Input() times: any[] = [];
  @Output() close = new EventEmitter<void>();

  // Filtro por año
  years: number[] = [];
  selectedYear: number | null = null;

  computeYearsFromTimes() {
    console.log(this.times);
    const yearsSet = new Set<number>();
    (this.times || []).forEach(t => {
      const y = this.getYearFromString(t.date );
      if (y) yearsSet.add(y);
    });
    // Ordenar de más reciente a más antiguo para mostrar primero los años más nuevos
    this.years = Array.from(yearsSet).sort((a,b) => b - a);
  }

  getYearFromString(s: any): number | null {
    if (!s) return null;
    // Intentar parseo mediante Date
    const d = new Date(String(s));
    if (!isNaN(d.getTime())) return d.getFullYear();
    // Fallback: extraer 4 dígitos
    const m = String(s).match(/(19|20)\d{2}/);
    if (m) return parseInt(m[0], 10);
    return null;
  }

  getFilteredTimes() {
    if (!this.selectedYear) return this.times || [];
    // Convertir selectedYear a number para comparar correctamente
    const year = Number(this.selectedYear);
    return (this.times || []).filter(t => this.getYearFromString(t.date) === year);
  }

  // Inyección opcional de datos cuando se abre como MatDialog
  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private dialogRef: MatDialogRef<TimelineChartComponent>
  ) {
    // Si el componente se instancia vía MatDialog, usar dialogData para rellenar inputs
    if (dialogData) {
      this.name = dialogData.name ?? this.name;
      this.times = dialogData.times ?? this.times;
    }
    console.log('[TimelineChart] Constructor', { name: this.name, times: this.times });
    // Si los datos vienen por MAT_DIALOG_DATA, calcular los años inmediatamente
    if (this.times && this.times.length) {
      this.computeYearsFromTimes();
    }
    // Esperar a que el modal esté abierto para dibujar la gráfica
    if (this.dialogRef && this.dialogRef.afterOpened) {
      this.dialogRef.afterOpened().subscribe(() => {
        loadGoogleCharts().then(() => {
          setTimeout(() => this.drawGoogleLineChart(), 0);
        });
      });
    }
  }

  // Método de ayuda para cerrar cuando se usa MatDialog
  closeDialog() {
    if (this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.close.emit();
    }
  }
}

