import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatosService } from '../services/datos.service';
import {
  CompetitionMeta,
  ResultEventSummary,
  ResultTable,
  ResultUnit,
  ResultRow,
} from '../models';

@Component({
  selector: 'app-resultado-prueba',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatRadioModule
  ],
  templateUrl: './resultado-prueba.component.html',
  styleUrls: ['./resultado-prueba.component.scss']
})
export class ResultadoPruebaComponent implements OnInit {
  private readonly datos = inject(DatosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  competition?: CompetitionMeta;
  events: ResultEventSummary[] = [];
  selectedEventGuid: string | null = null;
  selectedUnitId: string | null = null;
  currentTable: ResultTable | null = null;

  eventsLoading = false;
  tableLoading = false;
  eventsError: string | null = null;
  tableError: string | null = null;

  filterText = '';
  eventSearch = '';
  unitSearch = '';
  private identifier: { slug?: string; url?: string } = {};

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const slug = params.get('slug') || '';
        const url = params.get('url') || '';
        const navigationState =
          (this.router.getCurrentNavigation()?.extras?.state as
            | { competition?: CompetitionMeta }
            | undefined) ?? undefined;
        const historyCompetition = this.getHistoryCompetitionState();
        const name =
          params.get('name') ||
          navigationState?.competition?.name ||
          historyCompetition?.name ||
          null;
        this.identifier = {};
        if (slug) this.identifier.slug = slug;
        if (url) this.identifier.url = url;

        this.competition = {
          ...(navigationState?.competition || historyCompetition || {}),
          name:
            name ||
            navigationState?.competition?.name ||
            historyCompetition?.name ||
            null
        };

        if (!slug && !url) {
          this.eventsError = 'No se indicó ninguna competición para consultar.';
          return;
        }
        this.loadEvents();
      });
  }

  ngOnInit(): void {
    // Lógica de inicialización si es necesaria
  }

  get filteredEvents(): ResultEventSummary[] {
    const term = (this.eventSearch || this.filterText).trim().toLowerCase();
    if (!term) return this.events;
    return this.events.filter((event) => {
      return (
        (event.title || '').toLowerCase().includes(term) ||
        (event.subtitle || '').toLowerCase().includes(term)
      );
    });
  }

  get filteredUnits(): ResultUnit[] {
    if (!this.selectedEvent) return [];
    const term = this.unitSearch.trim().toLowerCase();
    const units = this.selectedEvent.units || [];
    if (!term) return units;
    return units.filter((unit) => (unit.name || '').toLowerCase().includes(term));
  }

  get selectedEvent(): ResultEventSummary | undefined {
    if (!this.selectedEventGuid) return undefined;
    return this.events.find((event) => event.eventGuid === this.selectedEventGuid);
  }

  onEventSearchChange(value: string): void {
    this.eventSearch = value;
  }

  onUnitSearchChange(value: string): void {
    this.unitSearch = value;
  }

  loadEvents(forceRefresh = false): void {
    if (!this.identifier.slug && !this.identifier.url) {
      this.eventsError = 'No se indicó ninguna competición para consultar.';
      return;
    }
    
    this.eventsLoading = true;
    this.eventsError = null;
    this.events = [];
    this.selectedEventGuid = null;
    this.currentTable = null;

    console.log('🔄 Cargando eventos... (esto puede tardar 30-60 segundos)');

    this.datos.getCompetitionResultEvents({
      ...this.identifier,
      refresh: forceRefresh
    }).subscribe({
      next: (response) => {
        console.log('📦 Respuesta del backend:', response);
        
        const rawEvents = Array.isArray(response?.events) ? response.events : [];
        
        if (rawEvents.length === 0) {
          console.warn('⚠️ No se encontraron eventos en la respuesta');
          this.eventsError = 'No se encontraron eventos para esta competición.';
          return;
        }

        // Filtrar SOLO eventos de la sección "Swimming"
        // Basándose en la estructura HTML con títulos h2 de disciplinas
        this.events = rawEvents.filter((event: any) => {
          const title = (event?.title || '').toLowerCase();
          
          // Incluir solo eventos cuyo título pertenece a natación
          const swimmingKeywords = [
            'freestyle',
            'backstroke',
            'breaststroke',
            'butterfly',
            'medley',
            'relay'
          ];

          // Excluir explícitamente otras disciplinas
          const excludedKeywords = [
            'waterpolo', 'water polo',
            'diving', 'springboard', 'platform', 'synchron',
            'artistic', 'solo', 'duet', 'team',
            'open water', 'openwater', '5km', '10km', '25km',
            'high diving', 'highdiving', '20m', '27m'
          ];

          // Si contiene palabras excluidas, descartar
          const isExcluded = excludedKeywords.some(keyword => 
            title.includes(keyword)
          );
          
          if (isExcluded) {
            return false;
          }

          // Si contiene palabras de natación, incluir
          const isSwimming = swimmingKeywords.some(keyword => 
            title.includes(keyword)
          );

          return isSwimming;
        });

        console.log(`✅ ${this.events.length} eventos de natación cargados`);
        console.log('📋 Eventos filtrados:', this.events.map(e => e.title));

        if (response?.competition) {
          this.competition = {
            ...this.competition,
            ...response.competition
          };
        }

        if (this.events.length) {
          console.log('ℹ️ Selecciona un evento para ver sus resultados');
        } else {
          console.warn('⚠️ No se encontraron eventos de natación');
          this.eventsError = 'No se encontraron eventos de natación en esta competición.';
        }
      },
      error: (error) => {
        console.error('❌ Error cargando eventos:', error);
        this.eventsError = error?.error?.mensaje || 'No se pudieron cargar los eventos de esta competición.';
      },
      complete: () => {
        this.eventsLoading = false;
        console.log('🏁 Carga de eventos completada');
      }
    });
  }

  selectEvent(eventGuid: string): void {
    if (!eventGuid) return;
    
    const event = this.events.find(e => e.eventGuid === eventGuid);
    if (!event) return;
    
    this.selectedEventGuid = eventGuid;
    const defaultUnit =
      event.units?.find((unit: any) => unit.isActive)?.unitId ||
      event.units?.[0]?.unitId ||
      null;
    
    this.selectedUnitId = defaultUnit;
    this.loadEventResults(eventGuid, defaultUnit);
  }

  onUnitChange(unitId: string): void {
    if (!unitId || !this.selectedEventGuid) return;
    this.loadEventResults(this.selectedEventGuid, unitId);
  }

  loadEventResults(eventGuid: string, unitId: string | null): void {
    if (!this.identifier.slug && !this.identifier.url) {
      this.tableError = 'No se pudo resolver la competición solicitada.';
      return;
    }
    
    this.tableLoading = true;
    this.tableError = null;
    this.currentTable = null;
    this.selectedUnitId = unitId;

    console.log('🔄 Cargando resultados de prueba:', { eventGuid, unitId });

    this.datos.getCompetitionEventResults({
      ...this.identifier,
      eventGuid,
      unitId: unitId || undefined
    }).subscribe({
      next: (response) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 RESPUESTA COMPLETA DEL BACKEND:');
        console.log(JSON.stringify(response, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Validar que hay datos
        if (!response?.table?.rows || response.table.rows.length === 0) {
          console.warn('⚠️ No se recibieron filas de resultados');
          this.tableError = 'No hay resultados disponibles para esta prueba.';
          this.tableLoading = false;
          return;
        }

        // CAMBIO: Tipado explícito y verificación de null
        const tableWithCollapsedRows: ResultTable = {
          headers: response.table.headers || [],
          rows: response.table.rows.map((row: ResultRow) => ({
            ...row,
            expanded: false  // Forzar que inicie colapsado
          }))
        };

        this.currentTable = tableWithCollapsedRows;
        
        console.log('✅ TABLA ASIGNADA (todos los splits colapsados):');
        console.log('Rows count:', this.currentTable?.rows?.length ?? 0);
        console.log('Primera fila expanded:', this.currentTable?.rows?.[0]?.expanded ?? 'N/A');

        const units = Array.isArray(response?.units) ? response.units : [];
        if (units.length) {
          this.events = this.events.map((event) =>
            event.eventGuid === eventGuid ? { ...event, units } : event
          );
          if (this.selectedEventGuid === eventGuid) {
            const current = this.events.find((ev) => ev.eventGuid === eventGuid);
            if (current) {
              this.selectedUnitId =
                units.find((unit: any) => unit.isActive)?.unitId ||
                unitId ||
                null;
            }
          }
        }
      },
      error: (error) => {
        console.error('❌ ERROR AL CARGAR RESULTADOS:', error);
        this.tableError = 'No se pudieron obtener los resultados de esta prueba.';
      },
      complete: () => {
        this.tableLoading = false;
        console.log('🏁 Carga de resultados completada');
      }
    });
  }

  toggleSplits(row: ResultRow): void {
    row.expanded = !row.expanded;
  }

  refreshEvents(): void {
    this.loadEvents(true);
  }

  goBack(): void {
    this.router.navigate(['/competiciones']);
  }

  trackByEvent(_index: number, event: ResultEventSummary): string {
    return event.eventGuid;
  }

  trackByHeader(index: number, header: string): string {
    return `${index}-${header}`;
  }

  trackByRow(index: number, row: ResultRow): number {
    return index;
  }

  trackByColumn(index: number, _cell: string): number {
    return index;
  }

  /**
   * Retorna el ícono Material según el tipo de prueba
   */
  getEventIcon(event: any): string {
    const title = event.title?.toLowerCase() || '';

    // Natación
    if (title.includes('nado') || title.includes('freestyle') || title.includes('backstroke') || 
        title.includes('breaststroke') || title.includes('butterfly') || title.includes('medley')) {
      return 'pool';
    }

    // Saltos/Clavados
    if (title.includes('clavado') || title.includes('diving') || title.includes('salto')) {
      return 'downhill_skiing';
    }

    // Sincronizado
    if (title.includes('sincronizado') || title.includes('synchronized')) {
      return 'groups';
    }

    // Waterpolo
    if (title.includes('waterpolo') || title.includes('water polo')) {
      return 'sports_basketball';
    }

    // Maratón acuática
    if (title.includes('maratón') || title.includes('marathon') || title.includes('10km')) {
      return 'directions_run';
    }

    // Por defecto
    return 'waves';
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getHistoryCompetitionState(): CompetitionMeta | undefined {
    if (!this.isBrowser) return undefined;
    const state = window.history?.state as { competition?: CompetitionMeta } | undefined;
    return state?.competition;
  }
}
