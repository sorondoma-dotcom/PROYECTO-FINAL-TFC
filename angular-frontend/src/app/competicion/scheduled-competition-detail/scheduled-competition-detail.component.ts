import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CompetitionService, Competition as ScheduledCompetition, Inscription } from '../../services/competition.service';
import { ProofService, Proof, ProofInscription } from '../../services/proof.service';
import { resolvePhpAssetUrl } from '../../config/api.config';

interface SerieInfo {
  number: number;
  athletes: ProofInscription[];
  count: number;
}

@Component({
  selector: 'app-scheduled-competition-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatPaginatorModule
  ],
  templateUrl: './scheduled-competition-detail.component.html',
  styleUrls: ['./scheduled-competition-detail.component.scss']
})
export class ScheduledCompetitionDetailComponent implements OnInit, OnDestroy {
  competitionId!: number;
  competition: ScheduledCompetition | null = null;
  inscriptions: Inscription[] = [];
  proofs: Proof[] = [];
  seriesByProof: Record<number, SerieInfo[]> = {};

  competitionLoading = false;
  proofsLoading = false;
  competitionError: string | null = null;
  proofsError: string | null = null;

  // Vista compacta de atletas
  showAllAthletes = false;
  readonly initialAthletesShow = 6;

  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private proofService: ProofService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const parsedId = idParam ? Number(idParam) : Number.NaN;

      if (Number.isNaN(parsedId)) {
        this.competitionError = 'La competición solicitada no existe.';
        return;
      }

      this.competitionId = parsedId;
      this.seedStateCompetition();
      this.fetchCompetition();
      this.fetchProofs();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  goBack(): void {
    this.router.navigate(['/competiciones']);
  }

  get totalAthletes(): number {
    return this.inscriptions.length;
  }

  get displayedAthletes(): Inscription[] {
    if (this.showAllAthletes) {
      return this.inscriptions;
    }
    return this.inscriptions.slice(0, this.initialAthletesShow);
  }

  get hasMoreAthletes(): boolean {
    return this.inscriptions.length > this.initialAthletesShow;
  }

  get hasCompetitionData(): boolean {
    return !!this.competition;
  }

  get hasProofs(): boolean {
    return this.proofs.length > 0;
  }

  toggleShowAthletes(): void {
    this.showAllAthletes = !this.showAllAthletes;
    if (!this.showAllAthletes) {
      // Scroll suave hasta la sección de atletas cuando se colapsa
      const section = document.querySelector('.athletes-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  getSerieInfo(proof: Proof): SerieInfo[] {
    if (!proof.id) {
      return [];
    }
    return this.seriesByProof[proof.id] || [];
  }

  getScheduledStatusChipColor(status?: ScheduledCompetition['estado']): 'primary' | 'accent' | 'warn' {
    switch (status) {
      case 'en_curso':
        return 'primary';
      case 'finalizada':
      case 'cancelada':
        return 'warn';
      default:
        return 'accent';
    }
  }

  get competitionLogoUrl(): string | null {
    if (!this.competition) {
      return null;
    }
    return this.resolveLogoUrl(this.competition);
  }

  private seedStateCompetition(): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const stateCompetition = (window.history.state?.competition ?? null) as ScheduledCompetition | null;
    if (stateCompetition?.id === this.competitionId) {
      this.competition = stateCompetition;
    }
  }

  private fetchCompetition(): void {
    this.competitionLoading = true;
    this.competitionError = null;

    this.competitionService.getCompetition(this.competitionId).subscribe({
      next: (response) => {
        const competitionData = response?.competition || response?.data || response;
        if (competitionData) {
          this.competition = {
            ...(this.competition ?? {}),
            ...competitionData
          } as ScheduledCompetition;
        }

        const inscriptionsList = response?.inscriptions
          || response?.data?.inscriptions
          || response?.competition?.inscriptions
          || [];

        this.inscriptions = Array.isArray(inscriptionsList) ? inscriptionsList : [];
      },
      error: (error) => {
        console.error('Error cargando la competición agendada', error);
        this.competitionError = 'No se pudo cargar la información de la competición.';
      },
      complete: () => {
        this.competitionLoading = false;
      }
    });
  }

  private fetchProofs(): void {
    this.proofsLoading = true;
    this.proofsError = null;

    this.proofService.getProofsByCompetition(this.competitionId).subscribe({
      next: (response) => {
        const proofsList = Array.isArray(response?.proofs) ? response.proofs : [];
        this.proofs = proofsList;
        this.seriesByProof = {};
        this.proofs.forEach(proof => {
          if (proof.id) {
            this.seriesByProof[proof.id] = this.buildSerieInfo(proof);
          }
        });
      },
      error: (error) => {
        console.error('Error cargando las pruebas de la competición', error);
        this.proofsError = 'No se pudieron cargar las pruebas ni las series.';
        this.proofs = [];
        this.seriesByProof = {};
      },
      complete: () => {
        this.proofsLoading = false;
      }
    });
  }

  private buildSerieInfo(proof: Proof): SerieInfo[] {
    const existing = this.proofService.getSeriesInfo(proof);
    if (existing.length) {
      return existing;
    }

    if (!proof.inscripciones || proof.inscripciones.length === 0) {
      return [];
    }

    const grouped: Record<number, ProofInscription[]> = {};
    proof.inscripciones.forEach((athlete, index) => {
      const serieNumber = this.proofService.calculateSerieNumber(index);
      if (!grouped[serieNumber]) {
        grouped[serieNumber] = [];
      }
      grouped[serieNumber].push(athlete);
    });

    return Object.keys(grouped)
      .map(key => Number(key))
      .sort((a, b) => a - b)
      .map(number => ({
        number,
        athletes: grouped[number],
        count: grouped[number].length
      }));
  }

  private resolveLogoUrl(comp: ScheduledCompetition): string | null {
    if (comp.logo_url) {
      return comp.logo_url;
    }

    if (comp.logo_path) {
      return resolvePhpAssetUrl(comp.logo_path);
    }

    return null;
  }
}
