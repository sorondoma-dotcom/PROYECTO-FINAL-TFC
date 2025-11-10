import { Split } from './result-unit.interface';

export interface ResultRow {
  data: string[];
  splits: Split[] | null;
  hasSplits: boolean;
  expanded?: boolean;
}

export interface ResultTable {
  headers: string[];
  rows: ResultRow[];
}