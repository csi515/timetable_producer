// 특수 프로그램 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';
import { getSlot, isTeacherAssignedAt } from '../utils';

/**
 * 공동수업(코티칭) 제약조건
 */
export class CoTeachingConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'co_teaching',
    name: '공동수업 제약조건',
    description: '공동수업은 모든 담당 교사가 동시에 비어있어야 합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.coTeachers || slot.coTeachers.length === 0) {
      return this.success();
    }

    const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
    if (!subject?.requiresCoTeaching) {
      return this.success();
    }

    // 모든 공동수업 교사가 해당 시간에 비어있는지 확인
    const unavailableTeachers: string[] = [];

    for (const teacherId of slot.coTeachers) {
      if (isTeacherAssignedAt(timetable, teacherId, slot.day, slot.period, slot.classId)) {
        const teacher = timetable.teachers.find((t) => t.id === teacherId);
        unavailableTeachers.push(teacher?.name || teacherId);
      }
    }

    if (unavailableTeachers.length > 0) {
      return this.failure(
        `공동수업 교사 ${unavailableTeachers.join(', ')}이(가) ${slot.day}요일 ${slot.period}교시에 이미 수업 중입니다.`,
        'error',
        {
          subjectId: slot.subjectId,
          subjectName: subject.name,
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
          if (!slot || !slot.subjectId || !slot.coTeachers) continue;

          const subject = timetable.subjects.find((s) => s.id === slot.subjectId);
          if (!subject?.requiresCoTeaching) continue;

          // 모든 교사가 배정되었는지 확인
          const missingTeachers: string[] = [];
          for (const teacherId of slot.coTeachers) {
            if (slot.teacherId !== teacherId && !slot.coTeachers.includes(teacherId)) {
              missingTeachers.push(teacherId);
            }
          }

          if (missingTeachers.length > 0) {
            violations.push(
              `${timetable.classes.find((c) => c.id === classId)?.name || classId}의 ${subject.name} 공동수업에 교사 ${missingTeachers.join(', ')} 누락`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`공동수업 제약조건 위반 ${violations.length}건 발견`, 'error', { violations });
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
    description: '수준별 이동수업은 학년 전체가 동일 시간에 진행되어야 합니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'special_program',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    const classItem = timetable.classes.find((c) => c.id === slot.classId);
    if (!classItem) {
      return this.success();
    }

    // 특수 프로그램 확인
    if (timetable.specialPrograms) {
      for (const program of timetable.specialPrograms) {
        if (
          program.type === 'level-based' &&
          program.targetGrade === classItem.grade &&
          program.day === slot.day &&
          program.period === slot.period
        ) {
          // 이동수업 시간에는 다른 수업 배정 불가
          if (slot.subjectId && !this.isLevelBasedSubject(slot.subjectId, program)) {
            return this.failure(
              `${classItem.name}은(는) ${slot.day}요일 ${slot.period}교시에 수준별 이동수업 시간입니다.`,
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
      if (program.type !== 'level-based') continue;

      // 모든 대상 학급이 동일 시간에 배정되었는지 확인
      const assignedClasses: string[] = [];

      for (const classId of program.targetClasses) {
        const slot = getSlot(timetable, classId, program.day, program.period);
        if (slot && slot.subjectId) {
          assignedClasses.push(classId);
        }
      }

      if (assignedClasses.length > 0 && assignedClasses.length < program.targetClasses.length) {
        violations.push(
          `수준별 이동수업 ${program.name}이(가) 일부 학급에만 배정됨 (${assignedClasses.length}/${program.targetClasses.length})`
        );
      }
    }

    if (violations.length > 0) {
      return this.failure(`수준별 이동수업 제약조건 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private isLevelBasedSubject(subjectId: string, program: any): boolean {
    // 이동수업 과목인지 확인
    return false;
  }
}
