export interface CompetitionFilters {
  group?: string;
  year?: number | string;
  month?: string;
  discipline?: string;
  disciplines?: string;
  refresh?: boolean;
  cacheTtl?: number;
}
