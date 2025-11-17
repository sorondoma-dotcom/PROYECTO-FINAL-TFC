import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { WorldAquaticsApiService } from '../services/world-aquatics-api.service';
import { RankingFilters } from '../models/filters/ranking-filters.interface';
import { RankingEntry, RankingEntryDto } from '../domain/ranking-entry';

@Injectable({
  providedIn: 'root'
})
export class RankingFacadeService {
  constructor(private api: WorldAquaticsApiService) {}

  fetchRankings(filters: RankingFilters): Observable<RankingEntry[]> {
    return this.api.getRankings(filters).pipe(
      map((data: any) => {
        const rows = Array.isArray(data?.rows) ? (data.rows as RankingEntryDto[]) : [];
        return rows.map((row) => new RankingEntry(row));
      })
    );
  }
}
