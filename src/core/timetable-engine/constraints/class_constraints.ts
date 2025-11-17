// 학급 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 학급 동시간대 중복 수업 금지 (Hard)
 */
export class ClassNoOverlapConstraint extends BaseConstraint {
  id = 'class_no_overlap';
  name = '학급 동시간대 중복 수업 금지';
  type = 'hard' as const;
  priority = 10;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId || !slot.teacherId) return this.success();

    // 같은 반이 같은 시간에 이미 수업이 있는지 확인
    const existingSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period);

    if (!this.isSlotEmpty(existingSlot)) {
      const existingSubject = data.subjects.find(s => s.id === existingSlot!.subjectId);
      const newSubject = data.subjects.find(s => s.id === slot.subjectId);
      const classItem = data.classes.find(c => c.id === slot.classId);

      return this.failure(
        `${classItem?.name || slot.classId}이(가) ${slot.day}요일 ${slot.period}교시에 이미 ${existingSubject?.name || existingSlot!.subjectId} 수업이 있습니다.`,
        {
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          existingSubjectId: existingSlot!.subjectId,
          existingSubjectName: existingSubject?.name,
          newSubjectId: slot.subjectId,
          newSubjectName: newSubject?.name,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    // checkBeforePlacement에서 이미 방지되므로 여기서는 빈 배열 반환
    return [];
  }
}

/**
 * 학년별 공통 시간대 강제 (Hard)
 */
export class GradeCommonPeriodConstraint extends BaseConstraint {
  id = 'grade_common_period';
  name = '학년별 공통 시간대';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!data.schoolConfig.gradeCommonPeriods) return this.success();

    const classItem = data.classes.find(c => c.id === slot.classId);
    if (!classItem) return this.success();

    // 해당 학년의 공통 시간대 확인
    const commonPeriods = data.schoolConfig.gradeCommonPeriods.filter(
      cp => cp.grade === classItem.grade && cp.day === slot.day && cp.period === slot.period
    );

    if (commonPeriods.length > 0) {
      const commonPeriod = commonPeriods[0];
      // 공통 시간대인데 일반 수업을 배정하려는 경우
      if (!slot.isSpecialProgram) {
        return this.failure(
          `${classItem.grade}학년은 ${slot.day}요일 ${slot.period}교시에 ${commonPeriod.activity} 시간입니다.`,
          {
            classId: slot.classId,
            className: classItem.name,
            grade: classItem.grade,
            day: slot.day,
            period: slot.period,
            requiredActivity: commonPeriod.activity,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    if (!data.schoolConfig.gradeCommonPeriods) return violations;

    for (const commonPeriod of data.schoolConfig.gradeCommonPeriods) {
      const gradeClasses = data.classes.filter(c => c.grade === commonPeriod.grade);

      for (const classItem of gradeClasses) {
        const slot = this.getSlot(timetable, classItem.id, commonPeriod.day, commonPeriod.period);

        if (this.isSlotEmpty(slot) || !slot.isSpecialProgram) {
          violations.push(this.failure(
            `${classItem.name}이(가) ${commonPeriod.day}요일 ${commonPeriod.period}교시에 ${commonPeriod.activity} 시간이 아닙니다.`,
            {
              classId: classItem.id,
              className: classItem.name,
              grade: classItem.grade,
              day: commonPeriod.day,
              period: commonPeriod.period,
              requiredActivity: commonPeriod.activity,
            }
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 특정 과목 고정 시간대 (Hard)
 */
export class SubjectFixedTimeConstraint extends BaseConstraint {
  id = 'subject_fixed_time';
  name = '과목 고정 시간대';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId) return this.success();

    const subject = data.subjects.find(s => s.id === slot.subjectId);
    if (!subject?.fixedTime) return this.success();

    // 고정 시간대와 일치하는지 확인
    if (subject.fixedTime.day !== slot.day || subject.fixedTime.period !== slot.period) {
      const classItem = data.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${subject.name} 과목은 반드시 ${subject.fixedTime.day}요일 ${subject.fixedTime.period}교시에 배정되어야 합니다.`,
        {
          subjectId: subject.id,
          subjectName: subject.name,
          classId: slot.classId,
          className: classItem?.name,
          currentDay: slot.day,
          currentPeriod: slot.period,
          requiredDay: subject.fixedTime.day,
          requiredPeriod: subject.fixedTime.period,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const subject of data.subjects) {
      if (!subject.fixedTime) continue;

      const gradeClasses = data.classes.filter(c => c.grade === subject.grade);

      for (const classItem of gradeClasses) {
        const slot = this.getSlot(timetable, classItem.id, subject.fixedTime.day, subject.fixedTime.period);

        if (this.isSlotEmpty(slot) || slot.subjectId !== subject.id) {
          violations.push(this.failure(
            `${classItem.name}의 ${subject.name} 과목이 고정 시간대(${subject.fixedTime.day}요일 ${subject.fixedTime.period}교시)에 배정되지 않았습니다.`,
            {
              subjectId: subject.id,
              subjectName: subject.name,
              classId: classItem.id,
              className: classItem.name,
              requiredDay: subject.fixedTime.day,
              requiredPeriod: subject.fixedTime.period,
            }
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 특정 과목 중복 배치 금지 (Hard) - 예: 체육 1,2교시 연강 불가
 */
export class SubjectNoDuplicateConstraint extends BaseConstraint {
  id = 'subject_no_duplicate';
  name = '과목 중복 배치 금지';
  type = 'hard' as const;
  priority = 8;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId) return this.success();

    const subject = data.subjects.find(s => s.id === slot.subjectId);
    if (!subject) return this.success();

    // 같은 반에서 같은 날에 이미 배정된 횟수 확인
    const dailyCount = this.countDailyLessons(timetable, slot.classId, slot.subjectId, slot.day);

    const maxPerDay = subject.maxPerDay || 1;
    if (dailyCount >= maxPerDay) {
      const classItem = data.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject.name} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
        {
          subjectId: subject.id,
          subjectName: subject.name,
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          currentCount: dailyCount,
          maxCount: maxPerDay,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const classItem of data.classes) {
      const classSchedule = timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of data.subjects) {
        const maxPerDay = subject.maxPerDay || 1;

        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const dailyCount = this.countDailyLessons(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(this.failure(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`,
              {
                subjectId: subject.id,
                subjectName: subject.name,
                classId: classItem.id,
                className: classItem.name,
                day,
                currentCount: dailyCount,
                maxCount: maxPerDay,
              }
            ));
          }
        }
      }
    }

    return violations;
  }

  private countDailyLessons(timetable: any, classId: string, subjectId: string, day: string): number {
    const classSchedule = timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = 10; // 최대 교시 수

    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (!this.isSlotEmpty(slot) && slot.subjectId === subjectId) {
        count++;
      }
    }

    return count;
  }
}
