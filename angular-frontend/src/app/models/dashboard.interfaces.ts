export interface DashboardStats {
  totalCompeticiones: number;
  competicionesLive: number;
  competiciones25m: number;
  competiciones50m: number;
  competicionesConResultados: number;
}

export interface RankingEntryView {
  overallRank?: string;
  country?: string;
  name?: string;
}

export interface TopEvent {
  key: string;
  title: string;
  gender: 'M' | 'F';
  distance: string;
  stroke: string;
  poolConfiguration: 'LCM' | 'SCM';
  top: RankingEntryView[];
}
