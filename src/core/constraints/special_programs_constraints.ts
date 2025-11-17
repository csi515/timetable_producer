// 특수 프로그램 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from './types';
import { getSlot, isTeacherAssignedAt } from './utils';

/**
 * 공동수업 제약조건
 */
export class CoTeachingConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'co_teaching',
    name: '공동수업',
    description: '두 명 이상의 교사가 동시에 참여해야 하는 수업입니다.',
    priority: 'high' as const,
    category: 'special_program' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isCoTeaching || !slot.coTeachers || slot.coTeachers.length === 0) {
      return this.success();
    }

    // 주교사 확인
    if (!slot.teacherId) {
      return this.failure(
        '공동수업에는 주교사가 필요합니다.',
        'error',
        { slot }
      );
    }

    // 모든 공동수업 교사가 해당 시간에 비어있는지 확인
    const allTeachers = [slot.teacherId, ...slot.coTeachers];
    const unavailableTeachers: string[] = [];

    for (const teacherId of allTeachers) {
      // 다른 반에서 수업 중인지 확인
      const isAssigned = isTeacherAssignedAt(timetable, teacherId, slot.day, slot.period, slot.classId);
      
      if (isAssigned) {
        const teacher = this.findTeacher(timetable, teacherId);
        unavailableTeachers.push(teacher?.name || teacherId);
      }

      // 불가능 시간 확인
      const teacher = this.findTeacher(timetable, teacherId);
      if (teacher) {
        const isUnavailable = teacher.unavailableSlots.some(
          unavailable => unavailable.day === slot.day && unavailable.period === slot.period
        );

        if (isUnavailable) {
          unavailableTeachers.push(`${teacher.name} (불가능 시간)`);
        }
      }
    }

    if (unavailableTeachers.length > 0) {
      return this.failure(
        `공동수업 교사 중 ${unavailableTeachers.join(', ')}이(가) ${slot.day}요일 ${slot.period}교시에 수업할 수 없습니다.`,
        'error',
        {
          day: slot.day,
          period: slot.period,
          unavailableTeachers,
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
          if (!slot || !slot.isCoTeaching || !slot.coTeachers) continue;

          // 모든 교사가 참여 가능한지 확인
          const allTeachers = [slot.teacherId, ...slot.coTeachers].filter(Boolean) as string[];
          
          for (const teacherId of allTeachers) {
            const isAssigned = isTeacherAssignedAt(timetable, teacherId, day, period, classId);
            if (isAssigned) {
              const teacher = this.findTeacher(timetable, teacherId);
              violations.push(
                `공동수업: ${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 다른 수업 중`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `공동수업 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}

/**
 * 수준별 이동수업 제약조건
 */
export class LevelBasedTeachingConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'level_based_teaching',
    name: '수준별 이동수업',
    description: '한 학년의 특정 시간에 전체 이동수업이 구성되어야 합니다.',
    priority: 'high' as const,
    category: 'special_program' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'level_based') {
      return this.success();
    }

    const classItem = this.findClass(timetable, slot.classId);
    if (!classItem) return this.success();

    // 같은 학년의 다른 반들도 같은 시간에 이동수업이어야 함
    const sameGradeClasses = timetable.classes.filter(
      c => c.grade === classItem.grade && c.id !== slot.classId
    );

    for (const otherClass of sameGradeClasses) {
      const otherSlot = getSlot(timetable, otherClass.id, slot.day, slot.period);
      
      // 다른 반이 같은 시간에 이동수업이 아니면 위반
      if (otherSlot && (!otherSlot.isSpecialProgram || otherSlot.programType !== 'level_based')) {
        return this.failure(
          `${classItem.grade}학년 수준별 이동수업 시간(${slot.day}요일 ${slot.period}교시)에 ${otherClass.name}이(가) 일반 수업 중입니다.`,
          'error',
          {
            grade: classItem.grade,
            day: slot.day,
            period: slot.period,
            conflictingClass: otherClass.name,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    // 특수 프로그램 확인
    if (timetable.specialPrograms) {
      for (const program of timetable.specialPrograms) {
        if (program.type === 'level_based' && program.grade) {
          const programDay = program.fixedDay;
          const programPeriod = program.fixedPeriod;

          if (programDay && programPeriod) {
            // 같은 학년의 모든 반이 같은 시간에 이동수업인지 확인
            const gradeClasses = timetable.classes.filter(c => c.grade === program.grade);

            for (const classItem of gradeClasses) {
              const slot = getSlot(timetable, classItem.id, programDay, programPeriod);
              
              if (!slot || !slot.isSpecialProgram || slot.programType !== 'level_based') {
                violations.push(
                  `${program.grade}학년 ${classItem.name}이(가) 수준별 이동수업 시간(${programDay}요일 ${programPeriod}교시)에 참여하지 않음`
                );
              }
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `수준별 이동수업 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}
