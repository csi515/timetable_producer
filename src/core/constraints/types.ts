import { Schedule, TimetableData, Teacher, ValidationResult } from '../../types';

export interface ConstraintViolation {
  type: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  details?: any;
  className?: string;
  teacher?: string;
  subject?: string;
  day?: string;
  period?: number;
}

export interface ValidationReport {
  isValid: boolean;
  violations: ConstraintViolation[];
  summary: {
    totalViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
}

export type ConstraintValidator = (
  schedule: Schedule,
  data: TimetableData,
  addLog?: (message: string, type?: string) => void
) => ConstraintViolation[];

export const CONSTRAINT_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  OPTIONAL: 5,
} as const;
