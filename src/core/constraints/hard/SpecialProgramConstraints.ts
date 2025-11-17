// 특수 프로그램 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from '../types';

/**
 * 코티칭(공동수업) 제약조건
 */
export class CoTeachingConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'co_teaching',
    name: '코티칭(공동수업)',
    description: '두 명 이상의 교사가 동시에 참여해야 하는 수업은 모든 교사의 시간대가 비어 있어야 합니다.',
    type: 'hard',
    category: 'special-program',
    priority: 3,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'co-teaching' || !slot.coTeachers) {
      return this.success();
    }

    return this.safeGet(() => {
      // 주교사 확인
      if (!slot.teacherId) {
        return this.hardViolation('코티칭 수업에는 주교사가 필요합니다.', {
          classId: slot.classId,
          day: slot.day,
          period: slot.period,
        });
      }

      // 모든 코티칭 교사가 해당 시간에 비어있는지 확인
      const allTeachers = [slot.teacherId, ...slot.coTeachers];
      const unavailableTeachers: string[] = [];

      for (const teacherId of allTeachers) {
        const isUnavailable = this.isTeacherAssignedAt(
          timetable,
          teacherId,
          slot.day,
          slot.period,
          slot.classId
        );

        if (isUnavailable) {
          const teacher = timetable.teachers.find((t) => t.id === teacherId);
          unavailableTeachers.push(teacher?.name || teacherId);
        }
      }

      if (unavailableTeachers.length > 0) {
        const classItem = timetable.classes.find((c) => c.id === slot.classId);
        return this.hardViolation(
          `코티칭 수업에 필요한 교사(${unavailableTeachers.join(', ')})가 ${slot.day}요일 ${slot.period}교시에 다른 수업 중입니다.`,
          {
            classId: slot.classId,
            className: classItem?.name,
            day: slot.day,
            period: slot.period,
            unavailableTeachers,
          }
        );
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.isSpecialProgram || slot.programType !== 'co-teaching') continue;

          if (!slot.teacherId || !slot.coTeachers || slot.coTeachers.length === 0) {
            const classItem = timetable.classes.find((c) => c.id === classId);
            violations.push(
              `${classItem?.name || classId}의 ${day}요일 ${period}교시 코티칭 수업에 교사 정보가 부족함`
            );
            continue;
          }

          // 모든 교사가 비어있는지 확인
          const allTeachers = [slot.teacherId, ...slot.coTeachers];
          for (const teacherId of allTeachers) {
            const isUnavailable = this.isTeacherAssignedAt(
              timetable,
              teacherId,
              day,
              period,
              classId
            );

            if (isUnavailable) {
              const teacher = timetable.teachers.find((t) => t.id === teacherId);
              const classItem = timetable.classes.find((c) => c.id === classId);
              violations.push(
                `${classItem?.name || classId}의 ${day}요일 ${period}교시 코티칭 수업에 ${teacher?.name || teacherId} 교사가 다른 수업 중`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`코티칭 제약조건 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}

/**
 * 수준별 이동수업 제약조건
 */
export class LevelBasedTeachingConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'level_based_teaching',
    name: '수준별 이동수업',
    description: '한 학년의 특정 시간에 전체 이동수업이 구성되어야 하며, 교실 충돌이 없어야 합니다.',
    type: 'hard',
    category: 'special-program',
    priority: 4,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'level-based') {
      return this.success();
    }

    return this.safeGet(() => {
      const classItem = timetable.classes.find((c) => c.id === slot.classId);
      if (!classItem) {
        return this.success();
      }

      // 같은 학년의 다른 반들도 같은 시간에 이동수업을 해야 함
      const sameGradeClasses = timetable.classes.filter(
        (c) => c.grade === classItem.grade && c.id !== slot.classId
      );

      for (const otherClass of sameGradeClasses) {
        const otherSlot = this.getSlot(timetable, otherClass.id, slot.day, slot.period);
        if (!otherSlot || !otherSlot.isSpecialProgram || otherSlot.programType !== 'level-based') {
          return this.hardViolation(
            `${classItem.name}의 ${slot.day}요일 ${slot.period}교시 이동수업은 같은 학년의 다른 반들과 일치해야 합니다.`,
            {
              classId: slot.classId,
              className: classItem.name,
              grade: classItem.grade,
              day: slot.day,
              period: slot.period,
            }
          );
        }

        // 교실 충돌 확인
        if (slot.roomId && otherSlot.roomId && slot.roomId === otherSlot.roomId) {
          return this.hardViolation(
            `${classItem.name}과 ${otherClass.name}이 같은 교실(${slot.roomId})을 동시에 사용할 수 없습니다.`,
            {
              classId: slot.classId,
              className: classItem.name,
              otherClassId: otherClass.id,
              otherClassName: otherClass.name,
              roomId: slot.roomId,
              day: slot.day,
              period: slot.period,
            }
          );
        }
      }

      return this.success();
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    // 학년별로 그룹화
    const gradeGroups: Record<number, string[]> = {};
    for (const classItem of timetable.classes) {
      if (!gradeGroups[classItem.grade]) {
        gradeGroups[classItem.grade] = [];
      }
      gradeGroups[classItem.grade].push(classItem.id);
    }

    // 각 학년의 이동수업 시간 확인
    for (const [grade, classIds] of Object.entries(gradeGroups)) {
      const gradeNum = parseInt(grade);
      const levelBasedSlots: Record<string, Array<{ classId: string; roomId?: string }>> = {};

      for (const classId of classIds) {
        const classSchedule = timetable.timetable[classId];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!slot || !slot.isSpecialProgram || slot.programType !== 'level-based') continue;

            const key = `${day}_${period}`;
            if (!levelBasedSlots[key]) {
              levelBasedSlots[key] = [];
            }
            levelBasedSlots[key].push({ classId, roomId: slot.roomId || undefined });
          }
        }
      }

      // 같은 시간에 모든 반이 이동수업을 하는지 확인
      for (const [key, classes] of Object.entries(levelBasedSlots)) {
        if (classes.length !== classIds.length) {
          const [day, period] = key.split('_');
          violations.push(
            `${gradeNum}학년의 ${day}요일 ${period}교시 이동수업에 일부 반만 참여함 (전체 ${classIds.length}개 반 중 ${classes.length}개 반만)`
          );
        }

        // 교실 충돌 확인
        const roomUsage: Record<string, string[]> = {};
        for (const { classId, roomId } of classes) {
          if (roomId) {
            if (!roomUsage[roomId]) {
              roomUsage[roomId] = [];
            }
            roomUsage[roomId].push(classId);
          }
        }

        for (const [roomId, usingClasses] of Object.entries(roomUsage)) {
          if (usingClasses.length > 1) {
            const [day, period] = key.split('_');
            const classNames = usingClasses
              .map((c) => timetable.classes.find((cl) => cl.id === c)?.name || c)
              .join(', ');
            violations.push(
              `${gradeNum}학년의 ${day}요일 ${period}교시 이동수업에서 ${roomId} 교실이 ${usingClasses.length}개 반(${classNames})에서 중복 사용`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`수준별 이동수업 제약조건 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}
