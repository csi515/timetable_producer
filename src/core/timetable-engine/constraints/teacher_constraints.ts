// 교사 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';

/**
 * 교사 중복 수업 금지 (하드)
 * 한 교사는 동시간대에 두 개 이상의 수업 불가
 */
export class TeacherNoOverlapConstraint extends BaseConstraint {
  metadata = {
    id: 'teacher_no_overlap',
    name: '교사 중복 수업 금지',
    description: '교사는 동일 시간대에 두 개 이상의 수업을 할 수 없습니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    // 공동수업 교사들도 확인
    const teachersToCheck = slot.coTeachers
      ? [slot.teacherId, ...slot.coTeachers]
      : [slot.teacherId];

    for (const teacherId of teachersToCheck) {
      const isOverlapping = this.isTeacherAssignedAt(
        timetable,
        teacherId,
        slot.day,
        slot.period,
        slot.classId
      );

      if (isOverlapping) {
        const teacher = timetable.teachers.find(t => t.id === teacherId);
        const conflictingClass = this.findConflictingClass(timetable, teacherId, slot.day, slot.period, slot.classId);

        return this.failure(
          `${teacher?.name || teacherId} 교사가 ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass || '다른 반'}에서 수업 중입니다.`,
          'error',
          {
            teacherId,
            teacherName: teacher?.name,
            day: slot.day,
            period: slot.period,
            conflictingClass,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const teacherSlots: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.teacherId) continue;

          const teachersToCheck = slot.coTeachers
            ? [slot.teacherId, ...slot.coTeachers]
            : [slot.teacherId];

          for (const teacherId of teachersToCheck) {
            const key = `${teacherId}_${day}_${period}`;
            if (!teacherSlots[key]) {
              teacherSlots[key] = [];
            }
            teacherSlots[key].push({ classId, day, period });
          }
        }
      }
    }

    for (const [key, slots] of Object.entries(teacherSlots)) {
      if (slots.length > 1) {
        const [teacherId, day, period] = key.split('_');
        const teacher = timetable.teachers.find(t => t.id === teacherId);
        const classNames = slots.map(s => timetable.classes.find(c => c.id === s.classId)?.name || s.classId).join(', ');

        violations.push(
          `${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 ${slots.length}개 반(${classNames})에서 중복 수업`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(`교사 중복 수업 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private findConflictingClass(
    timetable: TimetableData,
    teacherId: string,
    day: string,
    period: number,
    excludeClassId: string
  ): string | null {
    for (const classId of Object.keys(timetable.timetable)) {
      if (classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && (slot.teacherId === teacherId || slot.coTeachers?.includes(teacherId))) {
        return timetable.classes.find(c => c.id === classId)?.name || classId;
      }
    }
    return null;
  }
}

/**
 * 교사 불가능 시간 (하드)
 * 교사별 금지 시간대 존재
 */
export class TeacherAvailabilityConstraint extends BaseConstraint {
  metadata = {
    id: 'teacher_availability',
    name: '교사 불가능 시간',
    description: '교사가 불가능한 시간대에 수업을 배정할 수 없습니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    const teachersToCheck = slot.coTeachers
      ? [slot.teacherId, ...slot.coTeachers]
      : [slot.teacherId];

    for (const teacherId of teachersToCheck) {
      const teacher = timetable.teachers.find(t => t.id === teacherId);
      if (!teacher) continue;

      const isUnavailable = teacher.unavailableSlots.some(
        unavailable => unavailable.day === slot.day && unavailable.period === slot.period
      );

      if (isUnavailable) {
        return this.failure(
          `${teacher.name} 교사는 ${slot.day}요일 ${slot.period}교시에 수업할 수 없습니다.`,
          'error',
          {
            teacherId: teacher.id,
            teacherName: teacher.name,
            day: slot.day,
            period: slot.period,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.teacherId) continue;

          const teachersToCheck = slot.coTeachers
            ? [slot.teacherId, ...slot.coTeachers]
            : [slot.teacherId];

          for (const teacherId of teachersToCheck) {
            const teacher = timetable.teachers.find(t => t.id === teacherId);
            if (!teacher) continue;

            const isUnavailable = teacher.unavailableSlots.some(
              unavailable => unavailable.day === day && unavailable.period === period
            );

            if (isUnavailable) {
              violations.push(
                `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${timetable.classes.find(c => c.id === classId)?.name || classId}에서 수업 중 (불가능 시간)`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`교사 불가능 시간 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 교사 연속수업 제한 (하드)
 * 교사에게 연속 3교시 이상의 수업 배치 금지
 */
export class TeacherConsecutiveLimitConstraint extends BaseConstraint {
  metadata = {
    id: 'teacher_consecutive_limit',
    name: '교사 연속수업 제한',
    description: '교사가 연속으로 3교시 이상 수업하는 것을 방지합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'teacher',
  };

  private maxConsecutive: number;

  constructor(maxConsecutive: number = 3) {
    super();
    this.maxConsecutive = maxConsecutive;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    const consecutiveCount = this.countConsecutivePeriods(
      timetable,
      slot.teacherId,
      slot.classId,
      slot.day,
      slot.period
    );

    if (consecutiveCount >= this.maxConsecutive) {
      const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
      const classItem = timetable.classes.find(c => c.id === slot.classId);

      return this.failure(
        `${teacher?.name || slot.teacherId} 교사가 ${classItem?.name || slot.classId}에서 ${slot.day}요일에 연속 ${consecutiveCount + 1}교시 수업하게 됩니다. (최대 ${this.maxConsecutive}교시)`,
        'error',
        {
          teacherId: slot.teacherId,
          teacherName: teacher?.name,
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          consecutiveCount: consecutiveCount + 1,
          maxConsecutive: this.maxConsecutive,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;
          let startPeriod = 1;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount >= this.maxConsecutive) {
                const classItem = timetable.classes.find(c => c.id === classId);
                violations.push(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`
                );
              }
              consecutiveCount = 0;
              startPeriod = period + 1;
            }
          }

          if (consecutiveCount >= this.maxConsecutive) {
            const classItem = timetable.classes.find(c => c.id === classId);
            violations.push(
              `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`연속수업 제한 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private countConsecutivePeriods(
    timetable: TimetableData,
    teacherId: string,
    classId: string,
    day: string,
    period: number
  ): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolConfig.periodsPerDay[day as keyof typeof timetable.schoolConfig.periodsPerDay];

    for (let p = period - 1; p >= 1; p--) {
      const slot = daySchedule[p];
      if (slot && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    for (let p = period + 1; p <= maxPeriod; p++) {
      const slot = daySchedule[p];
      if (slot && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }
}

/**
 * 점심 전 과도한 배치 방지 (하드)
 * 점심시간 전 특정 교사에게 2시간 이상 몰리는 배치 금지
 */
export class LunchBeforeOverloadConstraint extends BaseConstraint {
  metadata = {
    id: 'lunch_before_overload',
    name: '점심 전 과도한 배치 방지',
    description: '점심 시간 전에 특정 교사에게 수업이 과도하게 몰리지 않도록 합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'teacher',
  };

  private lunchPeriod: number;
  private maxBeforeLunch: number;

  constructor(lunchPeriod: number = 4, maxBeforeLunch: number = 2) {
    super();
    this.lunchPeriod = lunchPeriod;
    this.maxBeforeLunch = maxBeforeLunch;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || slot.period > this.lunchPeriod) {
      return this.success();
    }

    const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
    if (!teacher) {
      return this.success();
    }

    const beforeLunchCount = this.countBeforeLunch(timetable, slot.teacherId, slot.day);

    if (beforeLunchCount >= this.maxBeforeLunch) {
      return this.failure(
        `${teacher.name} 교사가 ${slot.day}요일 점심 전(${this.lunchPeriod}교시까지)에 이미 ${beforeLunchCount}교시 수업 중입니다. (최대 ${this.maxBeforeLunch}교시)`,
        'error',
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          currentCount: beforeLunchCount,
          maxCount: this.maxBeforeLunch,
          lunchPeriod: this.lunchPeriod,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const lunchPeriod = timetable.schoolConfig.lunchPeriod || this.lunchPeriod;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolConfig.days) {
        const beforeLunchCount = this.countBeforeLunch(timetable, teacher.id, day, lunchPeriod);

        if (beforeLunchCount > this.maxBeforeLunch) {
          violations.push(
            `${teacher.name} 교사가 ${day}요일 점심 전(${lunchPeriod}교시까지)에 ${beforeLunchCount}교시 수업 (최대 ${this.maxBeforeLunch}교시)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`점심 전 과도한 배치 ${violations.length}건 발견`, 'error', { violations });
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
        if (slot && slot.teacherId === teacherId) {
          count++;
        }
      }
    }

    return count;
  }
}

/**
 * 교사 하루 최대 수업 수 (하드)
 */
export class TeacherDailyLimitConstraint extends BaseConstraint {
  metadata = {
    id: 'teacher_daily_limit',
    name: '교사 하루 최대 수업 수',
    description: '교사가 하루에 배정할 수 있는 최대 수업 수를 제한합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
    if (!teacher || !teacher.maxHoursPerDay) {
      return this.success();
    }

    const dailyCount = this.countDailyLessons(timetable, slot.teacherId, slot.day);

    if (dailyCount >= teacher.maxHoursPerDay) {
      return this.failure(
        `${teacher.name} 교사는 하루에 최대 ${teacher.maxHoursPerDay}교시만 수업할 수 있습니다. (현재 ${dailyCount}교시)`,
        'error',
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          currentCount: dailyCount,
          maxCount: teacher.maxHoursPerDay,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      if (!teacher.maxHoursPerDay) continue;

      for (const day of timetable.schoolConfig.days) {
        const dailyCount = this.countDailyLessons(timetable, teacher.id, day);

        if (dailyCount > teacher.maxHoursPerDay) {
          violations.push(
            `${teacher.name} 교사가 ${day}요일에 ${dailyCount}교시 수업 (최대 ${teacher.maxHoursPerDay}교시)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`교사 하루 최대 수업 수 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private countDailyLessons(timetable: TimetableData, teacherId: string, day: string): number {
    let count = 0;

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const daySchedule = classSchedule[day as keyof typeof classSchedule];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolConfig.periodsPerDay[day as keyof typeof timetable.schoolConfig.periodsPerDay];
      for (let period = 1; period <= maxPeriod; period++) {
        const slot = daySchedule[period];
        if (slot && slot.teacherId === teacherId) {
          count++;
        }
      }
    }

    return count;
  }
}
