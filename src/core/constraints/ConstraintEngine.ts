// 제약조건 엔진 통합 클래스

import { IConstraint, BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ValidationReport, ViolationReport } from './types';

// 하드 제약조건
import { TeacherAvailabilityConstraint } from './hard/TeacherConstraints';
import { TeacherNoOverlapConstraint } from './hard/TeacherConstraints';
import { TeacherConsecutiveLimitConstraint } from './hard/TeacherConstraints';
import { TeacherDailyLimitConstraint } from './hard/TeacherConstraints';
import { TeacherWeeklyHoursConstraint } from './hard/TeacherConstraints';
import { ClassNoOverlapConstraint } from './hard/ClassConstraints';
import { GradeCommonTimeConstraint } from './hard/ClassConstraints';
import { SubjectWeeklyHoursConstraint } from './hard/SubjectConstraints';
import { SubjectMaxPerDayConstraint } from './hard/SubjectConstraints';
import { ConsecutiveRequiredConstraint } from './hard/SubjectConstraints';
import { SpecialRoomConflictConstraint } from './hard/FacilityConstraints';
import { CoTeachingConstraint } from './hard/SpecialProgramConstraints';
import { LevelBasedTeachingConstraint } from './hard/SpecialProgramConstraints';

// 소프트 제약조건
import { LunchBeforeOverloadSoftConstraint } from './soft/SoftConstraints';
import { MinimizeConsecutiveSoftConstraint } from './soft/SoftConstraints';
import { SubjectBalanceSoftConstraint } from './soft/SoftConstraints';
import { PreferredPeriodSoftConstraint } from './soft/SoftConstraints';

export interface ConstraintEngineConfig {
  maxConsecutivePeriods?: number;
  lunchPeriod?: number;
  maxBeforeLunch?: number;
  enableSoftConstraints?: boolean;
}

export class ConstraintEngine {
  private hardConstraints: Map<string, IConstraint> = new Map();
  private softConstraints: Map<string, IConstraint> = new Map();
  private defaultHardConstraints: IConstraint[] = [];
  private defaultSoftConstraints: IConstraint[] = [];

  constructor(private data: TimetableData, config?: ConstraintEngineConfig) {
    this.initializeDefaultConstraints(config);
  }

  /**
   * 기본 제약조건 초기화
   */
  private initializeDefaultConstraints(config?: ConstraintEngineConfig): void {
    const maxConsecutive = config?.maxConsecutivePeriods || 3;
    const lunchPeriod = config?.lunchPeriod || data.schoolSchedule.lunchPeriod || 4;
    const maxBeforeLunch = config?.maxBeforeLunch || 3;

    // 하드 제약조건 초기화
    this.defaultHardConstraints = [
      new TeacherAvailabilityConstraint(),
      new TeacherNoOverlapConstraint(),
      new TeacherConsecutiveLimitConstraint(maxConsecutive),
      new TeacherDailyLimitConstraint(),
      new TeacherWeeklyHoursConstraint(),
      new ClassNoOverlapConstraint(),
      new GradeCommonTimeConstraint(),
      new SubjectWeeklyHoursConstraint(),
      new SubjectMaxPerDayConstraint(),
      new ConsecutiveRequiredConstraint(),
      new SpecialRoomConflictConstraint(),
      new CoTeachingConstraint(),
      new LevelBasedTeachingConstraint(),
    ];

    // 하드 제약조건 등록
    for (const constraint of this.defaultHardConstraints) {
      this.hardConstraints.set(constraint.metadata.id, constraint);
    }

    // 소프트 제약조건 초기화 (옵션)
    if (config?.enableSoftConstraints !== false) {
      this.defaultSoftConstraints = [
        new LunchBeforeOverloadSoftConstraint(maxBeforeLunch),
        new MinimizeConsecutiveSoftConstraint(),
        new SubjectBalanceSoftConstraint(),
        new PreferredPeriodSoftConstraint(),
      ];

      // 소프트 제약조건 등록
      for (const constraint of this.defaultSoftConstraints) {
        this.softConstraints.set(constraint.metadata.id, constraint);
      }
    }
  }

  /**
   * 제약조건 추가
   */
  addConstraint(constraint: IConstraint): void {
    if (constraint.metadata.type === 'hard') {
      this.hardConstraints.set(constraint.metadata.id, constraint);
    } else {
      this.softConstraints.set(constraint.metadata.id, constraint);
    }
  }

  /**
   * 제약조건 제거
   */
  removeConstraint(constraintId: string): boolean {
    // 기본 제약조건은 제거 불가
    const isDefaultHard = this.defaultHardConstraints.some((c) => c.metadata.id === constraintId);
    const isDefaultSoft = this.defaultSoftConstraints.some((c) => c.metadata.id === constraintId);

    if (isDefaultHard || isDefaultSoft) {
      console.warn(`기본 제약조건은 제거할 수 없습니다: ${constraintId}`);
      return false;
    }

    return this.hardConstraints.delete(constraintId) || this.softConstraints.delete(constraintId);
  }

  /**
   * 제약조건 목록 가져오기
   */
  getConstraints(): { hard: IConstraint[]; soft: IConstraint[] } {
    return {
      hard: Array.from(this.hardConstraints.values()),
      soft: Array.from(this.softConstraints.values()),
    };
  }

  /**
   * 특정 제약조건 가져오기
   */
  getConstraint(constraintId: string): IConstraint | undefined {
    return this.hardConstraints.get(constraintId) || this.softConstraints.get(constraintId);
  }

  /**
   * 슬롯 배치 전 평가 (하드 제약조건만)
   * @param slot 배치하려는 슬롯
   * @returns 평가 결과
   */
  evaluate(slot: Slot): ConstraintEvaluationResult {
    const violatedConstraints: string[] = [];
    let hasError = false;
    const details: Record<string, any> = {};

    // 하드 제약조건만 검사 (우선순위 순서)
    const constraints = Array.from(this.hardConstraints.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
    });

    for (const constraint of constraints) {
      try {
        const result = constraint.checkBeforePlacement(slot, this.data);

        if (!result.satisfied) {
          violatedConstraints.push(constraint.metadata.id);

          if (result.severity === 'error') {
            hasError = true;
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
      } catch (error) {
        console.error(`제약조건 평가 중 오류 (${constraint.metadata.id}):`, error);
        return this.failure(`제약조건 평가 오류: ${constraint.metadata.name}`, 'error', {
          constraintId: constraint.metadata.id,
          error: error instanceof Error ? error.message : String(error),
        });
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
  validateTimetable(): ValidationReport {
    const hardViolations: ViolationReport[] = [];
    const softViolations: ViolationReport[] = [];
    let totalSoftScore = 0;

    // 하드 제약조건 검증
    for (const constraint of this.hardConstraints.values()) {
      try {
        const result = constraint.validateTimetable(this.data);

        if (!result.satisfied) {
          hardViolations.push({
            constraintId: constraint.metadata.id,
            constraintName: constraint.metadata.name,
            severity: result.severity,
            message: result.reason || `${constraint.metadata.name} 위반`,
            affectedSlots: [],
            details: result.details,
          });
        }
      } catch (error) {
        console.error(`제약조건 검증 중 오류 (${constraint.metadata.id}):`, error);
        hardViolations.push({
          constraintId: constraint.metadata.id,
          constraintName: constraint.metadata.name,
          severity: 'error',
          message: `검증 오류: ${error instanceof Error ? error.message : String(error)}`,
          affectedSlots: [],
        });
      }
    }

    // 소프트 제약조건 점수 계산
    for (const constraint of this.softConstraints.values()) {
      try {
        if (constraint.calculateSoftScore) {
          const score = constraint.calculateSoftScore(this.data);
          totalSoftScore += score;

          if (score > 0) {
            const result = constraint.validateTimetable(this.data);
            softViolations.push({
              constraintId: constraint.metadata.id,
              constraintName: constraint.metadata.name,
              severity: 'warning',
              message: result.reason || `${constraint.metadata.name} 최적화 필요`,
              affectedSlots: [],
              details: { score },
            });
          }
        }
      } catch (error) {
        console.error(`소프트 제약조건 계산 중 오류 (${constraint.metadata.id}):`, error);
      }
    }

    return {
      isValid: hardViolations.length === 0,
      hardViolations,
      softViolations,
      totalScore: totalSoftScore,
      summary: {
        totalConstraints: this.hardConstraints.size + this.softConstraints.size,
        hardConstraints: this.hardConstraints.size,
        softConstraints: this.softConstraints.size,
        hardViolations: hardViolations.length,
        softViolations: softViolations.length,
      },
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
      type: string;
      priority: string;
      category: string;
    }>;
    validationResult: ValidationReport;
  } {
    const allConstraints = [...this.hardConstraints.values(), ...this.softConstraints.values()];
    const constraints = allConstraints.map((c) => ({
      id: c.metadata.id,
      name: c.metadata.name,
      description: c.metadata.description,
      type: c.metadata.type,
      priority: c.metadata.priority,
      category: c.metadata.category,
    }));

    const validationResult = this.validateTimetable();

    return {
      totalConstraints: allConstraints.length,
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
    const config = {
      maxConsecutivePeriods: 3,
      lunchPeriod: data.schoolSchedule.lunchPeriod,
      maxBeforeLunch: 3,
    };
    this.initializeDefaultConstraints(config);
  }

  /**
   * 실패 결과 생성 헬퍼
   */
  private failure(
    reason: string,
    severity: 'error' | 'warning' = 'error',
    details?: Record<string, any>
  ): ConstraintEvaluationResult {
    return {
      satisfied: false,
      reason,
      violatedConstraints: [],
      severity,
      details,
    };
  }
}
