// 연강 필요 과목 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class ConsecutiveRequiredConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'consecutive_required',
    name: '연강 필요 과목',
    description: '연강이 필요한 과목은 2교시 연속으로 배치되어야 합니다.',
    priority: 'high',
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

    // 첫 번째 배정인 경우, 다음 교시가 비어있는지 확인 (연속 배정 가능 여부)
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

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
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
      return this.failure(
        `연강 필요 과목 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
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

    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        return { period };
      }
    }

    return null;
  }
}
