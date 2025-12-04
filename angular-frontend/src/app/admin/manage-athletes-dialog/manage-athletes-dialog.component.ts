import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { CompetitionService } from '../../services/competition.service';
import { DatosService } from '../../services/datos.service';
import { API_CONFIG } from '../../config/api.config';

interface Athlete {
  athlete_id: number;
  athlete_name: string;
  gender: string;
  country_code: string;
  age?: number;
  selected?: boolean;
}

@Component({
  selector: 'app-manage-athletes-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>Inscribir atletas</h2>
    
    <mat-dialog-content>
      <div class="dialog-content">
        <!-- Búsqueda y filtros -->
        <div class="search-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Buscar atleta</mat-label>
            <input matInput [formControl]="searchControl" placeholder="Nombre del atleta..." />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Filtrar por género</mat-label>
            <mat-select [formControl]="genderControl">
              <mat-option value="">Todos</mat-option>
              <mat-option value="M">Masculino</mat-option>
              <mat-option value="F">Femenino</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>País</mat-label>
            <input matInput [formControl]="countryControl" placeholder="Código país (ej: ESP)" />
          </mat-form-field>
        </div>

        <!-- Tabla de atletas -->
        <div class="table-section">
          @if (loading) {
            <div class="loading">
              <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
            </div>
          } @else if (filteredAthletes.length === 0) {
            <p class="no-data">No se encontraron atletas</p>
          } @else {
            <div class="table-container">
              <table mat-table [dataSource]="filteredAthletes" class="athletes-table">
                <!-- Checkbox column -->
                <ng-container matColumnDef="select">
                  <th mat-header-cell *matHeaderCellDef>
                    <mat-checkbox
                      [checked]="isAllSelected()"
                      (change)="toggleSelectAll($event)"
                    ></mat-checkbox>
                  </th>
                  <td mat-cell *matCellDef="let element">
                    <mat-checkbox
                      [checked]="element.selected"
                      (change)="toggleAthlete(element)"
                    ></mat-checkbox>
                  </td>
                </ng-container>

                <!-- Nombre -->
                <ng-container matColumnDef="athlete_name">
                  <th mat-header-cell *matHeaderCellDef>Nombre</th>
                  <td mat-cell *matCellDef="let element">{{ element.athlete_name }}</td>
                </ng-container>

                <!-- Género -->
                <ng-container matColumnDef="gender">
                  <th mat-header-cell *matHeaderCellDef>Género</th>
                  <td mat-cell *matCellDef="let element">
                    {{ element.gender === 'M' ? 'Masculino' : 'Femenino' }}
                  </td>
                </ng-container>

                <!-- País -->
                <ng-container matColumnDef="country_code">
                  <th mat-header-cell *matHeaderCellDef>País</th>
                  <td mat-cell *matCellDef="let element">{{ element.country_code }}</td>
                </ng-container>

                <!-- Edad -->
                <ng-container matColumnDef="age">
                  <th mat-header-cell *matHeaderCellDef>Edad</th>
                  <td mat-cell *matCellDef="let element">{{ element.age || '-' }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </div>
          }
        </div>

        <!-- Resumen de seleccionados -->
        @if (selectedAthletes.length > 0) {
          <div class="summary">
            <strong>{{ selectedAthletes.length }} atleta(s) seleccionado(s)</strong>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="selectedAthletes.length === 0 || saving"
      >
        @if (saving) {
          <mat-progress-spinner diameter="20" mode="indeterminate"></mat-progress-spinner>
        }
        <span>Inscribir ({{ selectedAthletes.length }})</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 500px;
    }

    .search-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .full-width {
      width: 100%;
    }

    .table-section {
      flex: 1;
      overflow: auto;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
    }

    .no-data {
      text-align: center;
      color: #999;
      padding: 40px 20px;
    }

    .table-container {
      overflow-x: auto;
    }

    .athletes-table {
      width: 100%;
      border-collapse: collapse;

      th {
        background: #f5f5f5;
        padding: 12px;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid #e0e0e0;
      }

      td {
        padding: 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      tr:hover {
        background: #fafafa;
      }
    }

    .summary {
      padding: 12px;
      background: #e8f5e9;
      border-radius: 4px;
      text-align: center;
      color: #1b5e20;
    }

    mat-dialog-actions {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
  `]
  ,
  templateUrl: './manage-athletes-dialog.component.html',
  styleUrls: ['./manage-athletes-dialog.component.scss']
})
export class ManageAthletesDialogComponent implements OnInit {
  athletes: Athlete[] = [];
  filteredAthletes: Athlete[] = [];
  selectedAthletes: Athlete[] = [];

  searchControl = new FormBuilder().control('');
  genderControl = new FormBuilder().control('');
  countryControl = new FormBuilder().control('');

  displayedColumns = ['select', 'athlete_name', 'gender', 'country_code', 'age'];

  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<ManageAthletesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { competicion_id: number },
    private datosService: DatosService,
    private competitionService: CompetitionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadAthletes();
    this.setupFilters();
  }

  private loadAthletes(): void {
    this.loading = true;
    
    const athletesUrl = `${API_CONFIG.phpApiBase}/athletes`;
    
    this.http.get<any>(athletesUrl, { withCredentials: true }).subscribe({
      next: (response: any) => {
        if (response.data && Array.isArray(response.data)) {
          this.athletes = response.data.map((athlete: any) => ({
            athlete_id: athlete.athlete_id,
            athlete_name: athlete.athlete_name || '',
            gender: athlete.gender || 'M',
            country_code: athlete.country_code || 'UNK',
            age: athlete.age
          }));
        }

        this.filterAthletes();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading athletes:', error);
        this.loading = false;
      }
    });
  }

  private setupFilters(): void {
    this.searchControl.valueChanges.subscribe(() => this.filterAthletes());
    this.genderControl.valueChanges.subscribe(() => this.filterAthletes());
    this.countryControl.valueChanges.subscribe(() => this.filterAthletes());
  }

  private filterAthletes(): void {
    const search = (this.searchControl.value || '').toLowerCase();
    const gender = this.genderControl.value || '';
    const country = (this.countryControl.value || '').toUpperCase();

    this.filteredAthletes = this.athletes.filter(athlete => {
      const matchSearch = search === '' || athlete.athlete_name.toLowerCase().includes(search);
      const matchGender = gender === '' || athlete.gender === gender;
      const matchCountry = country === '' || athlete.country_code === country;
      return matchSearch && matchGender && matchCountry;
    });
  }

  toggleAthlete(athlete: Athlete): void {
    athlete.selected = !athlete.selected;
    this.updateSelectedAthletes();
  }

  toggleSelectAll(event: any): void {
    this.filteredAthletes.forEach(athlete => {
      athlete.selected = event.checked;
    });
    this.updateSelectedAthletes();
  }

  isAllSelected(): boolean {
    return (
      this.filteredAthletes.length > 0 &&
      this.filteredAthletes.every(athlete => athlete.selected)
    );
  }

  private updateSelectedAthletes(): void {
    this.selectedAthletes = this.athletes.filter(a => a.selected);
  }

  onSave(): void {
    if (this.selectedAthletes.length === 0) return;

    this.saving = true;

    let completed = 0;
    let errors = 0;

    this.selectedAthletes.forEach(athlete => {
      this.competitionService.registerAthlete(this.data.competicion_id, athlete.athlete_id).subscribe({
        next: () => {
          completed++;
          if (completed + errors === this.selectedAthletes.length) {
            this.saving = false;
            this.dialogRef.close(true);
          }
        },
        error: (error) => {
          errors++;
          console.error(`Error registering athlete ${athlete.athlete_name}:`, error);
          if (completed + errors === this.selectedAthletes.length) {
            this.saving = false;
            this.dialogRef.close(true);
          }
        }
      });
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
