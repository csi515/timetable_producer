// 특수 프로그램 제약조건 (창체, 동아리, 코티칭, 수준별)

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, SpecialProgram } from '../types';

/**
 * 창의적 체험활동 제약조건 (하드)
 * 학년 전체가 동일 시간대 사용, 주 1~2회 고정 편성
 */
export class CreativeActivityConstraint extends BaseConstraint {
  metadata = {
    id: 'creative_activity',
    name: '창의적 체험활동',
    description: '학년 전체가 동일 시간대에 창의적 체험활동을 해야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'creative') {
      return this.success();
    }

    const classItem = timetable.classes.find(c => c.id === slot.classId);
    if (!classItem) {
      return this.success();
    }

    // 같은 학년의 다른 학급들도 같은 시간에 배정되어야 함
    const sameGradeClasses = timetable.classes.filter(c => c.grade === classItem.grade && c.id !== slot.classId);

    for (const otherClass of sameGradeClasses) {
      const otherSlot = this.getSlot(timetable, otherClass.id, slot.day, slot.period);

      if (!otherSlot || !otherSlot.isSpecialProgram || otherSlot.programType !== 'creative') {
        return this.failure(
          `${classItem.grade}학년 창의적 체험활동은 모든 학급이 동일 시간대(${slot.day}요일 ${slot.period}교시)에 배정되어야 합니다.`,
          'error',
          {
            grade: classItem.grade,
            day: slot.day,
            period: slot.period,
            missingClass: otherClass.name,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    if (!timetable.specialPrograms) {
      return this.success();
    }

    const creativePrograms = timetable.specialPrograms.filter(p => p.type === 'creative');

    for (const program of creativePrograms) {
      if (program.grade === undefined) continue;

      const gradeClasses = timetable.classes.filter(c => c.grade === program.grade);
      const programSlots: Record<string, Set<string>> = {}; // day_period -> classIds

      for (const classItem of gradeClasses) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.isSpecialProgram && slot.programType === 'creative') {
              const key = `${day}_${period}`;
              if (!programSlots[key]) {
                programSlots[key] = new Set();
              }
              programSlots[key].add(classItem.id);
            }
          }
        }
      }

      // 모든 학급이 같은 시간에 배정되었는지 확인
      for (const [key, classIds] of Object.entries(programSlots)) {
        if (classIds.size !== gradeClasses.length) {
          const [day, period] = key.split('_');
          violations.push(
            `${program.grade}학년 창의적 체험활동이 ${day}요일 ${period}교시에 일부 학급만 배정됨 (${classIds.size}/${gradeClasses.length})`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`창의적 체험활동 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 동아리 활동 제약조건 (하드/소프트)
 * 전교 단위 혹은 학년 단위 편성, 필요 시 교사 배정 없이도 가능
 */
export class ClubActivityConstraint extends BaseConstraint {
  metadata = {
    id: 'club_activity',
    name: '동아리 활동',
    description: '동아리 활동은 전교 또는 학년 단위로 편성됩니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'club') {
      return this.success();
    }

    // 동아리는 교사 배정 없이도 가능하므로 teacherId 체크 생략
    // 특별 프로그램이므로 추가 검증 불필요
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    // 동아리 활동은 유연하게 처리되므로 기본 검증만 수행
    return this.success();
  }
}

/**
 * 공동수업(코티칭) 제약조건 (하드)
 * 두 명 이상의 교사가 동시에 참여해야 하는 수업
 */
export class CoTeachingConstraint extends BaseConstraint {
  metadata = {
    id: 'co_teaching',
    name: '공동수업',
    description: '공동수업은 모든 담당 교사가 동시에 참여해야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'co-teaching' || !slot.coTeachers || slot.coTeachers.length === 0) {
      return this.success();
    }

    // 모든 공동수업 교사가 해당 시간에 비어있는지 확인
    const allTeachers = [slot.teacherId, ...slot.coTeachers].filter(Boolean) as string[];

    for (const teacherId of allTeachers) {
      const isBusy = this.isTeacherAssignedAt(timetable, teacherId, slot.day, slot.period, slot.classId);

      if (isBusy) {
        const teacher = timetable.teachers.find(t => t.id === teacherId);
        return this.failure(
          `${teacher?.name || teacherId} 교사가 ${slot.day}요일 ${slot.period}교시에 이미 수업 중입니다. (공동수업 불가)`,
          'error',
          {
            teacherId,
            teacherName: teacher?.name,
            day: slot.day,
            period: slot.period,
            programType: 'co-teaching',
          }
        );
      }

      // 불가능 시간도 확인
      const teacher = timetable.teachers.find(t => t.id === teacherId);
      if (teacher) {
        const isUnavailable = teacher.unavailableSlots.some(
          unavailable => unavailable.day === slot.day && unavailable.period === slot.period
        );

        if (isUnavailable) {
          return this.failure(
            `${teacher.name} 교사는 ${slot.day}요일 ${slot.period}교시에 수업할 수 없습니다. (공동수업 불가)`,
            'error',
            {
              teacherId: teacher.id,
              teacherName: teacher.name,
              day: slot.day,
              period: slot.period,
            }
          );
        }
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.isSpecialProgram || slot.programType !== 'co-teaching' || !slot.coTeachers) {
            continue;
          }

          const allTeachers = [slot.teacherId, ...slot.coTeachers].filter(Boolean) as string[];

          // 모든 교사가 같은 시간에 배정되었는지 확인
          for (const teacherId of allTeachers) {
            const isAssigned = this.isTeacherAssignedAt(timetable, teacherId, day, period, classId);

            if (!isAssigned) {
              const teacher = timetable.teachers.find(t => t.id === teacherId);
              violations.push(
                `공동수업에서 ${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 배정되지 않음`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`공동수업 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 수준별 이동수업 제약조건 (하드)
 * 한 학년의 특정 시간에 전체 이동수업 플랫폼 구성
 */
export class LevelBasedTeachingConstraint extends BaseConstraint {
  metadata = {
    id: 'level_based_teaching',
    name: '수준별 이동수업',
    description: '수준별 이동수업은 학년 전체가 동일 시간대에 진행되어야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'level-based') {
      return this.success();
    }

    const classItem = timetable.classes.find(c => c.id === slot.classId);
    if (!classItem) {
      return this.success();
    }

    // 같은 학년의 다른 학급들도 같은 시간에 배정되어야 함
    const sameGradeClasses = timetable.classes.filter(c => c.grade === classItem.grade && c.id !== slot.classId);

    for (const otherClass of sameGradeClasses) {
      const otherSlot = this.getSlot(timetable, otherClass.id, slot.day, slot.period);

      if (!otherSlot || !otherSlot.isSpecialProgram || otherSlot.programType !== 'level-based') {
        return this.failure(
          `${classItem.grade}학년 수준별 이동수업은 모든 학급이 동일 시간대(${slot.day}요일 ${slot.period}교시)에 배정되어야 합니다.`,
          'error',
          {
            grade: classItem.grade,
            day: slot.day,
            period: slot.period,
            missingClass: otherClass.name,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    if (!timetable.specialPrograms) {
      return this.success();
    }

    const levelPrograms = timetable.specialPrograms.filter(p => p.type === 'level-based');

    for (const program of levelPrograms) {
      if (program.grade === undefined) continue;

      const gradeClasses = timetable.classes.filter(c => c.grade === program.grade);
      const programSlots: Record<string, Set<string>> = {};

      for (const classItem of gradeClasses) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.isSpecialProgram && slot.programType === 'level-based') {
              const key = `${day}_${period}`;
              if (!programSlots[key]) {
                programSlots[key] = new Set();
              }
              programSlots[key].add(classItem.id);
            }
          }
        }
      }

      // 모든 학급이 같은 시간에 배정되었는지 확인
      for (const [key, classIds] of Object.entries(programSlots)) {
        if (classIds.size !== gradeClasses.length) {
          const [day, period] = key.split('_');
          violations.push(
            `${program.grade}학년 수준별 이동수업이 ${day}요일 ${period}교시에 일부 학급만 배정됨 (${classIds.size}/${gradeClasses.length})`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`수준별 이동수업 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}
