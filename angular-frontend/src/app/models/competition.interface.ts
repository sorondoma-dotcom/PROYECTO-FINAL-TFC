export interface Competition {
  name: string;
  stage: string | null;
  date: string | null;
  startDate: string | null;
  endDate: string | null;
  poolName: string | null;
  city: string | null;
  countryCode: string | null;
  flagImage: string | null;
  logo: string | null;
  url: string | null;
  month: string | null;
  year: string | null;
  monthNumber: number | null;
  status?: string | null;
  competitionId?: number | null;
}

export interface CompetitionGroup {
  key: string;
  label: string;
  competitions: Competition[];
  sortValue: number;
}
