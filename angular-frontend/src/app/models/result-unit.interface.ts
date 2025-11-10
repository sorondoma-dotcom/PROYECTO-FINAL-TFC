export interface ResultUnit {
  unitId: string | null;
  name: string | null;
  status: string | null;
  datetime: string | null;
  isActive: boolean;
  order: number;
}

export interface Split {
  distance: string;
  splitTime: string;
  cumulativeTime: string;
}