// 학급 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from './types';
import { isClassOccupiedAt, getSlot } from './utils';

/**
 * 반 중복 수업 금지 제약조건
 */
export class ClassNoOverlapConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'class_no_overlap',
    name: '반 중복 수업 금지',
    description: '한 반은 동일 시간대에 두 과목 이상을 수업할 수 없습니다.',
    priority: 'critical' as const,
    category: 'class' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.teacherId) {
      return this.success();
    }

    const existingSlot = getSlot(timetable, slot.classId, slot.day, slot.period);

    if (existingSlot && !this.isEmptySlot(existingSlot)) {
      const existingSubject = this.findSubject(timetable, existingSlot.subjectId);
      const newSubject = this.findSubject(timetable, slot.subjectId);
      const classItem = this.findClass(timetable, slot.classId);

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
    // checkBeforePlacement에서 이미 방지되므로 여기서는 성공 반환
    return this.success();
  }
}

/**
 * 학년별 공통 시간대 제약조건
 */
export class GradeCommonTimeConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'grade_common_time',
    name: '학년별 공통 시간대',
    description: '학년 전체가 동일 시간대에 공통 활동을 해야 합니다.',
    priority: 'critical' as const,
    category: 'class' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 특수 프로그램으로 처리되므로 여기서는 기본 검증만 수행
    if (slot.isSpecialProgram && slot.programType === 'creative') {
      // 창의적 체험활동은 학년 전체가 같은 시간에 있어야 함
      const classItem = this.findClass(timetable, slot.classId);
      if (!classItem) return this.success();

      // 같은 학년의 다른 반들 확인
      const sameGradeClasses = timetable.classes.filter(c => c.grade === classItem.grade && c.id !== slot.classId);

      for (const otherClass of sameGradeClasses) {
        const otherSlot = getSlot(timetable, otherClass.id, slot.day, slot.period);
        
        // 다른 반이 같은 시간에 특수 프로그램이 아니면 위반
        if (otherSlot && !otherSlot.isSpecialProgram) {
          return this.failure(
            `${classItem.grade}학년 공통 시간대(${slot.day}요일 ${slot.period}교시)에 ${otherClass.name}이(가) 일반 수업 중입니다.`,
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
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    // 특수 프로그램이 있는 경우 학년별 공통 시간 확인
    if (timetable.specialPrograms) {
      for (const program of timetable.specialPrograms) {
        if (program.type === 'creative' && program.grade) {
          // 같은 학년의 모든 반이 같은 시간에 프로그램에 참여해야 함
          const gradeClasses = timetable.classes.filter(c => c.grade === program.grade);

          for (const classItem of gradeClasses) {
            // 프로그램 시간 확인
            const programDay = program.fixedDay;
            const programPeriod = program.fixedPeriod;

            if (programDay && programPeriod) {
              const slot = getSlot(timetable, classItem.id, programDay, programPeriod);
              
              if (!slot || !slot.isSpecialProgram || slot.programType !== 'creative') {
                violations.push(
                  `${program.grade}학년 ${classItem.name}이(가) 공통 시간대(${programDay}요일 ${programPeriod}교시)에 창의적 체험활동에 참여하지 않음`
                );
              }
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `학년별 공통 시간대 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}
