// 특별실 중복 사용 금지 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export class SpecialRoomConflictConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'special_room_conflict',
    name: '특별실 중복 사용 금지',
    description: '같은 특별실을 같은 시간에 여러 반이 사용할 수 없습니다.',
    priority: 'high',
    category: 'room',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    if (!subject?.requiresSpecialRoom || !subject.specialRoomType) {
      return this.success();
    }

    // 같은 특별실을 같은 시간에 사용하는 다른 반이 있는지 확인
    const conflictingClass = this.findConflictingClass(
      timetable,
      subject.specialRoomType,
      slot.day,
      slot.period,
      slot.classId
    );

    if (conflictingClass) {
      return this.failure(
        `${subject.specialRoomType}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass}에서 사용 중입니다.`,
        'error',
        {
          subjectId: subject.id,
          subjectName: subject.name,
          specialRoomType: subject.specialRoomType,
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
    const roomUsage: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    // 모든 특별실 사용 수집
    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolSchedule.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.subjectId) continue;

          const subject = timetable.subjects.find(s => s.id === slot.subjectId);
          if (!subject?.requiresSpecialRoom || !subject.specialRoomType) continue;

          const key = `${subject.specialRoomType}_${day}_${period}`;
          if (!roomUsage[key]) {
            roomUsage[key] = [];
          }
          roomUsage[key].push({ classId, day, period });
        }
      }
    }

    // 중복 확인
    for (const [key, classes] of Object.entries(roomUsage)) {
      if (classes.length > 1) {
        const [roomType, day, period] = key.split('_');
        const classNames = classes.map(c => timetable.classes.find(cl => cl.id === c.classId)?.name || c.classId).join(', ');

        violations.push(
          `${roomType}이(가) ${day}요일 ${period}교시에 ${classes.length}개 반(${classNames})에서 중복 사용`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `특별실 중복 사용 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }

  private findConflictingClass(
    timetable: TimetableData,
    roomType: string,
    day: string,
    period: number,
    excludeClassId: string
  ): string | null {
    for (const classId of Object.keys(timetable.timetable)) {
      if (classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (!slot || !slot.subjectId) continue;

      const subject = timetable.subjects.find(s => s.id === slot.subjectId);
      if (subject?.requiresSpecialRoom && subject.specialRoomType === roomType) {
        return timetable.classes.find(c => c.id === classId)?.name || classId;
      }
    }

    return null;
  }
}
