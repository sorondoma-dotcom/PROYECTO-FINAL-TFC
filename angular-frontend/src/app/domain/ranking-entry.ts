export interface RankingEntryDto {
  overallRank?: string;
  country?: string;
  name?: string;
}

export class RankingEntry {
  constructor(private readonly data: RankingEntryDto) {}

  get overallRank(): string {
    return this.data.overallRank || '';
  }

  get country(): string {
    return this.data.country || '';
  }

  get name(): string {
    return this.data.name || '';
  }

  fullName(): string {
    return this.name.trim();
  }
}
