// 과목별 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';

/**
 * 과목별 주당 시수 충족 (하드)
 * 과목별 주당 시수 정확히 만족
 */
export class SubjectWeeklyHoursConstraint extends BaseConstraint {
  metadata = {
    id: 'subject_weekly_hours',
    name: '과목별 주당 시수 충족',
    description: '과목별 주당 시수가 정확히 충족되어야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'subject',
  };

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      const subjectHours: Record<string, number> = {};

      // 각 과목별 배정된 시수 계산
      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (slot && slot.subjectId) {
            subjectHours[slot.subjectId] = (subjectHours[slot.subjectId] || 0) + 1;
          }
        }
      }

      // 필요한 시수와 비교
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
      return this.failure(`과목별 주당 시수 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 배치 전에는 전체 검증 불가능하므로 성공 반환
    // validateTimetable에서만 검증
    return this.success();
  }
}

/**
 * 과목 하루 2회 배정 금지 (하드)
 * 한 과목은 동일 요일에 두 번 이상 배정 금지
 */
export class SubjectMaxPerDayConstraint extends BaseConstraint {
  metadata = {
    id: 'subject_max_per_day',
    name: '과목 하루 배정 제한',
    description: '한 과목은 동일 요일에 두 번 이상 배정될 수 없습니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    if (!subject) {
      return this.success();
    }

    // 연강 필요 과목은 제외
    if (subject.requiresConsecutive) {
      return this.success();
    }

    const dailyCount = this.countDailyLessonsForSubject(timetable, slot.classId, slot.subjectId, slot.day);

    if (dailyCount >= 1) {
      const classItem = timetable.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject.name} 과목이 ${slot.day}요일에 이미 배정되었습니다.`,
        'error',
        {
          classId: slot.classId,
          className: classItem?.name,
          subjectId: slot.subjectId,
          subjectName: subject.name,
          day: slot.day,
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
        // 연강 필요 과목은 제외
        if (subject.requiresConsecutive) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const dailyCount = this.countDailyLessonsForSubject(timetable, classItem.id, subject.id, day);

          if (dailyCount > 1) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨`
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

  private countDailyLessonsForSubject(timetable: TimetableData, classId: string, subjectId: string, day: string): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolConfig.periodsPerDay[day as keyof typeof timetable.schoolConfig.periodsPerDay];

    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        count++;
      }
    }

    return count;
  }
}

/**
 * 연강 필요 과목 (하드)
 * 특정 과목은 반드시 연속 2교시로 배정
 */
export class ConsecutiveRequiredConstraint extends BaseConstraint {
  metadata = {
    id: 'consecutive_required',
    name: '연강 필요 과목',
    description: '연강이 필요한 과목은 2교시 연속으로 배치되어야 합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
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
        return this.failure(
          `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. (현재 ${existingSlot.period}교시와 ${slot.period}교시는 연속이 아님)`,
          'error',
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            day: slot.day,
            existingPeriod: existingSlot.period,
            newPeriod: slot.period,
          }
        );
      }
    }

    // 첫 번째 배정인 경우, 다음 교시가 비어있는지 확인
    const nextPeriodSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period + 1);
    const prevPeriodSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period - 1);

    if (!nextPeriodSlot && !prevPeriodSlot) {
      return this.failure(
        `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. 인접한 교시가 비어있지 않습니다.`,
        'error',
        {
          subjectId: subject.id,
          subjectName: subject.name,
          classId: slot.classId,
          day: slot.day,
          period: slot.period,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.requiresConsecutive) continue;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
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
      return this.failure(`연강 필요 과목 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private findExistingSlotForSubject(
    timetable: TimetableData,
    classId: string,
    subjectId: string,
    day: string
  ): { period: number } | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return null;

    const maxPeriod = timetable.schoolConfig.periodsPerDay[day as keyof typeof timetable.schoolConfig.periodsPerDay];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        return { period };
      }
    }

    return null;
  }
}
