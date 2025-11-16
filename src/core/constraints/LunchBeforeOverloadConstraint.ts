// 점심 전 과도한 배치 방지 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export interface LunchBeforeOverloadConfig {
  lunchPeriod: number; // 점심 시간 전 교시 (기본 4)
  maxBeforeLunch: number; // 점심 전 최대 수업 수 (기본 3)
}

export class LunchBeforeOverloadConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'lunch_before_overload',
    name: '점심 전 과도한 배치 방지',
    description: '점심 시간 전에 특정 교사에게 수업이 과도하게 몰리지 않도록 합니다.',
    priority: 'medium',
    category: 'distribution',
  };

  private config: LunchBeforeOverloadConfig;

  constructor(config?: Partial<LunchBeforeOverloadConfig>) {
    super();
    this.config = {
      lunchPeriod: config?.lunchPeriod || 4,
      maxBeforeLunch: config?.maxBeforeLunch || 3,
    };
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || slot.period > this.config.lunchPeriod) {
      return this.success();
    }

    const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
    if (!teacher) {
      return this.success();
    }

    // 점심 전에 이미 배정된 수업 수 확인
    const beforeLunchCount = this.countBeforeLunch(timetable, slot.teacherId, slot.day);

    if (beforeLunchCount >= this.config.maxBeforeLunch) {
      return this.failure(
        `${teacher.name} 교사가 ${slot.day}요일 점심 전(${this.config.lunchPeriod}교시까지)에 이미 ${beforeLunchCount}교시 수업 중입니다. (최대 ${this.config.maxBeforeLunch}교시)`,
        'warning',
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          currentCount: beforeLunchCount,
          maxCount: this.config.maxBeforeLunch,
          lunchPeriod: this.config.lunchPeriod,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod || this.config.lunchPeriod;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolSchedule.days) {
        const beforeLunchCount = this.countBeforeLunch(timetable, teacher.id, day, lunchPeriod);

        if (beforeLunchCount > this.config.maxBeforeLunch) {
          violations.push(
            `${teacher.name} 교사가 ${day}요일 점심 전(${lunchPeriod}교시까지)에 ${beforeLunchCount}교시 수업 (최대 ${this.config.maxBeforeLunch}교시)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `점심 전 과도한 배치 ${violations.length}건 발견`,
        'warning',
        { violations }
      );
    }

    return this.success();
  }

  private countBeforeLunch(
    timetable: TimetableData,
    teacherId: string,
    day: string,
    lunchPeriod?: number
  ): number {
    const period = lunchPeriod || this.config.lunchPeriod;
    let count = 0;

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const daySchedule = classSchedule[day as keyof typeof classSchedule];
      if (!daySchedule) continue;

      for (let p = 1; p <= period; p++) {
        const slot = daySchedule[p];
        if (slot && slot.teacherId === teacherId) {
          count++;
        }
      }
    }

    return count;
  }
}
