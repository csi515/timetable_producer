// 교사 연속수업 제한 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export interface MaxConsecutivePeriodsConfig {
  maxConsecutive: number; // 최대 연속 교시 수 (기본 3)
}

export class MaxConsecutivePeriodsConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'max_consecutive_periods',
    name: '교사 연속수업 제한',
    description: '교사가 연속으로 3교시 이상 수업하는 것을 방지합니다.',
    priority: 'high',
    category: 'teacher',
  };

  private config: MaxConsecutivePeriodsConfig;

  constructor(config: MaxConsecutivePeriodsConfig = { maxConsecutive: 3 }) {
    super();
    this.config = config;
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.teacherId || !slot.classId) {
      return this.success();
    }

    // 같은 교사가 같은 반에서 같은 날에 연속으로 몇 교시 수업하는지 확인
    const consecutiveCount = this.countConsecutivePeriods(
      timetable,
      slot.teacherId,
      slot.classId,
      slot.day,
      slot.period
    );

    if (consecutiveCount >= this.config.maxConsecutive) {
      const teacher = timetable.teachers.find(t => t.id === slot.teacherId);
      const classItem = timetable.classes.find(c => c.id === slot.classId);

      return this.failure(
        `${teacher?.name || slot.teacherId} 교사가 ${classItem?.name || slot.classId}에서 ${slot.day}요일에 연속 ${consecutiveCount + 1}교시 수업하게 됩니다. (최대 ${this.config.maxConsecutive}교시)`,
        'warning',
        {
          teacherId: slot.teacherId,
          teacherName: teacher?.name,
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          consecutiveCount: consecutiveCount + 1,
          maxConsecutive: this.config.maxConsecutive,
        }
      );
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day];
          let consecutiveCount = 0;
          let startPeriod = 1;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount >= this.config.maxConsecutive) {
                const classItem = timetable.classes.find(c => c.id === classId);
                violations.push(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`
                );
              }
              consecutiveCount = 0;
              startPeriod = period + 1;
            }
          }

          // 마지막 교시까지 연속인 경우
          if (consecutiveCount >= this.config.maxConsecutive) {
            const classItem = timetable.classes.find(c => c.id === classId);
            violations.push(
              `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일 ${startPeriod}-${startPeriod + consecutiveCount - 1}교시에 연속 ${consecutiveCount}교시 수업`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `연속수업 제한 위반 ${violations.length}건 발견`,
        'warning',
        { violations }
      );
    }

    return this.success();
  }

  private countConsecutivePeriods(
    timetable: TimetableData,
    teacherId: string,
    classId: string,
    day: string,
    period: number
  ): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];

    // 앞쪽 연속 교시 확인
    for (let p = period - 1; p >= 1; p--) {
      const slot = daySchedule[p];
      if (slot && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    // 뒤쪽 연속 교시 확인
    for (let p = period + 1; p <= maxPeriod; p++) {
      const slot = daySchedule[p];
      if (slot && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }
}
