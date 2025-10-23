import { loadGoogleCharts } from './google-charts-loader';
import { Component, Input, Output, EventEmitter, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-timeline-chart',
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './timeline-chart.component.html',
  styleUrls: ['./timeline-chart.component.scss']
})
export class TimelineChartComponent implements AfterViewInit, OnChanges {
  @ViewChild('googleLineChart', { static: false }) chartDiv!: ElementRef;

  async ngOnChanges(changes: SimpleChanges) {
    await loadGoogleCharts();
    setTimeout(() => this.drawGoogleLineChart(), 0);
  }

  ngAfterViewInit() {
    this.drawGoogleLineChart();
  }

  drawGoogleLineChart() {
    console.log('[TimelineChart] drawGoogleLineChart', { times: this.times });
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
    this.times.forEach(t => {
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
      vAxis: { title: 'Tiempo (segundos)' }
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

