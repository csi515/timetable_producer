// 과목 하루 2회 배정 금지 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class MaxPerDayConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'max_per_day',
    name: '과목 하루 배정 제한',
    description: '같은 과목이 같은 반에서 하루에 2회 이상 배정되는 것을 방지합니다.',
    priority: 'medium',
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    const maxPerDay = subject?.maxPerDay ?? 1;

    // 같은 반, 같은 날에 이미 배정된 횟수 확인
    const dailyCount = this.countDailyLessonsForSubject(timetable, slot.classId, slot.subjectId, slot.day);

    if (dailyCount >= maxPerDay) {
      const classItem = timetable.classes.find(c => c.id === slot.classId);

      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
        'warning',
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
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const dailyCount = this.countDailyLessonsForSubject(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `과목 하루 배정 제한 위반 ${violations.length}건 발견`,
        'warning',
        { violations }
      );
    }

    return this.success();
  }

  private countDailyLessonsForSubject(
    timetable: TimetableData,
    classId: string,
    subjectId: string,
    day: string
  ): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];

    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        count++;
      }
    }

    return count;
  }
}
