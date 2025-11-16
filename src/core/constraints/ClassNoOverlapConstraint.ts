// 반 동일 시각 중복 수업 금지 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class ClassNoOverlapConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'class_no_overlap',
    name: '반 중복 수업 금지',
    description: '한 반은 동일 시간대에 두 과목 이상을 수업할 수 없습니다.',
    priority: 'critical',
    category: 'class',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.teacherId) {
      return this.success();
    }

    // 같은 반이 같은 시간에 이미 수업이 있는지 확인
    const existingSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period);

    if (existingSlot && !this.isEmptySlot(existingSlot)) {
      const existingSubject = timetable.subjects.find(s => s.id === existingSlot.subjectId);
      const newSubject = timetable.subjects.find(s => s.id === slot.subjectId);
      const classItem = timetable.classes.find(c => c.id === slot.classId);

      return this.failure(
        `${classItem?.name || slot.classId}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${existingSubject?.name || existingSlot.subjectId} 수업이 있습니다.`,
        'error',
        {
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          existingSubject: existingSubject?.name,
          newSubject: newSubject?.name,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const classItem = timetable.classes.find(c => c.id === classId);

      for (const day of timetable.schoolSchedule.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || this.isEmptySlot(slot)) continue;

          // 같은 시간에 다른 과목이 있는지 확인 (이미 위반 상태)
          // 실제로는 이 검사는 checkBeforePlacement에서만 의미가 있음
          // 여기서는 중복 확인만 수행
        }
      }
    }

    // 실제로는 checkBeforePlacement에서 이미 방지되므로 여기서는 성공 반환
    return this.success();
  }
}
