export interface ResultUnit {
  unitId: string | null;
  name: string | null;
  status: string | null;
  datetime: string | null;
  isActive: boolean;
  order: number;
}

export interface ResultEventSummary {
  eventGuid: string;
  title: string | null;
  subtitle: string | null;
  discipline: string | null;
  iconClass: string | null;
  order: number;
  units: ResultUnit[];
}

export interface ResultTable {
  headers: string[];
  rows: string[][];
}

export interface CompetitionMeta {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  location?: string | null;
  dateLabel?: string | null;
  stage?: string | null;
  logo?: string | null;
}
