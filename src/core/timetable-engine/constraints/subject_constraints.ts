// 과목 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 과목별 주당 시수 정확히 만족 (Hard)
 */
export class SubjectWeeklyHoursConstraint extends BaseConstraint {
  id = 'subject_weekly_hours';
  name = '과목 주당 시수';
  type = 'hard' as const;
  priority = 10;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    // 배치 전에는 검사 불가 (전체 시간표 완성 후 검증)
    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const classItem of data.classes) {
      const classSchedule = timetable[classItem.id];
      if (!classSchedule) continue;

      // 각 과목별 배정된 시수 계산
      const subjectHours: Record<string, number> = {};

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!this.isSlotEmpty(slot) && slot.subjectId) {
            subjectHours[slot.subjectId] = (subjectHours[slot.subjectId] || 0) + 1;
          }
        }
      }

      // 해당 학년의 과목들 확인
      const gradeSubjects = data.subjects.filter(s => s.grade === classItem.grade);

      for (const subject of gradeSubjects) {
        const assignedHours = subjectHours[subject.id] || 0;

        if (assignedHours !== subject.weeklyHours) {
          violations.push(this.failure(
            `${classItem.name}의 ${subject.name} 과목이 ${assignedHours}시간 배정됨 (필요: ${subject.weeklyHours}시간)`,
            {
              subjectId: subject.id,
              subjectName: subject.name,
              classId: classItem.id,
              className: classItem.name,
              assignedHours,
              requiredHours: subject.weeklyHours,
            }
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 과목 동일 요일 2회 이상 배정 금지 (Hard)
 */
export class SubjectNoDuplicatePerDayConstraint extends BaseConstraint {
  id = 'subject_no_duplicate_per_day';
  name = '과목 동일 요일 중복 배정 금지';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId) return this.success();

    // 같은 반에서 같은 날에 이미 배정된 횟수 확인
    const dailyCount = this.countDailyLessons(timetable, slot.classId, slot.subjectId, slot.day);

    if (dailyCount >= 1) {
      const subject = data.subjects.find(s => s.id === slot.subjectId);
      const classItem = data.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 ${slot.day}요일에 이미 배정되었습니다.`,
        {
          subjectId: slot.subjectId,
          subjectName: subject?.name,
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          currentCount: dailyCount,
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

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const subjectCounts: Record<string, number> = {};
        const maxPeriod = data.schoolConfig.periodsPerDay[day];

        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!this.isSlotEmpty(slot) && slot.subjectId) {
            subjectCounts[slot.subjectId] = (subjectCounts[slot.subjectId] || 0) + 1;
          }
        }

        for (const [subjectId, count] of Object.entries(subjectCounts)) {
          if (count > 1) {
            const subject = data.subjects.find(s => s.id === subjectId);
            violations.push(this.failure(
              `${classItem.name}의 ${subject?.name || subjectId} 과목이 ${day}요일에 ${count}회 배정됨`,
              {
                subjectId,
                subjectName: subject?.name,
                classId: classItem.id,
                className: classItem.name,
                day,
                count,
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
    const maxPeriod = 10;

    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (!this.isSlotEmpty(slot) && slot.subjectId === subjectId) {
        count++;
      }
    }

    return count;
  }
}

/**
 * 연강 필요 과목 연속 배치 (Hard)
 */
export class SubjectConsecutiveRequiredConstraint extends BaseConstraint {
  id = 'subject_consecutive_required';
  name = '연강 필요 과목 연속 배치';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId) return this.success();

    const subject = data.subjects.find(s => s.id === slot.subjectId);
    if (!subject?.requiresConsecutive) return this.success();

    const consecutiveHours = subject.consecutiveHours || 2;

    // 같은 반에서 같은 과목이 이미 배정되었는지 확인
    const existingSlot = this.findExistingSlot(timetable, slot.classId, slot.subjectId, slot.day);

    if (existingSlot) {
      // 연속인지 확인
      const periodDiff = Math.abs(existingSlot.period - slot.period);
      if (periodDiff !== 1) {
        const classItem = data.classes.find(c => c.id === slot.classId);
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutiveHours}교시로 배정되어야 합니다. (현재 ${existingSlot.period}교시와 ${slot.period}교시는 연속이 아님)`,
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            className: classItem?.name,
            day: slot.day,
            existingPeriod: existingSlot.period,
            newPeriod: slot.period,
            requiredConsecutive: consecutiveHours,
          }
        );
      }
    } else {
      // 첫 번째 배정인 경우, 인접 교시가 비어있는지 확인
      const nextSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period + 1);
      const prevSlot = this.getSlot(timetable, slot.classId, slot.day, slot.period - 1);

      if (this.isSlotEmpty(nextSlot) && this.isSlotEmpty(prevSlot)) {
        const classItem = data.classes.find(c => c.id === slot.classId);
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutiveHours}교시로 배정되어야 합니다. 인접한 교시가 비어있지 않습니다.`,
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            className: classItem?.name,
            day: slot.day,
            period: slot.period,
            requiredConsecutive: consecutiveHours,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const subject of data.subjects) {
      if (!subject.requiresConsecutive) continue;
      const consecutiveHours = subject.consecutiveHours || 2;

      for (const classItem of data.classes) {
        if (classItem.grade !== subject.grade) continue;

        const classSchedule = timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const subjectPeriods: number[] = [];
          const maxPeriod = data.schoolConfig.periodsPerDay[day];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (!this.isSlotEmpty(slot) && slot.subjectId === subject.id) {
              subjectPeriods.push(period);
            }
          }

          // 연속 배치 확인
          if (subjectPeriods.length > 0 && subjectPeriods.length < consecutiveHours) {
            violations.push(this.failure(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${subjectPeriods.length}교시만 배정됨 (연속 ${consecutiveHours}교시 필요)`,
              {
                subjectId: subject.id,
                subjectName: subject.name,
                classId: classItem.id,
                className: classItem.name,
                day,
                assignedHours: subjectPeriods.length,
                requiredHours: consecutiveHours,
              }
            ));
          } else if (subjectPeriods.length === consecutiveHours) {
            // 연속인지 확인
            const sorted = subjectPeriods.sort((a, b) => a - b);
            const isConsecutive = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1);

            if (!isConsecutive) {
              violations.push(this.failure(
                `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 연속이 아닌 ${subjectPeriods.join(', ')}교시에 배정됨`,
                {
                  subjectId: subject.id,
                  subjectName: subject.name,
                  classId: classItem.id,
                  className: classItem.name,
                  day,
                  periods: subjectPeriods,
                }
              ));
            }
          }
        }
      }
    }

    return violations;
  }

  private findExistingSlot(timetable: any, classId: string, subjectId: string, day: string): { period: number } | null {
    const classSchedule = timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return null;

    const maxPeriod = 10;
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (!this.isSlotEmpty(slot) && slot.subjectId === subjectId) {
        return { period };
      }
    }

    return null;
  }
}
