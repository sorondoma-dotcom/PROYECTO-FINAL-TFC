import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { WorldAquaticsApiService } from '../services/world-aquatics-api.service';
import { CompetitionFilters } from '../models/filters/competition-filters.interface';
import { Competition } from '../models/competition.interface';

@Injectable({
  providedIn: 'root'
})
export class CompetitionFacadeService {
  constructor(private api: WorldAquaticsApiService) {}

  fetchCompetitions(filters: CompetitionFilters = {}): Observable<Competition[]> {
    return this.api.getCompetitions(filters).pipe(
      map((data: any) => {
        const list = Array.isArray(data?.competitions) ? (data.competitions as Competition[]) : [];
        return list;
      })
    );
  }
}
