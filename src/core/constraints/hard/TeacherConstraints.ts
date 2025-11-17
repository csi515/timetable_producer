// 교사 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';
import {
  isTeacherAssignedAt,
  countConsecutivePeriods,
  countBeforeLunch,
  countWeeklyHoursForTeacher,
  countDailyLessonsForTeacher,
} from '../utils';

/**
 * 교사 불가능 시간 제약조건
 */
export class TeacherAvailabilityConstraint extends BaseConstraint {
  readonly metadata = {
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

    const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
    if (!teacher) {
      return this.failure(`교사를 찾을 수 없습니다: ${slot.teacherId}`, 'error');
    }

    const isUnavailable = teacher.unavailableSlots.some(
      (unavailable) => unavailable.day === slot.day && unavailable.period === slot.period
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

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolSchedule.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.teacherId) continue;

          const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
          if (!teacher) continue;

          const isUnavailable = teacher.unavailableSlots.some(
            (unavailable) => unavailable.day === day && unavailable.period === period
          );

          if (isUnavailable) {
            violations.push(
              `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${timetable.classes.find((c) => c.id === classId)?.name || classId}에서 수업 중 (불가능 시간)`
            );
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
 * 교사 중복 수업 금지 제약조건
 */
export class TeacherNoOverlapConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'teacher_no_overlap',
    name: '교사 중복 수업 금지',
    description: '교사는 동일 시간대에 두 반 이상을 수업할 수 없습니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    const isOverlapping = isTeacherAssignedAt(timetable, slot.teacherId, slot.day, slot.period, slot.classId);

    if (isOverlapping) {
      const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
      const conflictingClass = this.findConflictingClass(timetable, slot.teacherId, slot.day, slot.period, slot.classId);

      return this.failure(
        `${teacher?.name || slot.teacherId} 교사가 ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass || '다른 반'}에서 수업 중입니다.`,
        'error',
        {
          teacherId: slot.teacherId,
          teacherName: teacher?.name,
          day: slot.day,
          period: slot.period,
          conflictingClass,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const teacherSlots: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    // 모든 교사의 배정된 시간 수집
    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolSchedule.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.teacherId) continue;

          const key = `${slot.teacherId}_${day}_${period}`;
          if (!teacherSlots[key]) {
            teacherSlots[key] = [];
          }
          teacherSlots[key].push({ classId, day, period });
        }
      }
    }

    // 중복 확인
    for (const [key, slots] of Object.entries(teacherSlots)) {
      if (slots.length > 1) {
        const [teacherId, day, period] = key.split('_');
        const teacher = timetable.teachers.find((t) => t.id === teacherId);
        const classNames = slots.map((s) => timetable.classes.find((c) => c.id === s.classId)?.name || s.classId).join(', ');

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
      if (slot && slot.teacherId === teacherId) {
        return timetable.classes.find((c) => c.id === classId)?.name || classId;
      }
    }
    return null;
  }
}

/**
 * 교사 연속수업 제한 제약조건 (하드)
 */
export class TeacherConsecutiveLimitConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'teacher_consecutive_limit',
    name: '교사 연속수업 제한',
    description: '교사가 연속으로 3교시 이상 수업하는 것을 방지합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'teacher',
  };

  private readonly maxConsecutive: number;

  constructor(maxConsecutive: number = 3) {
    super();
    this.maxConsecutive = maxConsecutive;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || !slot.classId) {
      return this.success();
    }

    const consecutiveCount = countConsecutivePeriods(timetable, slot.teacherId, slot.classId, slot.day, slot.period);

    if (consecutiveCount >= this.maxConsecutive) {
      const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
      const classItem = timetable.classes.find((c) => c.id === slot.classId);

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

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
          let consecutiveCount = 0;
          let startPeriod = 1;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount >= this.maxConsecutive) {
                const classItem = timetable.classes.find((c) => c.id === classId);
                violations.push(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`
                );
              }
              consecutiveCount = 0;
              startPeriod = period + 1;
            }
          }

          // 마지막 교시까지 연속인 경우
          if (consecutiveCount >= this.maxConsecutive) {
            const classItem = timetable.classes.find((c) => c.id === classId);
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
}

/**
 * 교사 하루 최대 수업 수 제약조건 (하드)
 */
export class TeacherDailyLimitConstraint extends BaseConstraint {
  readonly metadata = {
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

    const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
    if (!teacher || !teacher.maxHoursPerDay) {
      return this.success();
    }

    const dailyCount = countDailyLessonsForTeacher(timetable, slot.teacherId, slot.day);

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

      for (const day of timetable.schoolSchedule.days) {
        const dailyCount = countDailyLessonsForTeacher(timetable, teacher.id, day);

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
}

/**
 * 교사 주당 시수 제약조건
 */
export class TeacherWeeklyHoursConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'teacher_weekly_hours',
    name: '교사 주당 시수',
    description: '교사별 주당 시수가 정확히 충족되어야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'teacher',
  };

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      const assignedHours = countWeeklyHoursForTeacher(timetable, teacher.id);

      if (assignedHours !== teacher.weeklyHours) {
        violations.push(
          `${teacher.name} 교사: 주당 시수 ${assignedHours}시간 (필요: ${teacher.weeklyHours}시간)`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(`교사 주당 시수 불일치 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 배치 전에는 검사 불가 (전체 검증만 가능)
    return this.success();
  }
}
