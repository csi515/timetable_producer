// 과목 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';
import {
  countWeeklyHoursForSubject,
  countDailyLessonsForSubject,
  getSlot,
  isConsecutivePeriod,
} from '../utils';

/**
 * 과목 주당 시수 제약조건
 */
export class SubjectWeeklyHoursConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_weekly_hours',
    name: '과목 주당 시수',
    description: '과목별 주당 시수가 정확히 만족되어야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'subject',
  };

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const assignedHours = countWeeklyHoursForSubject(timetable, classItem.id, subject.id);

        if (assignedHours !== subject.weeklyHours) {
          violations.push(
            `${classItem.name}의 ${subject.name}: 주당 시수 ${assignedHours}시간 (필요: ${subject.weeklyHours}시간)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`과목 주당 시수 불일치 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 배치 전에는 검사 불가 (전체 검증만 가능)
    return this.success();
  }
}

/**
 * 과목 하루 배정 제한 제약조건 (하드)
 */
export class SubjectMaxPerDayConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_max_per_day',
    name: '과목 하루 배정 제한',
    description: '같은 과목이 같은 반에서 하루에 지정된 횟수 이상 배정되는 것을 방지합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
    const maxPerDay = subject?.maxPerDay ?? 1;

    const dailyCount = countDailyLessonsForSubject(timetable, slot.classId, slot.subjectId, slot.day);

    if (dailyCount >= maxPerDay) {
      const classItem = timetable.classes.find((c) => c.id === slot.classId);

      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
        'error',
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
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        const maxPerDay = subject.maxPerDay ?? 1;

        for (const day of timetable.schoolSchedule.days) {
          const dailyCount = countDailyLessonsForSubject(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`과목 하루 배정 제한 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 연강 필요 과목 제약조건
 */
export class ConsecutiveRequiredConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'consecutive_required',
    name: '연강 필요 과목',
    description: '연강이 필요한 과목은 지정된 교시 수만큼 연속으로 배치되어야 합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
    if (!subject?.requiresConsecutive) {
      return this.success();
    }

    const consecutivePeriods = subject.consecutivePeriods || 2;
    const existingSlot = this.findExistingSlotForSubject(timetable, slot.classId, slot.subjectId, slot.day);

    if (existingSlot) {
      // 연속인지 확인
      if (!isConsecutivePeriod(existingSlot.day, existingSlot.period, slot.day, slot.period)) {
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutivePeriods}교시로 배정되어야 합니다. (현재 ${existingSlot.period}교시와 ${slot.period}교시는 연속이 아님)`,
          'error',
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            day: slot.day,
            existingPeriod: existingSlot.period,
            newPeriod: slot.period,
            requiredConsecutive: consecutivePeriods,
          }
        );
      }
    } else {
      // 첫 번째 배정인 경우, 연속 배정 가능 여부 확인
      const canConsecutive = this.canPlaceConsecutive(timetable, slot, consecutivePeriods);
      if (!canConsecutive) {
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutivePeriods}교시로 배정되어야 합니다. 인접한 교시가 충분하지 않습니다.`,
          'error',
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            day: slot.day,
            period: slot.period,
            requiredConsecutive: consecutivePeriods,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.requiresConsecutive) continue;
      const consecutivePeriods = subject.consecutivePeriods || 2;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const subjectPeriods: number[] = [];
          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              subjectPeriods.push(period);
            }
          }

          // 연속 배정 확인
          if (subjectPeriods.length > 0 && subjectPeriods.length < consecutivePeriods) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${subjectPeriods.length}교시만 배정됨 (연속 ${consecutivePeriods}교시 필요)`
            );
          } else if (subjectPeriods.length === consecutivePeriods) {
            // 연속인지 확인
            const sorted = subjectPeriods.sort((a, b) => a - b);
            let isConsecutive = true;
            for (let i = 0; i < sorted.length - 1; i++) {
              if (sorted[i + 1] - sorted[i] !== 1) {
                isConsecutive = false;
                break;
              }
            }
            if (!isConsecutive) {
              violations.push(
                `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 연속이 아닌 ${subjectPeriods.join(', ')}교시에 배정됨`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`연강 필요 과목 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private findExistingSlotForSubject(
    timetable: TimetableData,
    classId: string,
    subjectId: string,
    day: string
  ): { day: Day; period: number } | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return null;

    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        return { day: day as Day, period };
      }
    }

    return null;
  }

  private canPlaceConsecutive(timetable: TimetableData, slot: Slot, consecutivePeriods: number): boolean {
    const classSchedule = timetable.timetable[slot.classId];
    if (!classSchedule) return false;

    const daySchedule = classSchedule[slot.day];
    if (!daySchedule) return false;

    const maxPeriod = timetable.schoolSchedule.periodsPerDay[slot.day];
    let availableConsecutive = 0;

    // 앞쪽 확인
    for (let p = slot.period - 1; p >= 1 && availableConsecutive < consecutivePeriods - 1; p--) {
      const s = daySchedule[p];
      if (!s || this.isEmptySlot(s)) {
        availableConsecutive++;
      } else {
        break;
      }
    }

    // 뒤쪽 확인
    for (let p = slot.period + 1; p <= maxPeriod && availableConsecutive < consecutivePeriods - 1; p++) {
      const s = daySchedule[p];
      if (!s || this.isEmptySlot(s)) {
        availableConsecutive++;
      } else {
        break;
      }
    }

    return availableConsecutive >= consecutivePeriods - 1;
  }
}
