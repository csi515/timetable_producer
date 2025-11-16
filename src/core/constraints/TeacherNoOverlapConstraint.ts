// 교사 동일 시각 중복 수업 금지 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class TeacherNoOverlapConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'teacher_no_overlap',
    name: '교사 중복 수업 금지',
    description: '교사는 동일 시간대에 두 반 이상을 수업할 수 없습니다.',
    priority: 'critical',
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId) {
      return this.success();
    }

    // 같은 교사가 같은 시간에 다른 반에서 수업하는지 확인
    const isOverlapping = this.isTeacherAssignedAt(
      timetable,
      slot.teacherId,
      slot.day,
      slot.period,
      slot.classId
    );

    if (isOverlapping) {
      const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
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
        const teacher = timetable.teachers.find(t => t.id === teacherId);
        const classNames = slots.map(s => timetable.classes.find(c => c.id === s.classId)?.name || s.classId).join(', ');

        violations.push(
          `${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 ${slots.length}개 반(${classNames})에서 중복 수업`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `교사 중복 수업 ${violations.length}건 발견`,
        'error',
        { violations }
      );
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
        return timetable.classes.find(c => c.id === classId)?.name || classId;
      }
    }
    return null;
  }
}
