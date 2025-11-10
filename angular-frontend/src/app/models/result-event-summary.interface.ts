import { ResultUnit } from './result-unit.interface';

export interface ResultEventSummary {
  eventGuid: string;
  title: string;
  subtitle?: string;
  discipline?: string;
  units?: ResultUnit[];
}