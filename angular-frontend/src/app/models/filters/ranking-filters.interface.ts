export interface RankingFilters {
  gender: 'M' | 'F';
  distance: string;
  stroke: string;
  poolConfiguration: 'LCM' | 'SCM';
  limit?: number;
  year?: string;
  startDate?: string;
  endDate?: string;
  clearCache?: boolean;
}
