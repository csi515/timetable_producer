// 교사 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from '../types';

/**
 * 교사 불가능 시간 제약조건
 */
export class TeacherUnavailableTimeConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'teacher_unavailable_time',
    name: '교사 불가능 시간',
    description: '교사가 불가능한 시간대에 수업을 배정할 수 없습니다.',
    type: 'hard',
    category: 'teacher',
    priority: 1, // 최우선 평가
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    return this.safeGet(() => {
      const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
      if (!teacher) {
        return this.hardViolation(`교사를 찾을 수 없습니다: ${slot.teacherId}`, {
          teacherId: slot.teacherId,
        });
      }

      const isUnavailable = teacher.unavailableSlots.some(
        (unavailable) => unavailable.day === slot.day && unavailable.period === slot.period
      );

      if (isUnavailable) {
        return this.hardViolation(
          `${teacher.name} 교사는 ${slot.day}요일 ${slot.period}교시에 수업할 수 없습니다.`,
          {
            teacherId: teacher.id,
            teacherName: teacher.name,
            day: slot.day,
            period: slot.period,
          }
        );
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!slot || slot.teacherId !== teacher.id) continue;

            const isUnavailable = teacher.unavailableSlots.some(
              (unavailable) => unavailable.day === day && unavailable.period === period
            );

            if (isUnavailable) {
              const className = timetable.classes.find((c) => c.id === classId)?.name || classId;
              violations.push(
                `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${className}에서 수업 중 (불가능 시간)`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`교사 불가능 시간 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 교사 중복 수업 금지 제약조건
 */
export class TeacherNoOverlapConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'teacher_no_overlap',
    name: '교사 중복 수업 금지',
    description: '교사는 동일 시간대에 두 반 이상을 수업할 수 없습니다.',
    type: 'hard',
    category: 'teacher',
    priority: 2,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    return this.safeGet(() => {
      const isOverlapping = this.isTeacherAssignedAt(
        timetable,
        slot.teacherId,
        slot.day,
        slot.period,
        slot.classId
      );

      if (isOverlapping) {
        const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
        const conflictingClass = this.findConflictingClass(
          timetable,
          slot.teacherId,
          slot.day,
          slot.period,
          slot.classId
        );

        return this.hardViolation(
          `${teacher?.name || slot.teacherId} 교사가 ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass || '다른 반'}에서 수업 중입니다.`,
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
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const teacherSlots: Record<string, Array<{ classId: string; day: Day; period: number }>> = {};

    // 모든 교사의 배정된 시간 수집
    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
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
        const classNames = slots
          .map((s) => timetable.classes.find((c) => c.id === s.classId)?.name || s.classId)
          .join(', ');

        violations.push(
          `${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 ${slots.length}개 반(${classNames})에서 중복 수업`
        );
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`교사 중복 수업 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }

  private findConflictingClass(
    timetable: TimetableData,
    teacherId: string,
    day: Day,
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

  propagate(slot: Slot, timetable: TimetableData, domains: Map<string, TimeSlot[]>): PropagationResult {
    const updatedDomains = new Map(domains);
    const prunedValues: Array<{ variableId: string; slot: TimeSlot }> = [];

    if (!slot.teacherId) {
      return { domains: updatedDomains, prunedValues, hasEmptyDomain: false };
    }

    // 같은 교사가 배정된 시간을 다른 변수의 도메인에서 제거
    for (const [variableId, domain] of domains.entries()) {
      if (variableId.includes(`_${slot.teacherId}_`)) {
        continue; // 같은 교사 변수는 제외
      }

      const filtered = domain.filter(
        (s) => !(s.day === slot.day && s.period === slot.period)
      );

      const removed = domain.length - filtered.length;
      if (removed > 0) {
        updatedDomains.set(variableId, filtered);
        prunedValues.push({ variableId, slot: { day: slot.day, period: slot.period } });
      }
    }

    // 빈 도메인 확인
    const hasEmptyDomain = Array.from(updatedDomains.values()).some((d) => d.length === 0);

    return { domains: updatedDomains, prunedValues, hasEmptyDomain };
  }
}

/**
 * 교사 연속 3교시 이상 금지 제약조건
 */
export class TeacherMaxConsecutivePeriodsConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'teacher_max_consecutive',
    name: '교사 연속수업 제한',
    description: '교사가 연속으로 3교시 이상 수업하는 것을 방지합니다.',
    type: 'hard',
    category: 'teacher',
    priority: 3,
  };

  private readonly maxConsecutive: number;

  constructor(maxConsecutive: number = 3) {
    super();
    this.maxConsecutive = maxConsecutive;
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || !slot.classId) {
      return this.success();
    }

    return this.safeGet(() => {
      const consecutiveCount = this.countConsecutivePeriods(
        timetable,
        slot.teacherId!,
        slot.classId,
        slot.day,
        slot.period
      );

      if (consecutiveCount >= this.maxConsecutive) {
        const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
        const classItem = timetable.classes.find((c) => c.id === slot.classId);

        return this.hardViolation(
          `${teacher?.name || slot.teacherId} 교사가 ${classItem?.name || slot.classId}에서 ${slot.day}요일에 연속 ${consecutiveCount + 1}교시 수업하게 됩니다. (최대 ${this.maxConsecutive}교시)`,
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
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;
          let startPeriod = 1;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned =
              slot && (slot.teacherId === teacher.id || slot.coTeachers?.includes(teacher.id));

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
      return this.hardViolation(`연속수업 제한 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 교사 하루 최대 수업 수 제약조건
 */
export class TeacherMaxDailyLessonsConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'teacher_max_daily_lessons',
    name: '교사 하루 최대 수업 수',
    description: '교사가 하루에 배정할 수 있는 최대 수업 수를 제한합니다.',
    type: 'hard',
    category: 'teacher',
    priority: 4,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    return this.safeGet(() => {
      const teacher = timetable.teachers.find((t) => t.id === slot.teacherId);
      if (!teacher || !teacher.maxHoursPerDay) {
        return this.success();
      }

      const dailyCount = this.countDailyLessons(timetable, slot.teacherId, slot.day);

      if (dailyCount >= teacher.maxHoursPerDay) {
        return this.hardViolation(
          `${teacher.name} 교사는 하루에 최대 ${teacher.maxHoursPerDay}교시만 수업할 수 있습니다. (현재 ${dailyCount}교시)`,
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
    }, this.success());
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
      return this.hardViolation(`교사 하루 최대 수업 수 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}
