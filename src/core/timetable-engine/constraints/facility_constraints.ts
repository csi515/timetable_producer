// 시설·공간 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';

/**
 * 특별실 중복 사용 금지 (하드)
 * 실험실, 음악실, 컴퓨터실 등 특수 교실은 동시에 두 반 이상 사용 불가
 */
export class SpecialRoomConflictConstraint extends BaseConstraint {
  metadata = {
    id: 'special_room_conflict',
    name: '특별실 중복 사용 금지',
    description: '같은 특별실을 같은 시간에 여러 반이 사용할 수 없습니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'facility',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.roomId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    const room = timetable.rooms.find(r => r.id === slot.roomId);

    if (!subject || !room || room.type === 'regular') {
      return this.success();
    }

    // 같은 특별실을 같은 시간에 사용하는 다른 반이 있는지 확인
    const conflictingClass = this.findConflictingClass(
      timetable,
      slot.roomId,
      slot.day,
      slot.period,
      slot.classId
    );

    if (conflictingClass) {
      return this.failure(
        `${room.name}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass}에서 사용 중입니다.`,
        'error',
        {
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
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

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.roomId) continue;

          const room = timetable.rooms.find(r => r.id === slot.roomId);
          if (!room || room.type === 'regular') continue;

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
        const room = timetable.rooms.find(r => r.id === roomId);
        const classNames = classes.map(c => timetable.classes.find(cl => cl.id === c.classId)?.name || c.classId).join(', ');

        violations.push(
          `${room?.name || roomId}이(가) ${day}요일 ${period}교시에 ${classes.length}개 반(${classNames})에서 중복 사용`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(`특별실 중복 사용 ${violations.length}건 발견`, 'error', { violations });
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

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && slot.roomId === roomId) {
        return timetable.classes.find(c => c.id === classId)?.name || classId;
      }
    }

    return null;
  }
}

/**
 * 이동수업 교실 거리 최소화 (소프트)
 * 이동수업 시 교실 거리 최소화(가능하면 동일 층)
 */
export class ClassroomDistanceConstraint extends BaseConstraint {
  metadata = {
    id: 'classroom_distance',
    name: '교실 거리 최소화',
    description: '이동수업 시 교실 거리를 최소화합니다.',
    type: 'soft' as const,
    priority: 'low' as const,
    category: 'facility',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 소프트 제약조건이므로 항상 통과
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    // 소프트 제약조건이므로 항상 통과
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let penalty = 0;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      const classFloor = classItem.floor || 1;

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        let prevRoomFloor: number | null = null;

        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.roomId) continue;

          const room = timetable.rooms.find(r => r.id === slot.roomId);
          if (!room) continue;

          const roomFloor = room.floor || 1;

          if (prevRoomFloor !== null) {
            const floorDiff = Math.abs(roomFloor - prevRoomFloor);
            if (floorDiff > 0) {
              penalty += floorDiff * 2; // 층 차이당 2점 페널티
            }
          }

          prevRoomFloor = roomFloor;
        }
      }
    }

    return -penalty; // 페널티는 음수로 반환
  }
}
