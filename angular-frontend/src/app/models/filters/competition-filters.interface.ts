export interface CompetitionFilters {
  group?: string;
  year?: number | string;
  month?: string;
  disciplines?: string;
  refresh?: boolean;
  cacheTtl?: number;
}
