// 교사 불가시간 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class TeacherAvailabilityConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'teacher_availability',
    name: '교사 불가시간',
    description: '교사가 불가능한 시간대에 수업을 배정할 수 없습니다.',
    priority: 'critical',
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
    if (!teacher) {
      return this.failure(`교사를 찾을 수 없습니다: ${slot.teacherId}`, 'error');
    }

    // 불가능한 시간대 확인
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

          const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
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

    if (violations.length > 0) {
      return this.failure(
        `교사 불가능 시간 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}
