import { TimetableEntry } from './timetable';
import { Subject } from './subject';
import { Teacher } from './teacher';
import { ClassInfo } from './timetable';

export enum ConstraintType {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Constraint {
  type: ConstraintType;
  name: string;
  check: (entry: TimetableEntry, allEntries: TimetableEntry[], subjects: Subject[], teachers: Teacher[], classes?: ClassInfo[]) => boolean;
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
  evaluate: (entries: TimetableEntry[], subjects: Subject[], teachers: Teacher[], classes?: ClassInfo[]) => number; // 점수 반환 (낮을수록 좋음)
}

