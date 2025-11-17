import { Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { WorldAquaticsApiService } from '../services/world-aquatics-api.service';
import { CompetitionFilters } from '../models/filters/competition-filters.interface';
import { Competition } from '../models/competition.interface';

@Injectable({
  providedIn: 'root'
})
export class CompetitionFacadeService {
  private readonly cacheTtlMs = 10 * 60 * 1000; // 10 minutos de caché en cliente
  private cache = new Map<string, { expiresAt: number; stream: Observable<Competition[]> }>();

  constructor(private api: WorldAquaticsApiService) {}

  fetchCompetitions(filters: CompetitionFilters = {}): Observable<Competition[]> {
    const normalizedFilters: CompetitionFilters = {
      ...filters,
      // Unificamos nombre de parámetro para el backend
      discipline: filters.discipline ?? filters.disciplines,
      disciplines: undefined
    };

    const cacheKey = this.buildCacheKey(normalizedFilters);
    const now = Date.now();

    if (!normalizedFilters.refresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.stream;
      }
    } else {
      this.cache.delete(cacheKey);
    }

    // Alinear TTL cliente/servidor para maximizar probabilidad de cache hit
    const ttlSeconds = Math.max(
      Math.floor(this.cacheTtlMs / 1000),
      normalizedFilters.cacheTtl ?? 0
    );

    const request$ = this.api.getCompetitions({
      ...normalizedFilters,
      cacheTtl: ttlSeconds
    }).pipe(
      map((data: any) => {
        const list = Array.isArray(data?.competitions) ? (data.competitions as Competition[]) : [];
        return list;
      }),
      tap({
        error: () => this.cache.delete(cacheKey),
      }),
      shareReplay(1),
      catchError((err) => {
        this.cache.delete(cacheKey);
        return throwError(() => err);
      })
    );

    this.cache.set(cacheKey, {
      expiresAt: now + this.cacheTtlMs,
      stream: request$
    });

    return request$;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private buildCacheKey(filters: CompetitionFilters): string {
    return JSON.stringify({
      group: filters.group || 'FINA',
      year: filters.year ?? new Date().getFullYear(),
      month: filters.month || 'latest',
      discipline: filters.discipline || 'SW'
    });
  }
}
