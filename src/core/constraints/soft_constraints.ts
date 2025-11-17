// 소프트 제약조건 (점수 기반)

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from './types';
import { countConsecutivePeriods, countSubjectDailyLessons } from './utils';

/**
 * 교사 연속 수업 최소화 (소프트)
 */
export class MinimizeConsecutiveConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'minimize_consecutive',
    name: '교사 연속 수업 최소화',
    description: '교사의 연속 수업을 최소화합니다.',
    priority: 'low' as const,
    category: 'distribution' as const,
    isHard: false,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 소프트 제약조건은 배치를 막지 않음
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    // 검증은 항상 통과
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let score = 0;

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
          let consecutiveCount = 0;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount > 1) {
                // 연속 수업에 페널티 (연속이 길수록 페널티 증가)
                score += (consecutiveCount - 1) * 2;
              }
              consecutiveCount = 0;
            }
          }

          // 마지막까지 연속인 경우
          if (consecutiveCount > 1) {
            score += (consecutiveCount - 1) * 2;
          }
        }
      }
    }

    return score;
  }
}

/**
 * 과목 균형 배치 (소프트)
 */
export class BalancedDistributionConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'balanced_distribution',
    name: '과목 균형 배치',
    description: '과목이 주간에 고르게 분포되도록 합니다.',
    priority: 'low' as const,
    category: 'distribution' as const,
    isHard: false,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let score = 0;

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const dayCounts: Record<string, number> = {};

        // 각 요일별 배정 횟수 계산
        for (const day of timetable.schoolSchedule.days) {
          dayCounts[day] = countSubjectDailyLessons(timetable, classItem.id, subject.id, day);
        }

        // 분포의 표준편차 계산
        const counts = Object.values(dayCounts);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 크면 페널티
        if (stdDev > 0.5) {
          score += stdDev * 3;
        }
      }
    }

    return score;
  }
}

/**
 * 오전/오후 균형 (소프트)
 */
export class MorningAfternoonBalanceConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'morning_afternoon_balance',
    name: '오전/오후 균형',
    description: '오전/오후에 특정 과목이 몰리지 않도록 합니다.',
    priority: 'low' as const,
    category: 'distribution' as const,
    isHard: false,
  };

  constructor(private lunchPeriod: number = 4) {
    super();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let score = 0;
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod || this.lunchPeriod;

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        let morningCount = 0;
        let afternoonCount = 0;

        for (const day of timetable.schoolSchedule.days) {
          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];

          // 오전 (점심 전)
          for (let period = 1; period <= lunchPeriod; period++) {
            const count = countSubjectDailyLessons(timetable, classItem.id, subject.id, day);
            if (count > 0) {
              const slot = timetable.timetable[classItem.id]?.[day]?.[period];
              if (slot && slot.subjectId === subject.id) {
                morningCount++;
              }
            }
          }

          // 오후 (점심 후)
          for (let period = lunchPeriod + 1; period <= maxPeriod; period++) {
            const slot = timetable.timetable[classItem.id]?.[day]?.[period];
            if (slot && slot.subjectId === subject.id) {
              afternoonCount++;
            }
          }
        }

        // 오전/오후 불균형 페널티
        const imbalance = Math.abs(morningCount - afternoonCount);
        if (imbalance > 2) {
          score += imbalance * 2;
        }
      }
    }

    return score;
  }
}

/**
 * 학생 피로도 고려 (소프트)
 */
export class StudentFatigueConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'student_fatigue',
    name: '학생 피로도 고려',
    description: '집중 과목은 오전, 예체능은 오후에 배치를 우선합니다.',
    priority: 'low' as const,
    category: 'distribution' as const,
    isHard: false,
  };

  constructor(
    private lunchPeriod: number = 4,
    private intensiveSubjects: string[] = [], // 집중 과목 ID 목록
    private physicalSubjects: string[] = [] // 예체능 과목 ID 목록
  ) {
    super();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let score = 0;
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod || this.lunchPeriod;

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const isIntensive = this.intensiveSubjects.includes(subject.id);
        const isPhysical = this.physicalSubjects.includes(subject.id);

        if (!isIntensive && !isPhysical) continue;

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = timetable.timetable[classItem.id]?.[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!slot || slot.subjectId !== subject.id) continue;

            // 집중 과목은 오전(1-2교시)에 배치되면 보너스, 오후에 배치되면 페널티
            if (isIntensive) {
              if (period <= 2) {
                score -= 1; // 보너스
              } else if (period > lunchPeriod) {
                score += 3; // 페널티
              }
            }

            // 예체능 과목은 오후(5-6교시)에 배치되면 보너스, 오전에 배치되면 페널티
            if (isPhysical) {
              if (period >= 5) {
                score -= 1; // 보너스
              } else if (period <= lunchPeriod) {
                score += 2; // 페널티
              }
            }
          }
        }
      }
    }

    return Math.max(0, score); // 음수는 0으로
  }
}
