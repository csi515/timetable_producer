// 제약조건 엔진 통합 클래스

import { IConstraint, BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from './types';
import { TeacherAvailabilityConstraint } from './TeacherAvailabilityConstraint';
import { TeacherNoOverlapConstraint } from './TeacherNoOverlapConstraint';
import { ClassNoOverlapConstraint } from './ClassNoOverlapConstraint';
import { MaxConsecutivePeriodsConstraint } from './MaxConsecutivePeriodsConstraint';
import { MaxDailyLessonForTeacherConstraint } from './MaxDailyLessonForTeacherConstraint';
import { LunchBeforeOverloadConstraint } from './LunchBeforeOverloadConstraint';
import { SpreadDistributionConstraint } from './SpreadDistributionConstraint';
import { ConsecutiveRequiredConstraint } from './ConsecutiveRequiredConstraint';
import { MaxPerDayConstraint } from './MaxPerDayConstraint';
import { SpecialRoomConflictConstraint } from './SpecialRoomConflictConstraint';

export interface ConstraintEngineConfig {
  maxConsecutivePeriods?: number;
  lunchPeriod?: number;
  maxBeforeLunch?: number;
  minDaysBetween?: number;
}

export class ConstraintEngine {
  private constraints: Map<string, IConstraint> = new Map();
  private defaultConstraints: IConstraint[] = [];

  constructor(private data: TimetableData, config?: ConstraintEngineConfig) {
    this.initializeDefaultConstraints(config);
  }

  /**
   * 기본 제약조건 초기화
   */
  private initializeDefaultConstraints(config?: ConstraintEngineConfig): void {
    this.defaultConstraints = [
      new TeacherAvailabilityConstraint(),
      new TeacherNoOverlapConstraint(),
      new ClassNoOverlapConstraint(),
      new MaxConsecutivePeriodsConstraint({
        maxConsecutive: config?.maxConsecutivePeriods || 3,
      }),
      new MaxDailyLessonForTeacherConstraint(),
      new LunchBeforeOverloadConstraint({
        lunchPeriod: config?.lunchPeriod || data.schoolSchedule.lunchPeriod || 4,
        maxBeforeLunch: config?.maxBeforeLunch || 3,
      }),
      new ConsecutiveRequiredConstraint(),
      new MaxPerDayConstraint(),
      new SpecialRoomConflictConstraint(),
      new SpreadDistributionConstraint({
        minDaysBetween: config?.minDaysBetween || 1,
      }),
    ];

    // 기본 제약조건 등록
    for (const constraint of this.defaultConstraints) {
      this.constraints.set(constraint.metadata.id, constraint);
    }
  }

  /**
   * 제약조건 추가
   */
  addConstraint(constraint: IConstraint): void {
    this.constraints.set(constraint.metadata.id, constraint);
  }

  /**
   * 제약조건 제거
   */
  removeConstraint(constraintId: string): boolean {
    // 기본 제약조건은 제거 불가
    const isDefault = this.defaultConstraints.some(c => c.metadata.id === constraintId);
    if (isDefault) {
      console.warn(`기본 제약조건은 제거할 수 없습니다: ${constraintId}`);
      return false;
    }

    return this.constraints.delete(constraintId);
  }

  /**
   * 제약조건 목록 가져오기
   */
  getConstraints(): IConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * 특정 제약조건 가져오기
   */
  getConstraint(constraintId: string): IConstraint | undefined {
    return this.constraints.get(constraintId);
  }

  /**
   * 슬롯 배치 전 평가
   * @param slot 배치하려는 슬롯
   * @param priority 제약조건 우선순위 필터 ('critical' | 'high' | 'medium' | 'low' | 'all')
   * @returns 평가 결과
   */
  evaluate(slot: Slot, priority: 'critical' | 'high' | 'medium' | 'low' | 'all' = 'all'): ConstraintEvaluationResult {
    const violatedConstraints: string[] = [];
    let hasError = false;
    let hasWarning = false;
    const details: Record<string, any> = {};

    // 제약조건 우선순위별로 정렬 (critical -> high -> medium -> low)
    const constraints = Array.from(this.constraints.values())
      .filter(c => priority === 'all' || c.metadata.priority === priority)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
      });

    for (const constraint of constraints) {
      const result = constraint.checkBeforePlacement(slot, this.data);

      if (!result.satisfied) {
        violatedConstraints.push(constraint.metadata.id);

        if (result.severity === 'error') {
          hasError = true;
        } else {
          hasWarning = true;
        }

        details[constraint.metadata.id] = {
          name: constraint.metadata.name,
          reason: result.reason,
          severity: result.severity,
          details: result.details,
        };

        // Critical 제약조건 위반 시 즉시 반환
        if (constraint.metadata.priority === 'critical' && result.severity === 'error') {
          return {
            satisfied: false,
            reason: result.reason || `${constraint.metadata.name} 위반`,
            violatedConstraints,
            severity: 'error',
            details,
          };
        }
      }
    }

    if (hasError || violatedConstraints.length > 0) {
      return {
        satisfied: false,
        reason: `${violatedConstraints.length}개 제약조건 위반`,
        violatedConstraints,
        severity: hasError ? 'error' : 'warning',
        details,
      };
    }

    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'error',
    };
  }

  /**
   * 전체 시간표 검증
   */
  validateTimetable(priority: 'critical' | 'high' | 'medium' | 'low' | 'all' = 'all'): ConstraintEvaluationResult {
    const violatedConstraints: string[] = [];
    let hasError = false;
    let hasWarning = false;
    const details: Record<string, any> = {};
    const allViolations: string[] = [];

    const constraints = Array.from(this.constraints.values())
      .filter(c => priority === 'all' || c.metadata.priority === priority)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
      });

    for (const constraint of constraints) {
      const result = constraint.validateTimetable(this.data);

      if (!result.satisfied) {
        violatedConstraints.push(constraint.metadata.id);

        if (result.severity === 'error') {
          hasError = true;
        } else {
          hasWarning = true;
        }

        details[constraint.metadata.id] = {
          name: constraint.metadata.name,
          reason: result.reason,
          severity: result.severity,
          details: result.details,
        };

        if (result.details?.violations) {
          allViolations.push(...result.details.violations);
        }
      }
    }

    if (violatedConstraints.length > 0) {
      return {
        satisfied: false,
        reason: `${violatedConstraints.length}개 제약조건 위반 발견`,
        violatedConstraints,
        severity: hasError ? 'error' : 'warning',
        details: {
          ...details,
          allViolations,
        },
      };
    }

    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'error',
    };
  }

  /**
   * 제약조건 리포트 생성
   */
  generateReport(): {
    totalConstraints: number;
    constraints: Array<{
      id: string;
      name: string;
      description: string;
      priority: string;
      category: string;
    }>;
    validationResult: ConstraintEvaluationResult;
  } {
    const constraints = Array.from(this.constraints.values()).map(c => ({
      id: c.metadata.id,
      name: c.metadata.name,
      description: c.metadata.description,
      priority: c.metadata.priority,
      category: c.metadata.category,
    }));

    const validationResult = this.validateTimetable();

    return {
      totalConstraints: this.constraints.size,
      constraints,
      validationResult,
    };
  }

  /**
   * 데이터 업데이트
   */
  updateData(data: TimetableData): void {
    this.data = data;
    // 기본 제약조건 재초기화 (설정 변경 반영)
    this.initializeDefaultConstraints();
  }
}
