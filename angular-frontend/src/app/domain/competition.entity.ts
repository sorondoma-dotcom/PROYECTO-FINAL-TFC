import { Competition } from '../models/competition.interface';

export class CompetitionEntity {
  constructor(private readonly data: Competition) {}

  get id(): string {
    return this.data.uuid || this.data.id || '';
  }

  get name(): string {
    return this.data.name || this.data.title || '';
  }

  get city(): string {
    return this.data.city || '';
  }

  get country(): string {
    return this.data.country || '';
  }

  get poolType(): string {
    return (this.data.pool || '').toLowerCase();
  }

  isLive(): boolean {
    return Boolean(this.data.live);
  }

  matchesFilter(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return true;
    return (
      this.name.toLowerCase().includes(normalized) ||
      this.city.toLowerCase().includes(normalized) ||
      this.country.toLowerCase().includes(normalized)
    );
  }

  groupKey(): string {
    const year = this.data.year || '';
    const month = this.data.month || '';
    return `${year}-${month}`.toLowerCase();
  }

  toDto(): Competition {
    return this.data;
  }
}
