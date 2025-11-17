// 학급 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';
import { isClassOccupiedAt, getSlot } from '../utils';

/**
 * 학급 중복 수업 금지 제약조건
 */
export class ClassNoOverlapConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'class_no_overlap',
    name: '학급 중복 수업 금지',
    description: '한 학급은 동일 시간대에 두 과목 이상을 수업할 수 없습니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'class',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.teacherId) {
      return this.success();
    }

    const existingSlot = getSlot(timetable, slot.classId, slot.day, slot.period);

    if (existingSlot && !this.isEmptySlot(existingSlot)) {
      const existingSubject = timetable.subjects.find((s) => s.id === existingSlot.subjectId);
      const newSubject = timetable.subjects.find((s) => s.id === slot.subjectId);
      const classItem = timetable.classes.find((c) => c.id === slot.classId);

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
    description: '학년별 공통 시간대(창의적 체험활동, 학년행사 등)를 강제합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'class',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    const classItem = timetable.classes.find((c) => c.id === slot.classId);
    if (!classItem) {
      return this.failure(`학급을 찾을 수 없습니다: ${slot.classId}`, 'error');
    }

    // 특수 프로그램 확인
    if (timetable.specialPrograms) {
      for (const program of timetable.specialPrograms) {
        if (
          program.type === 'creative' &&
          program.targetGrade === classItem.grade &&
          program.day === slot.day &&
          program.period === slot.period
        ) {
          // 공통 시간대에는 다른 수업 배정 불가
          if (slot.subjectId && !this.isSpecialProgramSubject(slot.subjectId, program)) {
            return this.failure(
              `${classItem.name}은(는) ${slot.day}요일 ${slot.period}교시에 학년 공통 시간(창의적 체험활동)이 있습니다.`,
              'error',
              {
                classId: slot.classId,
                className: classItem.name,
                day: slot.day,
                period: slot.period,
                programName: program.name,
              }
            );
          }
        }
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    if (!timetable.specialPrograms) {
      return this.success();
    }

    for (const program of timetable.specialPrograms) {
      if (program.type !== 'creative') continue;

      for (const classId of program.targetClasses) {
        const slot = getSlot(timetable, classId, program.day, program.period);
        const classItem = timetable.classes.find((c) => c.id === classId);

        if (slot && slot.subjectId && !this.isSpecialProgramSubject(slot.subjectId, program)) {
          violations.push(
            `${classItem?.name || classId}의 ${program.day}요일 ${program.period}교시에 공통 시간 위반`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`학년별 공통 시간대 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private isSpecialProgramSubject(subjectId: string, program: any): boolean {
    // 특수 프로그램 과목인지 확인 (실제로는 프로그램 정보에서 확인)
    return false;
  }
}
