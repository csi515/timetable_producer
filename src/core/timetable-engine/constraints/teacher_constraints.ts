// 교사 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 교사 동시간대 중복 수업 금지 (Hard)
 */
export class TeacherNoOverlapConstraint extends BaseConstraint {
  id = 'teacher_no_overlap';
  name = '교사 동시간대 중복 수업 금지';
  type = 'hard' as const;
  priority = 10;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.teacherId) return this.success();

    // 같은 교사가 같은 시간에 다른 반에서 수업하는지 확인
    for (const classId of Object.keys(timetable)) {
      if (classId === slot.classId) continue;

      const existingSlot = this.getSlot(timetable, classId, slot.day, slot.period);
      if (!this.isSlotEmpty(existingSlot) && existingSlot!.teacherId === slot.teacherId) {
        const teacher = data.teachers.find(t => t.id === slot.teacherId);
        const conflictingClass = data.classes.find(c => c.id === classId);
        return this.failure(
          `${teacher?.name || slot.teacherId} 교사가 ${slot.day}요일 ${slot.period}교시에 이미 ${conflictingClass?.name || classId}에서 수업 중입니다.`,
          {
            teacherId: slot.teacherId,
            teacherName: teacher?.name,
            conflictingClassId: classId,
            conflictingClassName: conflictingClass?.name,
            day: slot.day,
            period: slot.period,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    const teacherSlots: Record<string, Array<{ classId: string; day: string; period: number }>> = {};

    // 모든 교사의 배정된 시간 수집
    for (const classId of Object.keys(timetable)) {
      const classSchedule = timetable[classId];
      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (this.isSlotEmpty(slot) || !slot.teacherId) continue;

          const key = `${slot.teacherId}_${day}_${period}`;
          if (!teacherSlots[key]) {
            teacherSlots[key] = [];
          }
          teacherSlots[key].push({ classId, day, period });
        }
      }
    }

    // 중복 확인
    for (const [key, slots] of Object.entries(teacherSlots)) {
      if (slots.length > 1) {
        const [teacherId, day, period] = key.split('_');
        const teacher = data.teachers.find(t => t.id === teacherId);
        const classNames = slots.map(s => data.classes.find(c => c.id === s.classId)?.name || s.classId).join(', ');

        violations.push(this.failure(
          `${teacher?.name || teacherId} 교사가 ${day}요일 ${period}교시에 ${slots.length}개 반(${classNames})에서 중복 수업`,
          {
            teacherId,
            teacherName: teacher?.name,
            day,
            period: parseInt(period),
            conflictingClasses: slots.map(s => s.classId),
          }
        ));
      }
    }

    return violations;
  }
}

/**
 * 교사 금지 시간대 (Hard)
 */
export class TeacherUnavailableTimeConstraint extends BaseConstraint {
  id = 'teacher_unavailable_time';
  name = '교사 금지 시간대';
  type = 'hard' as const;
  priority = 10;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.teacherId) return this.success();

    const teacher = data.teachers.find(t => t.id === slot.teacherId);
    if (!teacher) return this.failure(`교사를 찾을 수 없습니다: ${slot.teacherId}`);

    const isUnavailable = teacher.unavailableSlots.some(
      unavailable => unavailable.day === slot.day && unavailable.period === slot.period
    );

    if (isUnavailable) {
      return this.failure(
        `${teacher.name} 교사는 ${slot.day}요일 ${slot.period}교시에 수업할 수 없습니다. (금지 시간대)`,
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          period: slot.period,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const teacher of data.teachers) {
      for (const classId of Object.keys(timetable)) {
        const classSchedule = timetable[classId];
        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = data.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (this.isSlotEmpty(slot) || slot.teacherId !== teacher.id) continue;

            const isUnavailable = teacher.unavailableSlots.some(
              unavailable => unavailable.day === day && unavailable.period === period
            );

            if (isUnavailable) {
              const classItem = data.classes.find(c => c.id === classId);
              violations.push(this.failure(
                `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${classItem?.name || classId}에서 수업 중 (금지 시간대)`,
                {
                  teacherId: teacher.id,
                  teacherName: teacher.name,
                  classId,
                  className: classItem?.name,
                  day,
                  period,
                }
              ));
            }
          }
        }
      }
    }

    return violations;
  }
}

/**
 * 교사 연속 3교시 이상 금지 (Hard)
 */
export class TeacherMaxConsecutivePeriodsConstraint extends BaseConstraint {
  id = 'teacher_max_consecutive';
  name = '교사 연속 수업 제한';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.teacherId || !slot.classId) return this.success();

    const teacher = data.teachers.find(t => t.id === slot.teacherId);
    const maxConsecutive = teacher?.maxConsecutivePeriods || 3;

    // 같은 교사가 같은 반에서 같은 날에 연속으로 몇 교시 수업하는지 확인
    const consecutiveCount = this.countConsecutivePeriods(
      timetable,
      slot.teacherId,
      slot.classId,
      slot.day,
      slot.period
    );

    if (consecutiveCount >= maxConsecutive) {
      const classItem = data.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${teacher?.name || slot.teacherId} 교사가 ${classItem?.name || slot.classId}에서 ${slot.day}요일에 연속 ${consecutiveCount + 1}교시 수업하게 됩니다. (최대 ${maxConsecutive}교시)`,
        {
          teacherId: slot.teacherId,
          teacherName: teacher?.name,
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          consecutiveCount: consecutiveCount + 1,
          maxConsecutive,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const teacher of data.teachers) {
      const maxConsecutive = teacher.maxConsecutivePeriods || 3;

      for (const classId of Object.keys(timetable)) {
        const classSchedule = timetable[classId];
        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = data.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;
          let startPeriod = 1;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = !this.isSlotEmpty(slot) && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount > maxConsecutive) {
                const classItem = data.classes.find(c => c.id === classId);
                violations.push(this.failure(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`,
                  {
                    teacherId: teacher.id,
                    teacherName: teacher.name,
                    classId,
                    className: classItem?.name,
                    day,
                    startPeriod,
                    consecutiveCount,
                    maxConsecutive,
                  }
                ));
              }
              consecutiveCount = 0;
              startPeriod = period + 1;
            }
          }

          // 마지막까지 연속인 경우
          if (consecutiveCount > maxConsecutive) {
            const classItem = data.classes.find(c => c.id === classId);
            violations.push(this.failure(
              `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`,
              {
                teacherId: teacher.id,
                teacherName: teacher.name,
                classId,
                className: classItem?.name,
                day,
                startPeriod,
                consecutiveCount,
                maxConsecutive,
              }
            ));
          }
        }
      }
    }

    return violations;
  }

  private countConsecutivePeriods(
    timetable: any,
    teacherId: string,
    classId: string,
    day: string,
    period: number
  ): number {
    const classSchedule = timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = 10; // 최대 교시 수

    // 앞쪽 연속 교시 확인
    for (let p = period - 1; p >= 1; p--) {
      const slot = daySchedule[p];
      if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    // 뒤쪽 연속 교시 확인
    for (let p = period + 1; p <= maxPeriod; p++) {
      const slot = daySchedule[p];
      if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }
}

/**
 * 점심 전 과도한 배치 방지 (Hard)
 */
export class TeacherLunchBeforeOverloadConstraint extends BaseConstraint {
  id = 'teacher_lunch_before_overload';
  name = '점심 전 과도한 배치 방지';
  type = 'hard' as const;
  priority = 8;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.teacherId || slot.period > data.schoolConfig.lunchPeriod) {
      return this.success();
    }

    const teacher = data.teachers.find(t => t.id === slot.teacherId);
    if (!teacher) return this.success();

    const maxBeforeLunch = teacher.maxBeforeLunch || 2;
    const beforeLunchCount = this.countBeforeLunch(timetable, slot.teacherId, slot.day, data.schoolConfig.lunchPeriod);

    if (beforeLunchCount >= maxBeforeLunch) {
      return this.failure(
        `${teacher.name} 교사가 ${slot.day}요일 점심 전(${data.schoolConfig.lunchPeriod}교시까지)에 이미 ${beforeLunchCount}교시 수업 중입니다. (최대 ${maxBeforeLunch}교시)`,
        {
          teacherId: teacher.id,
          teacherName: teacher.name,
          day: slot.day,
          currentCount: beforeLunchCount,
          maxCount: maxBeforeLunch,
          lunchPeriod: data.schoolConfig.lunchPeriod,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    const lunchPeriod = data.schoolConfig.lunchPeriod;

    for (const teacher of data.teachers) {
      const maxBeforeLunch = teacher.maxBeforeLunch || 2;

      for (const day of data.schoolConfig.days) {
        const beforeLunchCount = this.countBeforeLunch(timetable, teacher.id, day, lunchPeriod);

        if (beforeLunchCount > maxBeforeLunch) {
          violations.push(this.failure(
            `${teacher.name} 교사가 ${day}요일 점심 전(${lunchPeriod}교시까지)에 ${beforeLunchCount}교시 수업 (최대 ${maxBeforeLunch}교시)`,
            {
              teacherId: teacher.id,
              teacherName: teacher.name,
              day,
              currentCount: beforeLunchCount,
              maxCount: maxBeforeLunch,
              lunchPeriod,
            }
          ));
        }
      }
    }

    return violations;
  }

  private countBeforeLunch(timetable: any, teacherId: string, day: string, lunchPeriod: number): number {
    let count = 0;

    for (const classId of Object.keys(timetable)) {
      const classSchedule = timetable[classId];
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      for (let period = 1; period <= lunchPeriod; period++) {
        const slot = daySchedule[period];
        if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
          count++;
        }
      }
    }

    return count;
  }
}
