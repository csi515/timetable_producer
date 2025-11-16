// 제약조건 타입 및 상수
export * from './types';

// Critical 제약조건
export * from './critical';

// High 제약조건
export * from './high';

// Medium 제약조건
export * from './medium';

// Low 제약조건
export * from './low';

// 통합 검증 함수
import { Schedule, TimetableData } from '../../types';
import { ConstraintViolation, ValidationReport } from './types';
import { validateCriticalConstraints } from './critical';
import { validateHighConstraints } from './high';
import { validateMediumConstraints } from './medium';
import { validateLowConstraints } from './low';

export const validateAllConstraints = (
  schedule: Schedule,
  data: TimetableData,
  priorityLevel: number = 1, // 1: Critical만, 2: Critical+High, 3: Critical+High+Medium, 4: 모든 제약조건
  addLog?: (message: string, type?: string) => void
): ValidationReport => {
  const violations: ConstraintViolation[] = [];
  
  // Critical 제약조건 검증 (항상 검증)
  violations.push(...validateCriticalConstraints(schedule, data, addLog));
  
  // High 제약조건 검증
  if (priorityLevel >= 2) {
    violations.push(...validateHighConstraints(schedule, data, addLog));
  }
  
  // Medium 제약조건 검증
  if (priorityLevel >= 3) {
    violations.push(...validateMediumConstraints(schedule, data, addLog));
  }
  
  // Low 제약조건 검증
  if (priorityLevel >= 4) {
    violations.push(...validateLowConstraints(schedule, data, addLog));
  }
  
  const criticalViolations = violations.filter(v => v.type === 'critical');
  const highViolations = violations.filter(v => v.type === 'high');
  const mediumViolations = violations.filter(v => v.type === 'medium');
  const lowViolations = violations.filter(v => v.type === 'low');
  
  return {
    isValid: criticalViolations.length === 0,
    violations,
    summary: {
      totalViolations: violations.length,
      criticalViolations: criticalViolations.length,
      highViolations: highViolations.length,
      mediumViolations: mediumViolations.length,
      lowViolations: lowViolations.length,
    },
  };
};
