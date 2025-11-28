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
import { FormsModule } from '@angular/forms';
import { ProofService, Proof, ProofInscription } from '../../services/proof.service';
import { CompetitionService, Inscription } from '../../services/competition.service';

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
    MatTabsModule
  ],
  template: `
    <div class="inscription-dialog-container">
      <h2 mat-dialog-title>Inscribir Atletas a Prueba</h2>

      <mat-dialog-content>
        <mat-tab-group>
          <!-- TAB 1: Información de la Prueba -->
          <mat-tab label="Prueba">
            <div class="tab-content">
              <div class="proof-info-card">
                <div class="info-row">
                  <span class="label">Nombre:</span>
                  <strong>{{ proof.nombre_prueba }}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Distancia:</span>
                  <strong>{{ proof.distancia }}m</strong>
                </div>
                <div class="info-row">
                  <span class="label">Estilo:</span>
                  <strong>{{ proof.estilo }}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Género:</span>
                  <strong>{{ getGenderLabel(proof.genero) }}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Total Inscripciones:</span>
                  <strong>{{ proof.total_inscripciones || 0 }}</strong>
                </div>
              </div>

              <!-- Series actuales -->
              <div *ngIf="seriesInfo.length > 0" class="series-summary">
                <h3>Series Actuales</h3>
                <div class="series-grid">
                  <div *ngFor="let serie of seriesInfo" class="serie-summary">
                    <div class="serie-number">Serie {{ serie.number }}</div>
                    <div class="serie-count">{{ serie.athletes.length }} / 8</div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: Atletas Disponibles -->
          <mat-tab label="Atletas Disponibles ({{ availableAthletes.length }})">
            <div class="tab-content">
              <div *ngIf="loadingAthletes" class="loading">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loadingAthletes && availableAthletes.length === 0" class="no-data">
                Todos los atletas confirmados ya están inscritos en esta prueba.
              </div>

              <div *ngIf="!loadingAthletes && availableAthletes.length > 0" class="athletes-table">
                <div class="search-box">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Buscar atleta</mat-label>
                    <input matInput [(ngModel)]="searchText" placeholder="Nombre, país...">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>

                <table mat-table [dataSource]="filteredAthletes" class="athletes-table-element">
                  <!-- Checkbox Column -->
                  <ng-container matColumnDef="select">
                    <th mat-header-cell *matHeaderCellDef>
                      <mat-checkbox
                        [checked]="isAllSelected()"
                        (change)="toggleSelectAll()">
                      </mat-checkbox>
                    </th>
                    <td mat-cell *matCellDef="let element">
                      <mat-checkbox
                        [checked]="isAthleteSelected(element)"
                        (change)="toggleAthleteSelection(element)">
                      </mat-checkbox>
                    </td>
                  </ng-container>

                  <!-- Name Column -->
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Atleta</th>
                    <td mat-cell *matCellDef="let element">{{ element.athlete_name }}</td>
                  </ng-container>

                  <!-- Gender Column -->
                  <ng-container matColumnDef="gender">
                    <th mat-header-cell *matHeaderCellDef>Género</th>
                    <td mat-cell *matCellDef="let element">
                      <mat-chip [highlighted]="element.gender === proof.genero">
                        {{ element.gender === 'M' ? 'M' : 'F' }}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <!-- Country Column -->
                  <ng-container matColumnDef="country">
                    <th mat-header-cell *matHeaderCellDef>País</th>
                    <td mat-cell *matCellDef="let element">{{ element.country_code }}</td>
                  </ng-container>

                  <!-- Age Column -->
                  <ng-container matColumnDef="age">
                    <th mat-header-cell *matHeaderCellDef>Edad</th>
                    <td mat-cell *matCellDef="let element">{{ element.age || '-' }}</td>
                  </ng-container>

                  <!-- Predicted Serie Column -->
                  <ng-container matColumnDef="serie">
                    <th mat-header-cell *matHeaderCellDef>Serie (Predicha)</th>
                    <td mat-cell *matCellDef="let element">
                      <strong *ngIf="isAthleteSelected(element)" class="serie-predict">
                        Serie {{ predictSerieForNewAthlete(element) }}
                      </strong>
                      <span *ngIf="!isAthleteSelected(element)" class="serie-predict-disabled">-</span>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: Atletas Inscritos -->
          <mat-tab label="Inscritos ({{ registeredAthletes.length }})">
            <div class="tab-content">
              <div *ngIf="registeredAthletes.length === 0" class="no-data">
                Sin inscripciones en esta prueba aún.
              </div>

              <div *ngIf="registeredAthletes.length > 0" class="registered-section">
                <div *ngFor="let serie of seriesInfo" class="serie-card">
                  <h3 class="serie-title">Serie {{ serie.number }} ({{ serie.athletes.length }} / 8)</h3>
                  <div class="athletes-in-serie">
                    <div *ngFor="let athlete of serie.athletes; let i = index" class="athlete-registered">
                      <span class="dorsal">{{ i + 1 }}</span>
                      <span class="name">{{ athlete.athlete_name }}</span>
                      <span class="country">{{ athlete.country_code }}</span>
                      <button 
                        mat-icon-button 
                        matTooltip="Quitar"
                        (click)="removeAthleteFromProof(athlete)"
                        [disabled]="removingAthleteId === athlete.id">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancelar</button>
        <button 
          mat-raised-button 
          color="primary"
          [disabled]="selectedAthletes.length === 0 || registering"
          (click)="registerSelectedAthletes()">
          <mat-icon *ngIf="!registering">person_add</mat-icon>
          <mat-spinner *ngIf="registering" diameter="20"></mat-spinner>
          {{ registering ? 'Inscribiendo...' : ('Inscribir (' + selectedAthletes.length + ')') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .inscription-dialog-container {
      min-width: 800px;
      max-width: 1200px;
    }

    .tab-content {
      padding: 20px;
    }

    .full-width {
      width: 100%;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
    }

    .no-data {
      text-align: center;
      color: #999;
      padding: 40px 20px;
      font-style: italic;
    }

    .proof-info-card {
      background: #f0f7ff;
      border: 1px solid #b3d9f2;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: #666;
      min-width: 150px;
    }

    .series-summary {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }

    .series-summary h3 {
      margin: 0 0 12px 0;
      color: #0c7cc0;
    }

    .series-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }

    .serie-summary {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      text-align: center;
    }

    .serie-number {
      font-weight: 600;
      color: #0f9de8;
      margin-bottom: 4px;
    }

    .serie-count {
      font-size: 14px;
      color: #666;
    }

    .search-box {
      margin-bottom: 16px;
    }

    .athletes-table-element {
      width: 100%;
      border-collapse: collapse;
    }

    table th {
      background: #f5f5f5;
      font-weight: 600;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #e0e0e0;
    }

    table td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    table tr:hover {
      background: #f9f9f9;
    }

    .serie-predict {
      color: #0f9de8;
      font-size: 14px;
    }

    .serie-predict-disabled {
      color: #ccc;
    }

    .registered-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .serie-card {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }

    .serie-title {
      margin: 0 0 12px 0;
      color: #0c7cc0;
      font-size: 16px;
    }

    .athletes-in-serie {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .athlete-registered {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
    }

    .dorsal {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #0f9de8;
      color: white;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    }

    .name {
      flex: 1;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .country {
      color: #999;
      font-size: 12px;
      min-width: 40px;
    }

    mat-dialog-actions {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }

    @media (max-width: 1024px) {
      .inscription-dialog-container {
        min-width: auto;
        max-width: 100%;
      }

      .athletes-in-serie {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ProofInscriptionDialogComponent implements OnInit {
  proof!: Proof;
  competicion_id!: number;
  
  availableAthletes: Inscription[] = [];
  registeredAthletes: ProofInscription[] = [];
  selectedAthletes: Inscription[] = [];
  seriesInfo: any[] = [];
  
  loadingAthletes = false;
  registering = false;
  removingAthleteId: number | null = null;
  
  displayedColumns: string[] = ['select', 'name', 'gender', 'country', 'age', 'serie'];
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
    private competitionService: CompetitionService
  ) {
    this.proof = data.proof;
    this.competicion_id = data.competicion_id;
  }

  ngOnInit(): void {
    this.loadAthletes();
  }

  private loadAthletes(): void {
    this.loadingAthletes = true;

    // Get proof with inscriptions
    this.proofService.getProof(this.proof.id!).subscribe({
      next: (response: any) => {
        const proof = response.proof;
        this.registeredAthletes = proof.inscripciones || [];
        this.updateSeriesInfo();

        // Filter available athletes - those inscribed in competition but not in this proof
        this.availableAthletes = this.data.competicionAthletes.filter(athlete =>
          !this.registeredAthletes.some(
            reg => reg.athlete_id === athlete.athlete_id || reg.athlete_id == athlete.athlete_id
          )
        );

        this.loadingAthletes = false;
      },
      error: (error) => {
        console.error('Error loading proof:', error);
        this.loadingAthletes = false;
      }
    });
  }

  private updateSeriesInfo(): void {
    this.seriesInfo = this.proofService.getSeriesInfo(this.proof);
  }

  predictSerieForNewAthlete(athlete: Inscription): number {
    const currentTotal = (this.proof.total_inscripciones || 0) + 
                         this.selectedAthletes.filter(a => a.athlete_id === athlete.athlete_id).length;
    return Math.floor(currentTotal / 8) + 1;
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
    if (this.selectedAthletes.length === 0) return;

    this.registering = true;
    let registered = 0;

    this.selectedAthletes.forEach(athlete => {
      // Find the inscription record in competition
      const inscription = this.data.competicionAthletes.find(
        a => a.athlete_id === athlete.athlete_id
      );

      if (!inscription || !inscription.id) {
        registered++;
        if (registered === this.selectedAthletes.length) this.onRegistrationComplete();
        return;
      }

      this.proofService.registerAthleteToProof(this.proof.id!, inscription.id).subscribe({
        next: () => {
          registered++;
          if (registered === this.selectedAthletes.length) {
            this.onRegistrationComplete();
          }
        },
        error: (error) => {
          console.error('Error registering athlete:', error);
          registered++;
          if (registered === this.selectedAthletes.length) {
            this.onRegistrationComplete();
          }
        }
      });
    });
  }

  private onRegistrationComplete(): void {
    this.registering = false;
    this.selectedAthletes = [];
    this.loadAthletes();
  }

  removeAthleteFromProof(athlete: ProofInscription): void {
    if (!athlete.id) return;

    this.removingAthleteId = athlete.id;
    this.proofService.unregisterAthleteFromProof(athlete.id).subscribe({
      next: () => {
        this.removingAthleteId = null;
        this.loadAthletes();
      },
      error: (error) => {
        console.error('Error removing athlete:', error);
        this.removingAthleteId = null;
      }
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
