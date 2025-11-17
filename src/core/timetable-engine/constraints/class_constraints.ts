// 학급/학교 정책 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';

/**
 * 학급 중복 수업 금지 (하드)
 * 한 학급은 동일 시간에 1개 수업만 가능
 */
export class ClassNoOverlapConstraint extends BaseConstraint {
  metadata = {
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

    const existingSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period);

    if (existingSlot && !this.isEmptySlot(existingSlot)) {
      const existingSubject = timetable.subjects.find(s => s.id === existingSlot.subjectId);
      const newSubject = timetable.subjects.find(s => s.id === slot.subjectId);
      const classItem = timetable.classes.find(c => c.id === slot.classId);

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
 * 학년별 공통 시간대 (하드)
 * 학년별 공통 시간대(창의적 체험활동, 학년행사 등) 강제
 */
export class GradeCommonSlotConstraint extends BaseConstraint {
  metadata = {
    id: 'grade_common_slot',
    name: '학년별 공통 시간대',
    description: '학년별 공통 시간대는 모든 학급이 동일하게 사용해야 합니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'class',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    const classItem = timetable.classes.find(c => c.id === slot.classId);
    if (!classItem) {
      return this.success();
    }

    const gradeCommonSlots = timetable.schoolConfig.gradeCommonSlots?.[classItem.grade];
    if (!gradeCommonSlots) {
      return this.success();
    }

    // 공통 시간대인지 확인
    const isCommonSlot = gradeCommonSlots.some(
      common => common.day === slot.day && common.period === slot.period
    );

    if (isCommonSlot) {
      // 같은 학년의 다른 학급들도 같은 시간에 배정되어야 함
      const sameGradeClasses = timetable.classes.filter(c => c.grade === classItem.grade && c.id !== slot.classId);
      
      for (const otherClass of sameGradeClasses) {
        const otherSlot = this.getSlot(timetable, otherClass.id, slot.day, slot.period);
        
        // 다른 학급이 비어있거나 다른 과목이면 위반
        if (!otherSlot || this.isEmptySlot(otherSlot) || otherSlot.subjectId !== slot.subjectId) {
          return this.failure(
            `${classItem.grade}학년 공통 시간대(${slot.day}요일 ${slot.period}교시)는 모든 학급이 동일한 과목을 배정해야 합니다.`,
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

    if (!timetable.schoolConfig.gradeCommonSlots) {
      return this.success();
    }

    for (const [gradeStr, commonSlots] of Object.entries(timetable.schoolConfig.gradeCommonSlots)) {
      const grade = parseInt(gradeStr);
      const gradeClasses = timetable.classes.filter(c => c.grade === grade);

      for (const commonSlot of commonSlots) {
        const subjectIds = new Set<string>();

        for (const classItem of gradeClasses) {
          const slot = this.getSlot(timetable, classItem.id, commonSlot.day, commonSlot.period);
          if (slot && slot.subjectId) {
            subjectIds.add(slot.subjectId);
          }
        }

        if (subjectIds.size > 1) {
          violations.push(
            `${grade}학년 공통 시간대(${commonSlot.day}요일 ${commonSlot.period}교시)에 서로 다른 과목이 배정됨`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`학년별 공통 시간대 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 특정 과목 고정 시간대 (하드)
 * 특정 과목은 반드시 특정 요일/시간에만 편성
 */
export class SubjectFixedSlotConstraint extends BaseConstraint {
  metadata = {
    id: 'subject_fixed_slot',
    name: '과목 고정 시간대',
    description: '특정 과목은 반드시 특정 요일/시간에만 편성됩니다.',
    type: 'hard' as const,
    priority: 'critical' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    if (!subject || !subject.fixedSlots || subject.fixedSlots.length === 0) {
      return this.success();
    }

    // 고정 시간대 중 하나인지 확인
    const isFixedSlot = subject.fixedSlots.some(
      fixed => fixed.day === slot.day && fixed.period === slot.period
    );

    if (!isFixedSlot) {
      const fixedSlotsStr = subject.fixedSlots.map(f => `${f.day} ${f.period}교시`).join(', ');
      return this.failure(
        `${subject.name} 과목은 고정 시간대(${fixedSlotsStr})에만 배정할 수 있습니다.`,
        'error',
        {
          subjectId: subject.id,
          subjectName: subject.name,
          day: slot.day,
          period: slot.period,
          fixedSlots: subject.fixedSlots,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.fixedSlots || subject.fixedSlots.length === 0) continue;

      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!slot || slot.subjectId !== subject.id) continue;

            const isFixedSlot = subject.fixedSlots.some(
              fixed => fixed.day === day && fixed.period === period
            );

            if (!isFixedSlot) {
              const classItem = timetable.classes.find(c => c.id === classId);
              violations.push(
                `${classItem?.name || classId}의 ${subject.name} 과목이 고정 시간대가 아닌 ${day}요일 ${period}교시에 배정됨`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`과목 고정 시간대 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }
}

/**
 * 특정 과목 중복 배치 금지 (하드)
 * 특정 과목은 중복 배치 금지(예: 체육 1,2교시 연강 불가)
 */
export class SubjectDuplicateForbiddenConstraint extends BaseConstraint {
  metadata = {
    id: 'subject_duplicate_forbidden',
    name: '과목 중복 배치 금지',
    description: '특정 과목은 중복 배치가 금지됩니다.',
    type: 'hard' as const,
    priority: 'high' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    const subject = timetable.subjects.find(s => s.id === slot.subjectId);
    if (!subject) {
      return this.success();
    }

    // 연강 필요 과목은 제외
    if (subject.requiresConsecutive) {
      return this.success();
    }

    // 같은 반, 같은 날에 이미 배정된 횟수 확인
    const dailyCount = this.countDailyLessonsForSubject(timetable, slot.classId, slot.subjectId, slot.day);

    // maxPerDay가 설정되어 있으면 그것을 사용, 없으면 1
    const maxPerDay = subject.maxPerDay ?? 1;

    if (dailyCount >= maxPerDay) {
      const classItem = timetable.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject.name} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
        'error',
        {
          classId: slot.classId,
          className: classItem?.name,
          subjectId: slot.subjectId,
          subjectName: subject.name,
          day: slot.day,
          currentCount: dailyCount,
          maxCount: maxPerDay,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        // 연강 필요 과목은 제외
        if (subject.requiresConsecutive) continue;

        const maxPerDay = subject.maxPerDay ?? 1;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const dailyCount = this.countDailyLessonsForSubject(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(`과목 중복 배치 위반 ${violations.length}건 발견`, 'error', { violations });
    }

    return this.success();
  }

  private countDailyLessonsForSubject(timetable: TimetableData, classId: string, subjectId: string, day: string): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolConfig.periodsPerDay[day as keyof typeof timetable.schoolConfig.periodsPerDay];

    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        count++;
      }
    }

    return count;
  }
}
