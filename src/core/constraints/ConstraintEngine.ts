// 제약조건 엔진 통합 클래스

import { IConstraint, BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintEngineConfig } from './types';

// 하드 제약조건
import { TeacherAvailabilityConstraint } from './teacher_constraints';
import { TeacherNoOverlapConstraint } from './teacher_constraints';
import { TeacherConsecutiveLimitConstraint } from './teacher_constraints';
import { TeacherDailyLimitConstraint } from './teacher_constraints';
import { TeacherWeeklyHoursConstraint } from './teacher_constraints';
import { LunchBeforeOverloadConstraint } from './teacher_constraints';

import { ClassNoOverlapConstraint } from './class_constraints';
import { GradeCommonTimeConstraint } from './class_constraints';

import { SubjectWeeklyHoursConstraint } from './subject_constraints';
import { SubjectMaxPerDayConstraint } from './subject_constraints';
import { SubjectFixedTimeConstraint } from './subject_constraints';
import { ConsecutiveRequiredConstraint } from './subject_constraints';

import { SpecialRoomConflictConstraint } from './facility_constraints';

import { CoTeachingConstraint } from './special_programs_constraints';
import { LevelBasedTeachingConstraint } from './special_programs_constraints';

// 소프트 제약조건
import { MinimizeConsecutiveConstraint } from './soft_constraints';
import { BalancedDistributionConstraint } from './soft_constraints';
import { MorningAfternoonBalanceConstraint } from './soft_constraints';
import { StudentFatigueConstraint } from './soft_constraints';

export class ConstraintEngine {
  private hardConstraints: Map<string, IConstraint> = new Map();
  private softConstraints: Map<string, IConstraint> = new Map();
  private defaultHardConstraints: IConstraint[] = [];
  private defaultSoftConstraints: IConstraint[] = [];

  constructor(private data: TimetableData, private config?: ConstraintEngineConfig) {
    this.initializeConstraints();
  }

  /**
   * 제약조건 초기화
   */
  private initializeConstraints(): void {
    const maxConsecutive = this.config?.maxConsecutivePeriods || 3;
    const lunchPeriod = this.config?.lunchPeriod || this.data.schoolSchedule.lunchPeriod || 4;
    const maxBeforeLunch = this.config?.maxBeforeLunch || 2;

    // 하드 제약조건 초기화
    this.defaultHardConstraints = [
      new TeacherAvailabilityConstraint(),
      new TeacherNoOverlapConstraint(),
      new TeacherConsecutiveLimitConstraint(maxConsecutive),
      new TeacherDailyLimitConstraint(),
      new TeacherWeeklyHoursConstraint(),
      new LunchBeforeOverloadConstraint(lunchPeriod, maxBeforeLunch),
      new ClassNoOverlapConstraint(),
      new GradeCommonTimeConstraint(),
      new SubjectWeeklyHoursConstraint(),
      new SubjectMaxPerDayConstraint(),
      new SubjectFixedTimeConstraint(),
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
    if (this.config?.enableSoftConstraints !== false) {
      this.defaultSoftConstraints = [
        new MinimizeConsecutiveConstraint(),
        new BalancedDistributionConstraint(),
        new MorningAfternoonBalanceConstraint(lunchPeriod),
        new StudentFatigueConstraint(lunchPeriod),
      ];

      for (const constraint of this.defaultSoftConstraints) {
        this.softConstraints.set(constraint.metadata.id, constraint);
      }
    }
  }

  /**
   * 제약조건 추가
   */
  addConstraint(constraint: IConstraint): void {
    if (constraint.metadata.isHard) {
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
    const isDefaultHard = this.defaultHardConstraints.some(c => c.metadata.id === constraintId);
    const isDefaultSoft = this.defaultSoftConstraints.some(c => c.metadata.id === constraintId);
    
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
   * @param priority 제약조건 우선순위 필터
   * @returns 평가 결과
   */
  evaluate(slot: Slot, priority?: 'critical' | 'high' | 'medium' | 'low' | 'all'): ConstraintEvaluationResult {
    const violatedConstraints: string[] = [];
    let hasError = false;
    let hasWarning = false;
    const details: Record<string, any> = {};

    // 하드 제약조건만 평가
    const constraints = Array.from(this.hardConstraints.values())
      .filter(c => !priority || priority === 'all' || c.metadata.priority === priority)
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
   * 전체 시간표 검증 (하드 제약조건)
   */
  validateTimetable(priority?: 'critical' | 'high' | 'medium' | 'low' | 'all'): ConstraintEvaluationResult {
    const violatedConstraints: string[] = [];
    let hasError = false;
    let hasWarning = false;
    const details: Record<string, any> = {};
    const allViolations: string[] = [];

    const constraints = Array.from(this.hardConstraints.values())
      .filter(c => !priority || priority === 'all' || c.metadata.priority === priority)
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
   * 소프트 제약조건 점수 계산
   */
  calculateSoftScore(): number {
    let totalScore = 0;

    const constraints = Array.from(this.softConstraints.values());
    for (const constraint of constraints) {
      if (constraint.calculateSoftScore) {
        const score = constraint.calculateSoftScore(this.data);
        totalScore += score;
      }
    }

    return totalScore;
  }

  /**
   * 제약조건 리포트 생성
   */
  generateReport(): {
    totalHardConstraints: number;
    totalSoftConstraints: number;
    constraints: Array<{
      id: string;
      name: string;
      description: string;
      priority: string;
      category: string;
      isHard: boolean;
    }>;
    validationResult: ConstraintEvaluationResult;
    softScore: number;
  } {
    const hardConstraints = Array.from(this.hardConstraints.values()).map(c => ({
      id: c.metadata.id,
      name: c.metadata.name,
      description: c.metadata.description,
      priority: c.metadata.priority,
      category: c.metadata.category,
      isHard: true,
    }));

    const softConstraints = Array.from(this.softConstraints.values()).map(c => ({
      id: c.metadata.id,
      name: c.metadata.name,
      description: c.metadata.description,
      priority: c.metadata.priority,
      category: c.metadata.category,
      isHard: false,
    }));

    const validationResult = this.validateTimetable();
    const softScore = this.calculateSoftScore();

    return {
      totalHardConstraints: this.hardConstraints.size,
      totalSoftConstraints: this.softConstraints.size,
      constraints: [...hardConstraints, ...softConstraints],
      validationResult,
      softScore,
    };
  }

  /**
   * 데이터 업데이트
   */
  updateData(data: TimetableData): void {
    this.data = data;
    // 제약조건 재초기화 (설정 변경 반영)
    this.initializeConstraints();
  }
}
