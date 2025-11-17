// 과목 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata, TimeSlot } from '../types';

/**
 * 과목 주당 시수 제약조건
 */
export class SubjectWeeklyHoursConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'subject_weekly_hours',
    name: '과목 주당 시수',
    description: '과목별 주당 시수가 정확히 만족되어야 합니다.',
    type: 'hard',
    category: 'subject',
    priority: 5,
  };

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      // 각 과목별 배정된 시수 계산
      const subjectHours: Record<string, number> = {};

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (slot && slot.subjectId) {
            subjectHours[slot.subjectId] = (subjectHours[slot.subjectId] || 0) + 1;
          }
        }
      }

      // 과목별 시수 확인
      for (const subject of timetable.subjects) {
        const assignedHours = subjectHours[subject.id] || 0;
        if (assignedHours !== subject.weeklyHours) {
          violations.push(
            `${classItem.name}의 ${subject.name} 과목이 ${assignedHours}시간 배정됨 (필요: ${subject.weeklyHours}시간)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`과목 주당 시수 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 개별 슬롯 배치 시에는 검사하지 않음 (전체 검증에서만 확인)
    return this.success();
  }
}

/**
 * 과목 하루 중복 배정 금지 제약조건
 */
export class SubjectNoDuplicatePerDayConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'subject_no_duplicate_per_day',
    name: '과목 하루 중복 배정 금지',
    description: '한 과목은 동일 요일에 두 번 이상 배정될 수 없습니다.',
    type: 'hard',
    category: 'subject',
    priority: 4,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    return this.safeGet(() => {
      const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
      const maxPerDay = subject?.maxPerDay ?? 1;

      const dailyCount = this.countDailySubjectLessons(
        timetable,
        slot.classId,
        slot.subjectId,
        slot.day
      );

      if (dailyCount >= maxPerDay) {
        const classItem = timetable.classes.find((c) => c.id === slot.classId);

        return this.hardViolation(
          `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
          {
            classId: slot.classId,
            className: classItem?.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name,
            day: slot.day,
            currentCount: dailyCount,
            maxCount: maxPerDay,
          }
        );
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        const maxPerDay = subject.maxPerDay ?? 1;

        for (const day of timetable.schoolConfig.days) {
          const dailyCount = this.countDailySubjectLessons(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`과목 하루 중복 배정 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 과목 고정 시간대 제약조건
 */
export class SubjectFixedSlotConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'subject_fixed_slot',
    name: '과목 고정 시간대',
    description: '특정 과목은 반드시 특정 요일/시간에만 편성되어야 합니다.',
    type: 'hard',
    category: 'subject',
    priority: 3,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    return this.safeGet(() => {
      const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
      if (!subject || !subject.fixedSlots || subject.fixedSlots.length === 0) {
        return this.success();
      }

      const isFixedSlot = subject.fixedSlots.some(
        (fixed) => fixed.day === slot.day && fixed.period === slot.period
      );

      if (!isFixedSlot) {
        const classItem = timetable.classes.find((c) => c.id === slot.classId);
        return this.hardViolation(
          `${subject.name} 과목은 고정 시간대에만 배정할 수 있습니다. (${slot.day}요일 ${slot.period}교시는 허용되지 않음)`,
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            className: classItem?.name,
            day: slot.day,
            period: slot.period,
            allowedSlots: subject.fixedSlots,
          }
        );
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.fixedSlots || subject.fixedSlots.length === 0) continue;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        // 고정 시간대에 배정되었는지 확인
        for (const fixedSlot of subject.fixedSlots) {
          const slot = this.getSlot(timetable, classItem.id, fixedSlot.day, fixedSlot.period);
          if (!slot || slot.subjectId !== subject.id) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 고정 시간대(${fixedSlot.day}요일 ${fixedSlot.period}교시)에 배정되지 않음`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`과목 고정 시간대 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 과목 금지 시간대 제약조건
 */
export class SubjectForbiddenSlotConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'subject_forbidden_slot',
    name: '과목 금지 시간대',
    description: '특정 과목은 특정 요일/시간에 배정될 수 없습니다.',
    type: 'hard',
    category: 'subject',
    priority: 4,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    return this.safeGet(() => {
      const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
      if (!subject || !subject.forbiddenSlots || subject.forbiddenSlots.length === 0) {
        return this.success();
      }

      const isForbidden = subject.forbiddenSlots.some(
        (forbidden) => forbidden.day === slot.day && forbidden.period === slot.period
      );

      if (isForbidden) {
        const classItem = timetable.classes.find((c) => c.id === slot.classId);
        return this.hardViolation(
          `${subject.name} 과목은 ${slot.day}요일 ${slot.period}교시에 배정할 수 없습니다.`,
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            className: classItem?.name,
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

    for (const subject of timetable.subjects) {
      if (!subject.forbiddenSlots || subject.forbiddenSlots.length === 0) continue;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const forbiddenSlot of subject.forbiddenSlots) {
          const slot = this.getSlot(timetable, classItem.id, forbiddenSlot.day, forbiddenSlot.period);
          if (slot && slot.subjectId === subject.id) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 금지 시간대(${forbiddenSlot.day}요일 ${forbiddenSlot.period}교시)에 배정됨`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`과목 금지 시간대 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 연강 필요 과목 제약조건
 */
export class ConsecutiveRequiredConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'consecutive_required',
    name: '연강 필요 과목',
    description: '연강이 필요한 과목은 2교시 연속으로 배치되어야 합니다.',
    type: 'hard',
    category: 'subject',
    priority: 4,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    return this.safeGet(() => {
      const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
      if (!subject?.requiresConsecutive) {
        return this.success();
      }

      // 같은 반에서 같은 과목이 이미 배정되었는지 확인
      const existingSlot = this.findExistingSlotForSubject(timetable, slot.classId, slot.subjectId, slot.day);

      if (existingSlot) {
        // 연속인지 확인
        const periodDiff = Math.abs(existingSlot.period - slot.period);
        if (periodDiff === 1) {
          return this.success(); // 연속 배정 OK
        } else {
          const classItem = timetable.classes.find((c) => c.id === slot.classId);
          return this.hardViolation(
            `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. (현재 ${existingSlot.period}교시와 ${slot.period}교시는 연속이 아님)`,
            {
              subjectId: subject.id,
              subjectName: subject.name,
              classId: slot.classId,
              className: classItem?.name,
              day: slot.day,
              existingPeriod: existingSlot.period,
              newPeriod: slot.period,
            }
          );
        }
      }

      // 첫 번째 배정인 경우, 다음 교시가 비어있는지 확인 (연속 배정 가능 여부)
      const nextPeriodSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period + 1);
      const prevPeriodSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period - 1);

      if (!nextPeriodSlot && !prevPeriodSlot) {
        const classItem = timetable.classes.find((c) => c.id === slot.classId);
        return this.hardViolation(
          `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. 인접한 교시가 비어있지 않습니다.`,
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            className: classItem?.name,
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

    for (const subject of timetable.subjects) {
      if (!subject.requiresConsecutive) continue;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          const subjectPeriods: number[] = [];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              subjectPeriods.push(period);
            }
          }

          // 연속 2교시인지 확인
          if (subjectPeriods.length === 1) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 1교시만 배정됨 (연속 2교시 필요)`
            );
          } else if (subjectPeriods.length === 2) {
            const periodDiff = Math.abs(subjectPeriods[0] - subjectPeriods[1]);
            if (periodDiff !== 1) {
              violations.push(
                `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 연속이 아닌 ${subjectPeriods.join(', ')}교시에 배정됨`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`연강 필요 과목 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }

  private findExistingSlotForSubject(
    timetable: TimetableData,
    classId: string,
    subjectId: string,
    day: Day
  ): { period: number } | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return null;

    const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        return { period };
      }
    }

    return null;
  }
}
