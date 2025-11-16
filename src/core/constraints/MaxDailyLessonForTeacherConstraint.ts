// 교사 하루 최대 수업 수 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class MaxDailyLessonForTeacherConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'max_daily_lesson_teacher',
    name: '교사 하루 최대 수업 수',
    description: '교사가 하루에 배정할 수 있는 최대 수업 수를 제한합니다.',
    priority: 'high',
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

    // 같은 날에 이미 배정된 수업 수 확인
    const dailyCount = this.countDailyLessons(timetable, slot.teacherId, slot.day);

    if (dailyCount >= teacher.maxHoursPerDay) {
      return this.failure(
        `${teacher.name} 교사는 하루에 최대 ${teacher.maxHoursPerDay}교시만 수업할 수 있습니다. (현재 ${dailyCount}교시)`,
        'warning',
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
        const dailyCount = this.countDailyLessons(timetable, teacher.id, day);

        if (dailyCount > teacher.maxHoursPerDay) {
          violations.push(
            `${teacher.name} 교사가 ${day}요일에 ${dailyCount}교시 수업 (최대 ${teacher.maxHoursPerDay}교시)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `교사 하루 최대 수업 수 위반 ${violations.length}건 발견`,
        'warning',
        { violations }
      );
    }

    return this.success();
  }

  private countDailyLessons(timetable: TimetableData, teacherId: string, day: string): number {
    let count = 0;

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const daySchedule = classSchedule[day as keyof typeof classSchedule];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
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
