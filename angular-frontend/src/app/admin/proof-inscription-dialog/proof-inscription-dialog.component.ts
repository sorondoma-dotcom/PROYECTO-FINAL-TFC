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
  templateUrl: './proof-inscription-dialog.component.html',
  styleUrls: ['./proof-inscription-dialog.component.scss']
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
