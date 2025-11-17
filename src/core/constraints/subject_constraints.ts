// 과목 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from './types';
import {
  countSubjectDailyLessons,
  countSubjectWeeklyLessons,
  getSlot,
} from './utils';

/**
 * 과목 주당 시수 제약조건
 */
export class SubjectWeeklyHoursConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_weekly_hours',
    name: '과목 주당 시수',
    description: '과목별 주당 시수가 정확히 만족되어야 합니다.',
    priority: 'critical' as const,
    category: 'subject' as const,
    isHard: true,
  };

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const assignedHours = countSubjectWeeklyLessons(timetable, classItem.id, subject.id);

        if (assignedHours !== subject.weeklyHours) {
          violations.push(
            `${classItem.name}의 ${subject.name}: 주당 시수 ${assignedHours}시간 (필요: ${subject.weeklyHours}시간)`
          );
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `과목 주당 시수 불일치 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 배치 전에는 검사 불가 (전체 시간표 완성 후 검증)
    return this.success();
  }
}

/**
 * 과목 하루 배정 제한 제약조건
 */
export class SubjectMaxPerDayConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_max_per_day',
    name: '과목 하루 배정 제한',
    description: '같은 과목이 같은 반에서 하루에 2회 이상 배정되는 것을 방지합니다.',
    priority: 'high' as const,
    category: 'subject' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = this.findSubject(timetable, slot.subjectId);
    const maxPerDay = subject?.maxPerDay ?? 1;

    const dailyCount = countSubjectDailyLessons(timetable, slot.classId, slot.subjectId, slot.day);

    if (dailyCount >= maxPerDay) {
      const classItem = this.findClass(timetable, slot.classId);

      return this.failure(
        `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 ${slot.day}요일에 이미 ${dailyCount}회 배정되었습니다. (최대 ${maxPerDay}회)`,
        'error',
        {
          classId: slot.classId,
          className: classItem?.name,
          subjectId: slot.subjectId,
          subjectName: subject?.name,
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
        const maxPerDay = subject.maxPerDay ?? 1;

        for (const day of timetable.schoolSchedule.days) {
          const dailyCount = countSubjectDailyLessons(timetable, classItem.id, subject.id, day);

          if (dailyCount > maxPerDay) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${dailyCount}회 배정됨 (최대 ${maxPerDay}회)`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `과목 하루 배정 제한 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}

/**
 * 과목 고정 시간 제약조건
 */
export class SubjectFixedTimeConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'subject_fixed_time',
    name: '과목 고정 시간',
    description: '특정 과목은 반드시 특정 요일/시간에만 편성되어야 합니다.',
    priority: 'critical' as const,
    category: 'subject' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId) {
      return this.success();
    }

    const subject = this.findSubject(timetable, slot.subjectId);
    if (!subject) {
      return this.success();
    }

    // 고정 요일 확인
    if (subject.fixedDay && subject.fixedDay !== slot.day) {
      return this.failure(
        `${subject.name} 과목은 ${subject.fixedDay}요일에만 배정 가능합니다.`,
        'error',
        {
          subjectId: subject.id,
          subjectName: subject.name,
          requiredDay: subject.fixedDay,
          attemptedDay: slot.day,
        }
      );
    }

    // 고정 교시 확인
    if (subject.fixedPeriod && subject.fixedPeriod !== slot.period) {
      return this.failure(
        `${subject.name} 과목은 ${subject.fixedPeriod}교시에만 배정 가능합니다.`,
        'error',
        {
          subjectId: subject.id,
          subjectName: subject.name,
          requiredPeriod: subject.fixedPeriod,
          attemptedPeriod: slot.period,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.fixedDay && !subject.fixedPeriod) continue;

      for (const classItem of timetable.classes) {
        const assignedHours = countSubjectWeeklyLessons(timetable, classItem.id, subject.id);

        if (assignedHours > 0) {
          // 고정 시간에 배정되었는지 확인
          let foundAtFixedTime = false;

          if (subject.fixedDay && subject.fixedPeriod) {
            const slot = getSlot(timetable, classItem.id, subject.fixedDay, subject.fixedPeriod);
            if (slot && slot.subjectId === subject.id) {
              foundAtFixedTime = true;
            }
          }

          if (!foundAtFixedTime && subject.fixedDay && subject.fixedPeriod) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 고정 시간(${subject.fixedDay}요일 ${subject.fixedPeriod}교시)에 배정되지 않음`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `과목 고정 시간 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}

/**
 * 연강 필요 과목 제약조건
 */
export class ConsecutiveRequiredConstraint extends BaseConstraint {
  readonly metadata = {
    id: 'consecutive_required',
    name: '연강 필요 과목',
    description: '연강이 필요한 과목은 연속 교시로 배치되어야 합니다.',
    priority: 'high' as const,
    category: 'subject' as const,
    isHard: true,
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    const subject = this.findSubject(timetable, slot.subjectId);
    if (!subject?.requiresConsecutive) {
      return this.success();
    }

    const consecutivePeriods = subject.consecutivePeriods || 2;

    // 같은 반에서 같은 과목이 이미 배정되었는지 확인
    const existingSlots: Array<{ period: number }> = [];
    const daySchedule = timetable.timetable[slot.classId]?.[slot.day];
    
    if (daySchedule) {
      const maxPeriod = timetable.schoolSchedule.periodsPerDay[slot.day];
      for (let p = 1; p <= maxPeriod; p++) {
        const s = daySchedule[p];
        if (s && s.subjectId === slot.subjectId) {
          existingSlots.push({ period: p });
        }
      }
    }

    if (existingSlots.length > 0) {
      // 연속인지 확인
      const allPeriods = [...existingSlots.map(s => s.period), slot.period].sort((a, b) => a - b);
      
      // 연속 교시인지 확인
      let isConsecutive = false;
      for (let i = 0; i <= allPeriods.length - consecutivePeriods; i++) {
        let consecutive = true;
        for (let j = 1; j < consecutivePeriods; j++) {
          if (allPeriods[i + j] !== allPeriods[i] + j) {
            consecutive = false;
            break;
          }
        }
        if (consecutive) {
          isConsecutive = true;
          break;
        }
      }

      if (!isConsecutive) {
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutivePeriods}교시로 배정되어야 합니다.`,
          'error',
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            day: slot.day,
            periods: allPeriods,
            requiredConsecutive: consecutivePeriods,
          }
        );
      }
    } else {
      // 첫 번째 배정인 경우, 인접 교시가 비어있는지 확인
      const nextSlot = getSlot(timetable, slot.classId, slot.day, slot.period + 1);
      const prevSlot = getSlot(timetable, slot.classId, slot.day, slot.period - 1);

      if (consecutivePeriods === 2 && !nextSlot && !prevSlot) {
        return this.failure(
          `${subject.name} 과목은 연속 ${consecutivePeriods}교시로 배정되어야 합니다. 인접한 교시가 비어있지 않습니다.`,
          'error',
          {
            subjectId: subject.id,
            subjectName: subject.name,
            classId: slot.classId,
            day: slot.day,
            period: slot.period,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const subject of timetable.subjects) {
      if (!subject.requiresConsecutive) continue;
      const consecutivePeriods = subject.consecutivePeriods || 2;

      for (const classItem of timetable.classes) {
        const classSchedule = timetable.timetable[classItem.id];
        if (!classSchedule) continue;

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
          const subjectPeriods: number[] = [];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              subjectPeriods.push(period);
            }
          }

          // 연속 교시인지 확인
          if (subjectPeriods.length > 0 && subjectPeriods.length < consecutivePeriods) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 ${subjectPeriods.length}교시만 배정됨 (연속 ${consecutivePeriods}교시 필요)`
            );
          } else if (subjectPeriods.length >= consecutivePeriods) {
            // 연속인지 확인
            subjectPeriods.sort((a, b) => a - b);
            let isConsecutive = false;
            for (let i = 0; i <= subjectPeriods.length - consecutivePeriods; i++) {
              let consecutive = true;
              for (let j = 1; j < consecutivePeriods; j++) {
                if (subjectPeriods[i + j] !== subjectPeriods[i] + j) {
                  consecutive = false;
                  break;
                }
              }
              if (consecutive) {
                isConsecutive = true;
                break;
              }
            }

            if (!isConsecutive) {
              violations.push(
                `${classItem.name}의 ${subject.name} 과목이 ${day}요일에 연속이 아닌 ${subjectPeriods.join(', ')}교시에 배정됨`
              );
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `연강 필요 과목 위반 ${violations.length}건 발견`,
        'error',
        { violations }
      );
    }

    return this.success();
  }
}
