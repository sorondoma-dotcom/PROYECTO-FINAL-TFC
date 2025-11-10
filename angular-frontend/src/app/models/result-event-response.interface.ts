import { ResultUnit } from './result-unit.interface';
import { ResultTable } from './result-table.interface';

export interface ResultEventResponse {
  success: boolean;
  timestamp: string;
  url: string;
  competition: { id: string; slug: string | null };
  event: { eventGuid: string; title: string | null };
  units: ResultUnit[];
  selectedUnit: ResultUnit | null;
  table: ResultTable;
}