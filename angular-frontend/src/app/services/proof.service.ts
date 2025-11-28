import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Proof {
  id?: number;
  competicion_id: number;
  nombre_prueba: string;
  distancia: number;
  estilo: 'Libre' | 'Espalda' | 'Pecho' | 'Mariposa' | 'Combinado';
  genero: 'M' | 'F' | 'Mixto';
  created_at?: string;
  inscripciones?: ProofInscription[];
  series?: { [key: number]: ProofInscription[] };
  total_inscripciones?: number;
}

export interface ProofInscription {
  id: number;
  inscripcion_atletica_id: number;
  athlete_id: number;
  athlete_name: string;
  gender: string;
  country_code: string;
  image_url?: string;
  numero_dorsal?: number;
  estado_inscripcion: string;
  tiempo_inscripcion?: string;
  clasificacion?: number;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProofService {
  private readonly baseUrl = 'http://localhost/PROYECTO-FINAL-TFC/backend-php/auth-php/public/api';
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  // Gestión de pruebas
  createProof(competicionId: number, proof: Omit<Proof, 'id' | 'competicion_id'>): Observable<any> {
    const body = { ...proof, competicion_id: competicionId };
    return this.http.post<any>(`${this.baseUrl}/competitions/${competicionId}/proofs`, body, this.httpOptions);
  }

  getProof(proofId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/proofs/${proofId}`, this.httpOptions);
  }

  getProofsByCompetition(competicionId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/competitions/${competicionId}/proofs`, this.httpOptions);
  }

  updateProof(proofId: number, proof: Partial<Proof>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/proofs/${proofId}`, proof, this.httpOptions);
  }

  deleteProof(proofId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/proofs/${proofId}`, this.httpOptions);
  }

  // Inscripción de atletas a pruebas
  registerAthleteToProof(proofId: number, inscripcionAtleticaId: number): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/proofs/${proofId}/athletes`,
      { inscripcion_atletica_id: inscripcionAtleticaId },
      this.httpOptions
    );
  }

  unregisterAthleteFromProof(proofAthleteId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/proofs/athletes/${proofAthleteId}`,
      this.httpOptions
    );
  }

  /**
   * Obtener series generadas automáticamente (máx 8 personas por serie)
   */
  getSeries(proofs: Proof[]): { [proofId: number]: { [serieNumber: number]: ProofInscription[] } } {
    const seriesByProof: { [proofId: number]: { [serieNumber: number]: ProofInscription[] } } = {};

    proofs.forEach(proof => {
      if (proof.series) {
        seriesByProof[proof.id!] = proof.series;
      }
    });

    return seriesByProof;
  }

  /**
   * Calcular número de serie para un atleta
   */
  calculateSerieNumber(inscriptionIndex: number): number {
    return Math.floor(inscriptionIndex / 8) + 1;
  }

  /**
   * Obtener información de series para una prueba
   */
  getSeriesInfo(proof: Proof): Array<{ number: number; athletes: ProofInscription[]; count: number }> {
    const seriesInfo: Array<{ number: number; athletes: ProofInscription[]; count: number }> = [];

    if (proof.series) {
      Object.entries(proof.series).forEach(([serieNumber, athletes]) => {
        seriesInfo.push({
          number: parseInt(serieNumber),
          athletes,
          count: athletes.length
        });
      });
    }

    return seriesInfo.sort((a, b) => a.number - b.number);
  }
}
