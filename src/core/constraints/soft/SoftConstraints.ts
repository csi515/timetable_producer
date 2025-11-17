// 소프트 제약조건 (가능하면 지키기)

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';
import {
  countBeforeLunch,
  countConsecutivePeriods,
  countDailyLessonsForSubject,
} from '../utils';

/**
 * 점심 전 과도한 배치 방지 (소프트)
 */
export class LunchBeforeOverloadSoftConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'lunch_before_overload_soft',
    name: '점심 전 과도한 배치 방지',
    description: '점심 시간 전에 특정 교사에게 수업이 과도하게 몰리지 않도록 합니다.',
    type: 'soft' as const,
    priority: 'medium' as const,
    category: 'distribution',
  };

  private readonly maxBeforeLunch: number;
  private readonly penaltyPerExcess: number;

  constructor(maxBeforeLunch: number = 3, penaltyPerExcess: number = 5) {
    super();
    this.maxBeforeLunch = maxBeforeLunch;
    this.penaltyPerExcess = penaltyPerExcess;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || slot.period > timetable.schoolSchedule.lunchPeriod) {
      return this.success(0);
    }

    const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
    if (!teacher) {
      return this.success(0);
    }

    const beforeLunchCount = countBeforeLunch(
      timetable,
      slot.teacherId,
      slot.day,
      timetable.schoolSchedule.lunchPeriod
    );

    const excess = Math.max(0, beforeLunchCount + 1 - this.maxBeforeLunch);
    const score = excess * this.penaltyPerExcess;

    if (excess > 0) {
      return this.failure(
        `${teacher.name} 교사가 ${slot.day}요일 점심 전에 ${beforeLunchCount + 1}교시 수업 (권장: ${this.maxBeforeLunch}교시 이하)`,
        'warning',
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          currentCount: beforeLunchCount + 1,
          maxCount: this.maxBeforeLunch,
        },
        score
      );
    }

    return this.success(0);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    let totalScore = 0;
    const violations: string[] = [];
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolSchedule.days) {
        const beforeLunchCount = countBeforeLunch(timetable, teacher.id, day, lunchPeriod);

        if (beforeLunchCount > this.maxBeforeLunch) {
          const excess = beforeLunchCount - this.maxBeforeLunch;
          totalScore += excess * this.penaltyPerExcess;
          violations.push(
            `${teacher.name} 교사가 ${day}요일 점심 전(${lunchPeriod}교시까지)에 ${beforeLunchCount}교시 수업 (권장: ${this.maxBeforeLunch}교시 이하)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `점심 전 과도한 배치 ${violations.length}건 발견`,
        'warning',
        { violations },
        totalScore
      );
    }

    return this.success(0);
  }

  calculateSoftScore(timetable: TimetableData): number {
    let totalScore = 0;
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolSchedule.days) {
        const beforeLunchCount = countBeforeLunch(timetable, teacher.id, day, lunchPeriod);
        const excess = Math.max(0, beforeLunchCount - this.maxBeforeLunch);
        totalScore += excess * this.penaltyPerExcess;
      }
    }

    return totalScore;
  }
}

/**
 * 교사 연속수업 최소화 (소프트)
 */
export class MinimizeConsecutiveSoftConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'minimize_consecutive_soft',
    name: '교사 연속수업 최소화',
    description: '교사의 연속 수업을 최소화합니다.',
    type: 'soft' as const,
    priority: 'low' as const,
    category: 'teacher',
  };

  private readonly penaltyPerConsecutive: number;

  constructor(penaltyPerConsecutive: number = 2) {
    super();
    this.penaltyPerConsecutive = penaltyPerConsecutive;
  }

  calculateSoftScore(timetable: TimetableData): number {
    let totalScore = 0;

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
                // 2교시 이상 연속이면 페널티
                totalScore += (consecutiveCount - 1) * this.penaltyPerConsecutive;
              }
              consecutiveCount = 0;
            }
          }

          // 마지막까지 연속인 경우
          if (consecutiveCount > 1) {
            totalScore += (consecutiveCount - 1) * this.penaltyPerConsecutive;
          }
        }
      }
    }

    return totalScore;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || !slot.classId) {
      return this.success(0);
    }

    const consecutiveCount = countConsecutivePeriods(timetable, slot.teacherId, slot.classId, slot.day, slot.period);
    const score = consecutiveCount > 0 ? consecutiveCount * this.penaltyPerConsecutive : 0;

    return this.success(score);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const score = this.calculateSoftScore(timetable);
    return this.success(score);
  }
}

/**
 * 과목 균형 배치 (소프트)
 */
export class SubjectBalanceSoftConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_balance_soft',
    name: '과목 균형 배치',
    description: '과목이 주간에 고르게 분포되도록 합니다.',
    type: 'soft' as const,
    priority: 'low' as const,
    category: 'distribution',
  };

  private readonly penaltyPerDeviation: number;

  constructor(penaltyPerDeviation: number = 1) {
    super();
    this.penaltyPerDeviation = penaltyPerDeviation;
  }

  calculateSoftScore(timetable: TimetableData): number {
    let totalScore = 0;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        const dayCounts: Record<string, number> = {};

        for (const day of timetable.schoolSchedule.days) {
          dayCounts[day] = countDailyLessonsForSubject(timetable, classItem.id, subject.id, day);
        }

        // 분포의 표준편차 계산
        const counts = Object.values(dayCounts);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 크면 페널티
        if (stdDev > 0.5) {
          totalScore += stdDev * this.penaltyPerDeviation;
        }
      }
    }

    return totalScore;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 배치 전에는 점수 계산 불가
    return this.success(0);
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const score = this.calculateSoftScore(timetable);
    return this.success(score);
  }
}

/**
 * 선호 교시 배치 (소프트)
 */
export class PreferredPeriodSoftConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'preferred_period_soft',
    name: '선호 교시 배치',
    description: '과목의 선호 교시에 배치되도록 합니다.',
    type: 'soft' as const,
    priority: 'low' as const,
    category: 'subject',
  };

  private readonly penaltyPerNonPreferred: number;

  constructor(penaltyPerNonPreferred: number = 3) {
    super();
    this.penaltyPerNonPreferred = penaltyPerNonPreferred;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success(0);
    }

    const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
    if (!subject?.preferredPeriods || subject.preferredPeriods.length === 0) {
      return this.success(0);
    }

    const isPreferred = subject.preferredPeriods.includes(slot.period);
    const score = isPreferred ? 0 : this.penaltyPerNonPreferred;

    return this.success(score);
  }

  calculateSoftScore(timetable: TimetableData): number {
    let totalScore = 0;

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolSchedule.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.subjectId) continue;

          const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
          if (!subject?.preferredPeriods || subject.preferredPeriods.length === 0) continue;

          if (!subject.preferredPeriods.includes(period)) {
            totalScore += this.penaltyPerNonPreferred;
          }
        }
      }
    }

    return totalScore;
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const score = this.calculateSoftScore(timetable);
    return this.success(score);
  }
}
