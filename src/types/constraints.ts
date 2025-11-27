import { TimetableEntry } from './timetable';
import { Subject } from './subject';
import { Teacher } from './teacher';

export enum ConstraintType {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Constraint {
  type: ConstraintType;
  name: string;
  check: (entry: TimetableEntry, allEntries: TimetableEntry[], subjects: Subject[], teachers: Teacher[]) => boolean;
  message: (entry: TimetableEntry) => string;
}

export interface ConstraintViolation {
  type: ConstraintType;
  message: string;
  entryId?: string;
  entry?: TimetableEntry;
  details?: any;
}

export interface SoftConstraint {
  name: string;
  weight: number; // 가중치
  evaluate: (entries: TimetableEntry[], subjects: Subject[], teachers: Teacher[]) => number; // 점수 반환 (낮을수록 좋음)
}

