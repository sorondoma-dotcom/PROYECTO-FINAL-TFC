import { RankingEntry } from '../domain/ranking-entry';

export interface DashboardStats {
  totalCompeticiones: number;
  competicionesLive: number;
  competiciones25m: number;
  competiciones50m: number;
  competicionesConResultados: number;
}

export interface TopEvent {
  key: string;
  title: string;
  gender: string;
  distance: string;
  stroke: string;
  poolConfiguration: string;
  top: RankingEntryView[];
}

export interface RankingEntryView {
  rank?: number;
  overallRank?: number;
  country: string | null;
  name: string;
  imageUrl?: string | null;
  profileUrl?: string | null;
}
