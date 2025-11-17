// 학급 관련 하드 제약조건

import { BaseConstraint } from '../BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata, Day } from '../types';

/**
 * 학급 중복 수업 금지 제약조건
 */
export class ClassNoOverlapConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'class_no_overlap',
    name: '학급 중복 수업 금지',
    description: '한 학급은 동일 시간대에 두 과목 이상을 수업할 수 없습니다.',
    type: 'hard',
    category: 'class',
    priority: 2,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.teacherId) {
      return this.success();
    }

    return this.safeGet(() => {
      const existingSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period);

      if (existingSlot && !this.isEmptySlot(existingSlot)) {
        const existingSubject = timetable.subjects.find((s) => s.id === existingSlot.subjectId);
        const newSubject = timetable.subjects.find((s) => s.id === slot.subjectId);
        const classItem = timetable.classes.find((c) => c.id === slot.classId);

        return this.hardViolation(
          `${classItem?.name || slot.classId}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${existingSubject?.name || existingSlot.subjectId} 수업이 있습니다.`,
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
    }, this.success());
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    // checkHardConstraint에서 이미 방지되므로 여기서는 성공 반환
    return this.success();
  }

  propagate(slot: Slot, timetable: TimetableData, domains: Map<string, TimeSlot[]>): PropagationResult {
    const updatedDomains = new Map(domains);
    const prunedValues: Array<{ variableId: string; slot: TimeSlot }> = [];

    // 같은 반의 다른 변수들의 도메인에서 해당 시간 제거
    for (const [variableId, domain] of domains.entries()) {
      if (variableId.startsWith(`${slot.classId}_`)) {
        const filtered = domain.filter(
          (s) => !(s.day === slot.day && s.period === slot.period)
        );

        const removed = domain.length - filtered.length;
        if (removed > 0) {
          updatedDomains.set(variableId, filtered);
          prunedValues.push({ variableId, slot: { day: slot.day, period: slot.period } });
        }
      }
    }

    const hasEmptyDomain = Array.from(updatedDomains.values()).some((d) => d.length === 0);

    return { domains: updatedDomains, prunedValues, hasEmptyDomain };
  }
}

/**
 * 학년별 공통 시간대 제약조건 (창체, 학년행사 등)
 */
export class GradeCommonTimeConstraint extends BaseConstraint {
  readonly metadata: ConstraintMetadata = {
    id: 'grade_common_time',
    name: '학년별 공통 시간대',
    description: '학년 전체가 동일 시간대에 공통 활동을 해야 합니다.',
    type: 'hard',
    category: 'class',
    priority: 3,
  };

  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.isSpecialProgram || slot.programType !== 'creative') {
      return this.success();
    }

    return this.safeGet(() => {
      const classItem = timetable.classes.find((c) => c.id === slot.classId);
      if (!classItem) {
        return this.success();
      }

      // 같은 학년의 다른 반들이 같은 시간에 공통 프로그램을 해야 함
      const sameGradeClasses = timetable.classes.filter(
        (c) => c.grade === classItem.grade && c.id !== slot.classId
      );

      for (const otherClass of sameGradeClasses) {
        const otherSlot = this.getSlot(timetable, otherClass.id, slot.day, slot.period);
        if (!otherSlot || !otherSlot.isSpecialProgram || otherSlot.programType !== slot.programType) {
          return this.hardViolation(
            `${classItem.name}의 ${slot.day}요일 ${slot.period}교시 창체 시간은 같은 학년의 다른 반들과 일치해야 합니다.`,
            {
              classId: slot.classId,
              className: classItem.name,
              grade: classItem.grade,
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

    // 각 학년의 공통 프로그램 시간 확인
    for (const [grade, classIds] of Object.entries(gradeGroups)) {
      const gradeNum = parseInt(grade);
      for (const classId of classIds) {
        const classSchedule = timetable.timetable[classId];
        if (!classSchedule) continue;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!slot || !slot.isSpecialProgram || slot.programType !== 'creative') continue;

            // 다른 반들도 같은 시간에 창체가 있는지 확인
            for (const otherClassId of classIds) {
              if (otherClassId === classId) continue;

              const otherSlot = this.getSlot(timetable, otherClassId, day, period);
              if (!otherSlot || !otherSlot.isSpecialProgram || otherSlot.programType !== 'creative') {
                const className = timetable.classes.find((c) => c.id === classId)?.name || classId;
                violations.push(
                  `${className}의 ${day}요일 ${period}교시 창체 시간이 ${gradeNum}학년 공통 시간과 일치하지 않음`
                );
                break;
              }
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.hardViolation(`학년별 공통 시간대 위반 ${violations.length}건 발견`, { violations });
    }

    return this.success();
  }
}
