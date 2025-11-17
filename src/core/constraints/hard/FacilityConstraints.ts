// 시설/교실 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from '../types';

/**
 * 특수 교실 중복 사용 금지 제약조건
 */
export class SpecialRoomConflictConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'special_room_conflict',
    name: '특수 교실 중복 사용 금지',
    description: '같은 특수 교실을 같은 시간에 여러 반이 사용할 수 없습니다.',
    type: 'hard',
    category: 'facility',
    priority: 3,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.roomId || !slot.subjectId) {
      return this.success();
    }

    return this.safeGet(() => {
      const room = timetable.rooms.find((r) => r.id === slot.roomId);
      if (!room || !room.isSpecial) {
        return this.success();
      }

      // 같은 특수 교실을 같은 시간에 사용하는 다른 반이 있는지 확인
      const conflictingClass = this.findConflictingClass(
        timetable,
        slot.roomId!,
        slot.day,
        slot.period,
        slot.classId
      );

      if (conflictingClass) {
        const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
        const classItem = timetable.classes.find((c) => c.id === slot.classId);

        return this.hardViolation(
          `${room.name}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass}에서 사용 중입니다.`,
          {
            roomId: room.id,
            roomName: room.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name,
            classId: slot.classId,
            className: classItem?.name,
            day: slot.day,
            period: slot.period,
            conflictingClass,
          }
        );
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];
    const roomUsage: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    // 모든 특수 교실 사용 수집
    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.roomId) continue;

          const room = timetable.rooms.find((r) => r.id === slot.roomId);
          if (!room || !room.isSpecial) continue;

          const key = `${slot.roomId}_${day}_${period}`;
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
        const [roomId, day, period] = key.split('_');
        const room = timetable.rooms.find((r) => r.id === roomId);
        const classNames = classes
          .map((c) => timetable.classes.find((cl) => cl.id === c.classId)?.name || c.classId)
          .join(', ');

        violations.push(
          `${room?.name || roomId}이(가) ${day}요일 ${period}교시에 ${classes.length}개 반(${classNames})에서 중복 사용`
        );
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`특수 교실 중복 사용 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }

  private findConflictingClass(
    timetable: TimetableData,
    roomId: string,
    day: string,
    period: number,
    excludeClassId: string
  ): string | null {
    for (const classId of Object.keys(timetable.timetable)) {
      if (classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day as any, period);
      if (slot && slot.roomId === roomId) {
        return timetable.classes.find((c) => c.id === classId)?.name || classId;
      }
    }

    return null;
  }

  propagate(slot: Slot, timetable: TimetableData, domains: Map<string, TimeSlot[]>): PropagationResult {
    const updatedDomains = new Map(domains);
    const prunedValues: Array<{ variableId: string; slot: TimeSlot }> = [];

    if (!slot.roomId) {
      return { domains: updatedDomains, prunedValues, hasEmptyDomain: false };
    }

    const room = timetable.rooms.find((r) => r.id === slot.roomId);
    if (!room || !room.isSpecial) {
      return { domains: updatedDomains, prunedValues, hasEmptyDomain: false };
    }

    // 같은 특수 교실을 사용하는 다른 변수들의 도메인에서 해당 시간 제거
    for (const [variableId, domain] of domains.entries()) {
      // 특수 교실이 필요한 과목인 경우만 확인
      const filtered = domain.filter(
        (s) => !(s.day === slot.day && s.period === slot.period)
      );

      const removed = domain.length - filtered.length;
      if (removed > 0) {
        updatedDomains.set(variableId, filtered);
        prunedValues.push({ variableId, slot: { day: slot.day, period: slot.period } });
      }
    }

    const hasEmptyDomain = Array.from(updatedDomains.values()).some((d) => d.length === 0);

    return { domains: updatedDomains, prunedValues, hasEmptyDomain };
  }
}
