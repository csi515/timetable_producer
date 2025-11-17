// 분포 관련 소프트 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from '../types';

/**
 * 점심 전 과도한 배치 방지 (소프트 제약조건)
 */
export class LunchBeforeOverloadSoftConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'lunch_before_overload_soft',
    name: '점심 전 과도한 배치 방지',
    description: '점심 시간 전에 특정 교사에게 수업이 과도하게 몰리지 않도록 합니다.',
    type: 'soft',
    category: 'distribution',
    priority: 10,
  };

  private readonly lunchPeriod: number;
  private readonly maxBeforeLunch: number;
  private readonly penaltyPerExcess: number;

  constructor(lunchPeriod: number = 4, maxBeforeLunch: number = 2, penaltyPerExcess: number = 5) {
    super();
    this.lunchPeriod = lunchPeriod;
    this.maxBeforeLunch = maxBeforeLunch;
    this.penaltyPerExcess = penaltyPerExcess;
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 하드 제약조건이 아니므로 항상 통과
    return this.success();
  }

  checkSoftConstraint(slot: Slot, timetable: TimetableData): number {
    if (!slot.teacherId || slot.period > this.lunchPeriod) {
      return 0;
    }

    return this.safeGet(() => {
      const beforeLunchCount = this.countBeforeLunch(timetable, slot.teacherId, slot.day);

      if (beforeLunchCount >= this.maxBeforeLunch) {
        const excess = beforeLunchCount - this.maxBeforeLunch + 1; // 새로 배정되면 +1
        return excess * this.penaltyPerExcess;
      }

      return 0;
    }, 0);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    let totalPenalty = 0;

    const lunchPeriod = timetable.schoolConfig.lunchPeriod || this.lunchPeriod;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolConfig.days) {
        const beforeLunchCount = this.countBeforeLunch(timetable, teacher.id, day, lunchPeriod);

        if (beforeLunchCount > this.maxBeforeLunch) {
          const excess = beforeLunchCount - this.maxBeforeLunch;
          violations.push(
            `${teacher.name} 교사가 ${day}요일 점심 전(${lunchPeriod}교시까지)에 ${beforeLunchCount}교시 수업 (권장: ${this.maxBeforeLunch}교시 이하)`
          );
          totalPenalty += excess * this.penaltyPerExcess;
        }
      }
    }

    if (violations.length > 0) {
      return this.softViolation(
        `점심 전 과도한 배치 ${violations.length}건 발견`,
        totalPenalty,
        { violations }
      );
    }

    return this.success();
  }

  private countBeforeLunch(timetable: TimetableData, teacherId: string, day: string, lunchPeriod?: number): number {
    const period = lunchPeriod || this.lunchPeriod;
    let count = 0;

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const daySchedule = classSchedule[day as keyof typeof classSchedule];
      if (!daySchedule) continue;

      for (let p = 1; p <= period; p++) {
        const slot = daySchedule[p];
        if (slot && (slot.teacherId === teacherId || slot.coTeachers?.includes(teacherId))) {
          count++;
        }
      }
    }

    return count;
  }
}

/**
 * 고르게 분포 제약조건 (소프트)
 */
export class EvenDistributionSoftConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'even_distribution_soft',
    name: '고르게 분포',
    description: '각 반에 모든 과목이 주간에 고르게 분포되도록 합니다.',
    type: 'soft',
    category: 'distribution',
    priority: 15,
  };

  private readonly minDaysBetween: number;
  private readonly penaltyPerViolation: number;

  constructor(minDaysBetween: number = 1, penaltyPerViolation: number = 2) {
    super();
    this.minDaysBetween = minDaysBetween;
    this.penaltyPerViolation = penaltyPerViolation;
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  checkSoftConstraint(slot: Slot, timetable: TimetableData): number {
    if (!slot.subjectId || !slot.classId) {
      return 0;
    }

    return this.safeGet(() => {
      const assignedDays = this.getAssignedDaysForSubject(timetable, slot.classId, slot.subjectId);

      if (assignedDays.length > 0) {
        const days = timetable.schoolConfig.days;
        const currentDayIndex = days.indexOf(slot.day);
        const lastAssignedIndex = Math.max(...assignedDays.map((d) => days.indexOf(d)));

        const daysBetween = Math.abs(currentDayIndex - lastAssignedIndex);

        if (daysBetween < this.minDaysBetween) {
          return this.penaltyPerViolation;
        }
      }

      return 0;
    }, 0);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    let totalPenalty = 0;

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const assignedDays = this.getAssignedDaysForSubject(timetable, classItem.id, subject.id);

        if (assignedDays.length < 2) continue;

        const days = timetable.schoolConfig.days;
        const sortedIndices = assignedDays.map((d) => days.indexOf(d)).sort((a, b) => a - b);

        for (let i = 0; i < sortedIndices.length - 1; i++) {
          const daysBetween = sortedIndices[i + 1] - sortedIndices[i];
          if (daysBetween < this.minDaysBetween) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${days[sortedIndices[i]]}요일과 ${days[sortedIndices[i + 1]]}요일에 너무 가깝게 배정됨`
            );
            totalPenalty += this.penaltyPerViolation;
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.softViolation(`분포 불균형 ${violations.length}건 발견`, totalPenalty, { violations });
    }

    return this.success();
  }

  private getAssignedDaysForSubject(timetable: TimetableData, classId: string, subjectId: string): string[] {
    const assignedDays: string[] = [];
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return assignedDays;

    for (const day of timetable.schoolConfig.days) {
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
      for (let period = 1; period <= maxPeriod; period++) {
        const slot = daySchedule[period];
        if (slot && slot.subjectId === subjectId) {
          if (!assignedDays.includes(day)) {
            assignedDays.push(day);
          }
          break; // 하루에 하나만 카운트
        }
      }
    }

    return assignedDays;
  }
}

/**
 * 교사 연속 수업 최소화 (소프트)
 */
export class MinimizeConsecutiveLessonsSoftConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'minimize_consecutive_lessons_soft',
    name: '교사 연속 수업 최소화',
    description: '교사의 연속 수업을 최소화합니다.',
    type: 'soft',
    category: 'distribution',
    priority: 12,
  };

  private readonly penaltyPerConsecutive: number;

  constructor(penaltyPerConsecutive: number = 3) {
    super();
    this.penaltyPerConsecutive = penaltyPerConsecutive;
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  checkSoftConstraint(slot: Slot, timetable: TimetableData): number {
    if (!slot.teacherId || !slot.classId) {
      return 0;
    }

    return this.safeGet(() => {
      const consecutiveCount = this.countConsecutivePeriods(
        timetable,
        slot.teacherId!,
        slot.classId,
        slot.day,
        slot.period
      );

      // 연속 2교시 이상이면 페널티
      if (consecutiveCount >= 1) {
        return consecutiveCount * this.penaltyPerConsecutive;
      }

      return 0;
    }, 0);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    let totalPenalty = 0;
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned =
              slot && (slot.teacherId === teacher.id || slot.coTeachers?.includes(teacher.id));

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount >= 2) {
                const classItem = timetable.classes.find((c) => c.id === classId);
                violations.push(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일에 연속 ${consecutiveCount}교시 수업`
                );
                totalPenalty += (consecutiveCount - 1) * this.penaltyPerConsecutive;
              }
              consecutiveCount = 0;
            }
          }

          // 마지막까지 연속인 경우
          if (consecutiveCount >= 2) {
            const classItem = timetable.classes.find((c) => c.id === classId);
            violations.push(
              `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일에 연속 ${consecutiveCount}교시 수업`
            );
            totalPenalty += (consecutiveCount - 1) * this.penaltyPerConsecutive;
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.softViolation(`연속 수업 ${violations.length}건 발견`, totalPenalty, { violations });
    }

    return this.success();
  }
}

/**
 * 과목 균형 배치 (소프트)
 */
export class SubjectBalanceSoftConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'subject_balance_soft',
    name: '과목 균형 배치',
    description: '과목이 월~금 고르게 분포되도록 합니다.',
    type: 'soft',
    category: 'distribution',
    priority: 14,
  };

  private readonly penaltyPerImbalance: number;

  constructor(penaltyPerImbalance: number = 2) {
    super();
    this.penaltyPerImbalance = penaltyPerImbalance;
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  checkSoftConstraint(slot: Slot, timetable: TimetableData): number {
    // 개별 슬롯 배치 시에는 점수 계산하지 않음 (전체 검증에서만)
    return 0;
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    let totalPenalty = 0;
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        const dayCounts: Record<string, number> = {};

        for (const day of timetable.schoolConfig.days) {
          dayCounts[day] = 0;
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              dayCounts[day]++;
              break; // 하루에 하나만 카운트
            }
          }
        }

        // 분포의 표준편차 계산
        const counts = Object.values(dayCounts);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 크면 페널티
        if (stdDev > 0.5) {
          violations.push(
            `${classItem.name}의 ${subject.name} 과목이 요일별로 불균등하게 배정됨 (표준편차: ${stdDev.toFixed(2)})`
          );
          totalPenalty += stdDev * this.penaltyPerImbalance;
        }
      }
    }

    if (violations.length > 0) {
      return this.softViolation(`과목 균형 배치 위반 ${violations.length}건 발견`, totalPenalty, { violations });
    }

    return this.success();
  }
}
