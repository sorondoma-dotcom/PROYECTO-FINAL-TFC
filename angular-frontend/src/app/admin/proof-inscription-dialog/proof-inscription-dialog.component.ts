import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ProofService, Proof, ProofInscription } from '../../services/proof.service';
import { CompetitionService, Inscription } from '../../services/competition.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { DatosService } from '../../services/datos.service';

interface AthleteSuggestion {
  athlete_id: number;
  athlete_name: string;
  gender: string;
  country_code: string;
  suggestion?: {
    score: number;
    bestTime: string | null;
    recentResults: number;
    medals: number;
    reasons: string[];
    recommendation: string;
  };
}

  @Component({
  selector: 'app-proof-inscription-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './proof-inscription-dialog.component.html',
  styleUrls: ['./proof-inscription-dialog.component.scss']
})
export class ProofInscriptionDialogComponent implements OnInit {
  proof!: Proof;
  competicion_id!: number;

  availableAthletes: Inscription[] = [];
  registeredAthletes: ProofInscription[] = [];
  selectedAthletes: Inscription[] = [];
  seriesInfo: Array<{ number: number; athletes: ProofInscription[]; count: number }> = [];

  proofs: Proof[] = [];
  proofsLoading = false;
  selectedProofId: number | null = null;
  targetProofIds: number[] = [];

  loadingAthletes = false;
  registering = false;
  removingAthleteId: number | null = null;
  loadingSuggestions = false;
  athleteSuggestions: Map<number, any> = new Map();

  displayedColumns: string[] = ['select', 'name', 'gender', 'country', 'age', 'suggestion', 'serie'];
  searchText = '';

  get filteredAthletes(): Inscription[] {
    if (!this.searchText) return this.availableAthletes;

    const search = this.searchText.toLowerCase();
    return this.availableAthletes.filter(a =>
      (a.athlete_name?.toLowerCase().includes(search) ?? false) ||
      (a.country_code?.toLowerCase().includes(search) ?? false)
    );
  }

  constructor(
    public dialogRef: MatDialogRef<ProofInscriptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { proof: Proof; competicion_id: number; competicionAthletes: Inscription[] },
    private proofService: ProofService,
    private competitionService: CompetitionService,
    private confirmation: ConfirmationService,
    private datosService: DatosService
  ) {
    this.proof = data.proof;
    this.competicion_id = data.competicion_id;
  }

  ngOnInit(): void {
    this.loadProofsList();
  }

  private loadProofsList(): void {
    this.proofsLoading = true;

    this.proofService.getProofsByCompetition(this.competicion_id).subscribe({
      next: (response: any) => {
        this.proofs = response.proofs || [];
        const initialProofId = this.data.proof?.id ?? this.proofs[0]?.id ?? null;

        if (initialProofId) {
          this.selectedProofId = initialProofId;
          this.targetProofIds = [initialProofId];
          this.loadProofData(initialProofId);
        } else {
          this.targetProofIds = [];
        }

        this.proofsLoading = false;
      },
      error: (error) => {
        console.error('Error loading proofs list:', error);
        this.proofsLoading = false;
        const fallbackProofId = this.data.proof?.id ?? null;

        if (fallbackProofId) {
          this.selectedProofId = fallbackProofId;
          this.targetProofIds = [fallbackProofId];
          this.loadProofData(fallbackProofId);
        }
      }
    });
  }

  private loadProofData(proofId?: number): void {
    const targetProofId = proofId ?? this.selectedProofId ?? this.proof?.id;
    if (!targetProofId) return;

    this.loadingAthletes = true;
    this.proofService.getProof(targetProofId).subscribe({
      next: (response: any) => {
        const proof = response.proof as Proof;
        this.proof = { ...this.proof, ...proof };
        this.registeredAthletes = [...(proof.inscripciones || [])];
        this.proof.total_inscripciones = this.registeredAthletes.length;
        this.updateSeriesInfo();
        this.updateAvailableAthletes();
        this.loadingAthletes = false;
      },
      error: (error) => {
        console.error('Error loading proof:', error);
        this.loadingAthletes = false;
      }
    });
  }

  onActiveProofChange(proofId: number): void {
    if (!proofId) return;
    this.selectedProofId = proofId;
    this.targetProofIds = Array.from(new Set([proofId, ...this.targetProofIds]));
    this.loadProofData(proofId);
  }

  private updateAvailableAthletes(): void {
    this.availableAthletes = this.data.competicionAthletes.filter(athlete => {
      // Verificar que no esté ya inscrito
      const isAlreadyRegistered = this.registeredAthletes.some(
        reg => reg.athlete_id === athlete.athlete_id
      );

      if (isAlreadyRegistered) {
        return false;
      }

      // Filtrar por género según el tipo de prueba
      const proofGender = this.proof.genero;

      // Si la prueba es Mixta, permitir ambos géneros
      if (proofGender === 'Mixto') {
        return true;
      }

      // Si la prueba es Masculina (M), solo permitir hombres
      if (proofGender === 'M') {
        return athlete.gender === 'M';
      }

      // Si la prueba es Femenina (F), solo permitir mujeres
      if (proofGender === 'F') {
        return athlete.gender === 'F';
      }

      // Por defecto, no mostrar
      return false;
    });

    // Cargar sugerencias para los atletas disponibles
    this.loadAthleteSuggestions();
  }

  private loadAthleteSuggestions(): void {
    if (this.availableAthletes.length === 0) return;

    this.loadingSuggestions = true;
    this.athleteSuggestions.clear();

    // Cargar sugerencias para cada atleta
    const suggestions$ = this.availableAthletes.map(athlete => 
      this.datosService.getInscriptionSuggestions(athlete.athlete_id, this.competicion_id)
    );

    // Cargar todas las sugerencias en paralelo
    Promise.all(suggestions$.map(obs => obs.toPromise()))
      .then(results => {
        results.forEach((result: any, index) => {
          if (result?.success && result?.data?.suggestions) {
            const athlete = this.availableAthletes[index];
            // Buscar la sugerencia para la prueba actual
            const suggestion = result.data.suggestions.find(
              (s: any) => s.prueba_id === this.proof.id
            );
            if (suggestion) {
              this.athleteSuggestions.set(athlete.athlete_id, suggestion);
            }
          }
        });
        this.loadingSuggestions = false;
      })
      .catch(error => {
        console.error('Error loading suggestions:', error);
        this.loadingSuggestions = false;
      });
  }

  getSuggestion(athleteId: number): any {
    return this.athleteSuggestions.get(athleteId);
  }

  getRecommendationClass(recommendation: string): string {
    switch (recommendation) {
      case 'Altamente recomendado':
        return 'recommendation-high';
      case 'Recomendado':
        return 'recommendation-medium';
      case 'Considerar':
        return 'recommendation-low';
      default:
        return 'recommendation-none';
    }
  }

  private updateSeriesInfo(): void {
    const seriesByNumber: { [serie: number]: ProofInscription[] } = {};

    this.registeredAthletes.forEach((athlete, index) => {
      const serieNumber = Math.floor(index / 8) + 1;
      if (!seriesByNumber[serieNumber]) {
        seriesByNumber[serieNumber] = [];
      }
      seriesByNumber[serieNumber].push(athlete);
    });

    this.seriesInfo = Object.entries(seriesByNumber)
      .map(([serieNumber, athletes]) => ({
        number: Number(serieNumber),
        athletes,
        count: athletes.length
      }))
      .sort((a, b) => a.number - b.number);
  }

  predictSerieForNewAthlete(athlete: Inscription): number {
    const registeredCount = this.registeredAthletes.length;
    const selectionIndex = this.selectedAthletes.findIndex(a => a.athlete_id === athlete.athlete_id);
    const projectedPosition = registeredCount + (selectionIndex >= 0 ? selectionIndex + 1 : 1);
    return Math.floor((projectedPosition - 1) / 8) + 1;
  }

  isAthleteSelected(athlete: Inscription): boolean {
    return this.selectedAthletes.some(a => a.athlete_id === athlete.athlete_id);
  }

  toggleAthleteSelection(athlete: Inscription): void {
    const index = this.selectedAthletes.findIndex(a => a.athlete_id === athlete.athlete_id);
    if (index >= 0) {
      this.selectedAthletes.splice(index, 1);
    } else {
      this.selectedAthletes.push(athlete);
    }
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedAthletes = [];
    } else {
      this.selectedAthletes = [...this.filteredAthletes];
    }
  }

  isAllSelected(): boolean {
    return this.selectedAthletes.length === this.filteredAthletes.length &&
           this.filteredAthletes.length > 0;
  }

  registerSelectedAthletes(): void {
    if (this.selectedAthletes.length === 0 || this.targetProofIds.length === 0) return;

    const athleteCount = this.selectedAthletes.length;
    const proofCount = this.targetProofIds.length;

    this.confirmation.confirm({
      title: 'Confirmar inscripción',
      message: `¿Deseas inscribir ${athleteCount} atleta(s) en ${proofCount} prueba(s)?`,
      confirmText: 'Inscribir',
      confirmColor: 'primary'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.registering = true;
      let processed = 0;
      const proofIds = Array.from(new Set(
        this.targetProofIds
          .map(id => Number(id))
          .filter(id => !Number.isNaN(id) && id > 0)
      ));

      if (proofIds.length === 0) {
        this.registering = false;
        return;
      }

      this.selectedAthletes.forEach(athlete => {
        const inscription = this.data.competicionAthletes.find(
          a => a.athlete_id === athlete.athlete_id
        );

        if (!inscription || !inscription.id) {
          processed++;
          if (processed === this.selectedAthletes.length) this.onRegistrationComplete();
          return;
        }

        this.proofService.registerAthleteToMultipleProofs(proofIds, inscription.id).subscribe({
          next: (response: any) => {
            const results = response?.results || [];
            const errors = results
              .filter((result: any) => !result.success)
              .map((result: any) => result.error ?? 'Error desconocido');
            if (errors.length) {
              console.warn(`No se pudieron inscribir todas las pruebas para ${athlete.athlete_name}:`, errors);
            }
            processed++;
            if (processed === this.selectedAthletes.length) {
              this.onRegistrationComplete();
            }
          },
          error: (error) => {
            console.error('Error registering athlete:', error);
            processed++;
            if (processed === this.selectedAthletes.length) {
              this.onRegistrationComplete();
            }
          }
        });
      });
    });
  }

  private onRegistrationComplete(): void {
    this.registering = false;
    this.selectedAthletes = [];

    // Recargar todas las pruebas para actualizar contadores
    this.loadProofsList();

    // Recargar la prueba actual para actualizar la lista de inscritos
    if (this.selectedProofId) {
      this.loadProofData(this.selectedProofId);
    }

    // Notificar al componente padre que hubo cambios
    this.dialogRef.close({ updated: true });
  }

  removeAthleteFromProof(athlete: ProofInscription): void {
    console.log('Atleta recibido en removeAthleteFromProof:', athlete);

    let inscripcionPruebaId = athlete.id;
    if (!inscripcionPruebaId || inscripcionPruebaId <= 0) {
      const registered = this.registeredAthletes.find(reg => reg.athlete_id === athlete.athlete_id);
      if (registered && registered.id > 0) {
        inscripcionPruebaId = registered.id;
        console.log('ID encontrado en registeredAthletes:', inscripcionPruebaId);
      }
    }

    const inscripcionAtleticaId = athlete.inscripcion_atletica_id;
    const proofIdForRemoval = this.selectedProofId ?? this.proof?.id;

    if ((!inscripcionPruebaId || inscripcionPruebaId <= 0) && (!proofIdForRemoval || !inscripcionAtleticaId)) {
      console.error('No se puede eliminar: faltan identificadores v?lidos para', athlete.athlete_name);
      return;
    }

    console.log(
      'Intentando eliminar atleta:',
      athlete.athlete_name,
      'inscripcion_prueba_id:',
      inscripcionPruebaId,
      'inscripcion_atletica_id:',
      inscripcionAtleticaId
    );

    this.confirmation.confirm({
      title: 'Confirmar eliminaci?n',
      message: `?Deseas quitar a ${athlete.athlete_name} de esta prueba?`,
      confirmText: 'Quitar',
      confirmColor: 'warn'
    }).subscribe(confirmed => {
      console.log('Respuesta del di?logo de confirmaci?n:', confirmed);

      if (!confirmed) return;

      this.removingAthleteId = inscripcionAtleticaId;

      let removal$ = null;
      if (inscripcionPruebaId && inscripcionPruebaId > 0) {
        console.log('Llamando al servicio para eliminar inscripci?n ID:', inscripcionPruebaId);
        removal$ = this.proofService.unregisterAthleteFromProof(inscripcionPruebaId);
      } else if (proofIdForRemoval && inscripcionAtleticaId) {
        console.log('Llamando al servicio para eliminar con prueba e inscripci?n atl?tica:', proofIdForRemoval, inscripcionAtleticaId);
        removal$ = this.proofService.unregisterAthleteFromProofByProofAndInscription(
          proofIdForRemoval,
          inscripcionAtleticaId
        );
      }

      if (!removal$) {
        console.error('No se puede eliminar: no se pudo determinar el endpoint para', athlete.athlete_name);
        this.removingAthleteId = null;
        return;
      }

      removal$.subscribe({
        next: () => {
          console.log('Atleta eliminado correctamente');
          this.removingAthleteId = null;

          // Recargar la lista de pruebas para actualizar contadores
          this.loadProofsList();

          // Recargar la prueba actual para actualizar la lista de inscritos
          const proofToReload = this.selectedProofId ?? this.proof?.id;
          if (proofToReload) {
            console.log('Recargando prueba ID:', proofToReload);
            this.loadProofData(proofToReload);
          }
        },
        error: (error) => {
          console.error('Error removing athlete:', error);
          this.removingAthleteId = null;
        }
      });
    });
  }

  getGenderLabel(gender: string): string {
    const labels: { [key: string]: string } = {
      'M': 'Masculino',
      'F': 'Femenino',
      'Mixto': 'Mixto'
    };
    return labels[gender] || gender;
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
