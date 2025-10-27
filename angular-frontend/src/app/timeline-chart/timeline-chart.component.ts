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

  /**
   * ngOnChanges
   * - Lifecycle hook llamado cuando cambian las @Input().
   * - Se asegura de cargar Google Charts, recalcula la lista de años disponibles
   *   y programa el redibujo de la gráfica.
   * - Receives: cambios (SimpleChanges).
   */
  async ngOnChanges(changes: SimpleChanges) {
    // Cuando cambian los inputs, recargar Google Charts y recalcular años
    await loadGoogleCharts();
    this.computeYearsFromTimes();
    setTimeout(() => this.drawGoogleLineChart(), 0);
  }

  /**
   * ngAfterViewInit
   * - Lifecycle hook llamado después de que la vista del componente esté inicializada.
   * - Inicia el dibujado inicial de la gráfica (usa el ViewChild).
   */
  ngAfterViewInit() {
    this.drawGoogleLineChart();
  }

  /**
   * drawGoogleLineChart
   * - Construye un DataTable tipado (posición, tiempo, tooltip) y dibuja la gráfica.
   * - Mantiene el eje X como posición (mejor → peor) para que la línea no salte por
   *   fechas fuera de orden.
   * - Crea ticks legibles para el eje X (fechas/posiciones) y el eje Y (tiempos
   *   formateados con formatSeconds).
   * - Comprueba precondiciones: Google Charts cargado y chartDiv disponible;
   *   muestra mensaje si no hay datos.
   */
  drawGoogleLineChart() {
    const timesToPlot = this.getFilteredTimes(); // ya ordenado mejor->peor
    console.log('[TimelineChart] drawGoogleLineChart', { times: this.times, filtered: timesToPlot, selectedYear: this.selectedYear });

    if (!window.google || !window.google.charts) {
      console.warn('[TimelineChart] Google Charts no está cargado');
      return;
    }

    // Cambiar a uso exclusivo de ViewChild (más claro y reactivo)
    const chartContainer = this.chartDiv?.nativeElement as HTMLElement | undefined;
    if (!chartContainer) {
      console.warn('[TimelineChart] No existe el div google-line-chart (ViewChild no encontrado)');
      return;
    }

    // Usamos índice (posición) como eje X para mantener mejor->peor en el orden de los puntos
    const dataTable = new window.google.visualization.DataTable();
    dataTable.addColumn('number', 'Pos');            // eje X: posición (1 = mejor)
    dataTable.addColumn('number', 'Tiempo (s)');     // eje Y: tiempo en segundos
    dataTable.addColumn({ type: 'string', role: 'tooltip' }); // tooltip con fecha + tiempo

    const rows: (number | string)[][] = [];
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    timesToPlot.forEach((t, i) => {
      const timeStr = (t.time || '').toString().replace(/WR/gi, '').trim();
      const timeFloat = this.parseTimeToFloat(timeStr);
      const dateObj = new Date(String(t.date));
      const dateStr = (!isNaN(dateObj.getTime()))
        ? `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
        : (this.getYearFromString(t.date) ? String(this.getYearFromString(t.date)) : String(t.date));
      const tooltip = `${this.formatSeconds(timeFloat)} — ${dateStr}`;
      rows.push([i + 1, Number(timeFloat), tooltip]);
    });

    if (rows.length === 0) {
      chartContainer.innerHTML = '<div style="padding:16px;color:#666;">No hay datos para mostrar</div>';
      return;
    }

    dataTable.addRows(rows);

    // Crear ticks para hAxis mostrando algunas fechas/posiciones (evitar solapamiento)
    const total = rows.length;
    const tickStep = Math.ceil(Math.max(1, total / 8)); // mostrar hasta 8 ticks
    const hTicks: { v: number; f?: string }[] = [];
    for (let i = 0; i < total; i += tickStep) {
      const r = rows[i];
      const pos = Number(r[0]);
      const tooltip = String(r[2]);
      // extraer la parte de fecha del tooltip (después del "—")
      const f = tooltip.includes('—') ? tooltip.split('—')[1].trim() : String(pos);
      hTicks.push({ v: pos, f });
    }

    // Calcular ticks Y y formato (se reutiliza formatSeconds)
    const values = rows.map(r => Number(r[1]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.0001, max - min);
    const preferred = [1, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = preferred.find(s => span / s <= 6) || Math.ceil(span / 6);
    const start = Math.floor(min / step) * step;
    const vTicks: { v: number; f: string }[] = [];
    for (let v = start; v <= max + 0.0001; v += step) {
      vTicks.push({ v, f: this.formatSeconds(v) });
    }

    const options = {
      title: 'Evolución de tiempos (pos: mejor→peor)',
      curveType: 'function',
      legend: { position: 'bottom' },
      width: '100%',
      height: 320,
      hAxis: {
        ticks: hTicks,
        viewWindow: { min: 0.5, max: total + 0.5 }
      },
      vAxis: { title: 'Tiempo', direction: -1, ticks: vTicks },
      tooltip: { isHtml: false }
    };

    const chart = new window.google.visualization.LineChart(chartContainer);
    chart.draw(dataTable, options);
  }

  /**
   * formatSeconds
   * - Convierte un valor en segundos (número) a una etiqueta legible:
   *   - Si >= 60 → "m:ss" (añade decimales si hay fracción).
   *   - Si < 60  → "ss" o "ss.xx s".
   * - Usado para labels en vAxis y para tooltips.
   */
  formatSeconds(totalSeconds: number): string {
    if (!isFinite(totalSeconds)) return '';
    const negative = totalSeconds < 0;
    const s = Math.abs(totalSeconds);
    const minutes = Math.floor(s / 60);
    const seconds = s - minutes * 60;

    // mostrar centésimas si hay parte fraccionaria
    const hasFraction = Math.abs(seconds - Math.floor(seconds)) > 1e-9;
    const secondsStr = hasFraction ? seconds.toFixed(2) : seconds.toFixed(0);

    if (minutes > 0) {
      // garantizar dos dígitos en segundos
      const secParts = Number(secondsStr).toFixed(hasFraction ? 2 : 0);
      const secPad = (+secParts < 10 && !secParts.includes('.')) ? ('0' + secParts) : secParts;
      return (negative ? '-' : '') + `${minutes}:${secPad}`;
    }

    return (negative ? '-' : '') + (hasFraction ? `${secondsStr}s` : `${Math.round(seconds)}s`);
  }

  /**
   * parseTimeToFloat
   * - Parsea cadenas de tiempo variadas a un número de segundos:
   *   - Soporta formatos con ':' (hh:mm:ss, mm:ss, m:ss.xx).
   *   - Soporta notaciones con apóstrofo "1'23" y con letras "1m23.45s".
   *   - Normaliza comas decimales y quita marcas como "WR".
   * - Devuelve 0 para entradas inválidas.
   */
  parseTimeToFloat(time: string): number {
    if (!time) return 0;
    let s = String(time).trim();
    // Normalizaciones comunes
    s = s.replace(',', '.');            // coma decimal -> punto
    s = s.replace(/WR/gi, '').trim();  // quitar marcas como WR
    s = s.replace(/’/g, "'").replace(/'/g, ':'); // 1'23 -> 1:23

    // Si contiene ':', soporta hh:mm:ss o mm:ss(.ms)
    if (s.includes(':')) {
      const parts = s.split(':').map(p => p.trim()).filter(p => p.length);
      if (parts.length === 3) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const sec = parseFloat(parts[2]) || 0;
        return h * 3600 + m * 60 + sec;
      }
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10) || 0;
        const sec = parseFloat(parts[1]) || 0;
        return m * 60 + sec;
      }
      // por si hay sólo un valor tras split
      const maybeSec = parseFloat(parts[0]);
      return isNaN(maybeSec) ? 0 : maybeSec;
    }

    // Formatos con letras: "1m23.45s", "1 min 23s", "23.45s"
    const minMatch = s.match(/(\d+)(?=\s*m(?:in)?\b)/i);
    const secMatch = s.match(/(\d+(?:\.\d+)?)(?=\s*s\b)/i);
    if (minMatch || secMatch) {
      const m = minMatch ? Number(minMatch[1]) : 0;
      const sec = secMatch ? Number(secMatch[1]) : 0;
      return m * 60 + sec;
    }

    // Sólo segundos o número simple
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
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

  /**
   * getYearFromString
   * - Intenta obtener el año de una cadena:
   *   1) intenta parsear como Date y devolver getFullYear() si válido;
   *   2) si no, busca una coincidencia de 4 dígitos tipo 19xx/20xx y la devuelve.
   * - Devuelve null si no se puede extraer un año.
   */
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

  /**
   * getFilteredTimes
   * - Devuelve la lista de tiempos filtrada por año (si hay selectedYear) y
   *   ordenada por tiempo ascendente (mejor → peor).
   * - Orden estable: en caso de empate se mantiene el orden original.
   * - Utiliza parseTimeToFloat para convertir las cadenas de tiempo a segundos.
   */
  getFilteredTimes() {
    const all = this.times || [];
    const year = this.selectedYear ? Number(this.selectedYear) : null;

    // Filtrar por año si hay uno seleccionado
    const filtered = year ? all.filter(t => this.getYearFromString(t.date) === year) : all.slice();

    // Mapear con valor numérico del tiempo y índice original para orden estable
    const mapped = filtered.map((t, idx) => {
      const timeStr = (t.time || '').toString().replace(/WR/gi, '').trim();
      const value = this.parseTimeToFloat(timeStr);
      return { item: t, value, idx };
    });

    // Ordenar por tiempo ascendente (mejor -> peor). Si empate, usar índice original.
    mapped.sort((a, b) => {
      if (a.value === b.value) return a.idx - b.idx;
      return a.value - b.value;
    });

    // Devolver solo los objetos ordenados, sin mutar la lista original
    return mapped.map(m => m.item);
  }

  /**
   * constructor
   * - Inyecta MAT_DIALOG_DATA y MatDialogRef si se usa como dialog.
   * - Si dialogData está presente, inicializa name y times.
   * - Calcula years inmediatamente si ya hay datos y se suscribe a afterOpened
   *   para cargar Google Charts y dibujar la gráfica cuando el modal se abre.
   */
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

  /**
   * closeDialog
   * - Método helper para cerrar el dialogo si existe; si no, emite el evento close.
   */
  closeDialog() {
    if (this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.close.emit();
    }
  }
}

