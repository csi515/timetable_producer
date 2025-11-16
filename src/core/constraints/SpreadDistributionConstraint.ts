// 고르게 분포 제약조건

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export interface SpreadDistributionConfig {
  minDaysBetween: number; // 같은 과목 간 최소 요일 간격 (기본 1)
  preferredSpread: 'even' | 'balanced'; // 분포 방식
}

export class SpreadDistributionConstraint extends BaseConstraint {
  metadata: ConstraintMetadata = {
    id: 'spread_distribution',
    name: '고르게 분포',
    description: '각 반에 모든 과목이 주간에 고르게 분포되도록 합니다.',
    priority: 'low',
    category: 'distribution',
  };

  private config: SpreadDistributionConfig;

  constructor(config?: Partial<SpreadDistributionConfig>) {
    super();
    this.config = {
      minDaysBetween: config?.minDaysBetween || 1,
      preferredSpread: config?.preferredSpread || 'even',
    };
  }

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    if (!slot.subjectId || !slot.classId) {
      return this.success();
    }

    // 같은 반에서 같은 과목이 이미 배정된 요일들 확인
    const assignedDays = this.getAssignedDaysForSubject(timetable, slot.classId, slot.subjectId);

    if (assignedDays.length > 0) {
      // 최근 배정된 날짜와의 간격 확인
      const days = timetable.schoolSchedule.days;
      const currentDayIndex = days.indexOf(slot.day);
      const lastAssignedIndex = Math.max(...assignedDays.map(d => days.indexOf(d)));

      const daysBetween = Math.abs(currentDayIndex - lastAssignedIndex);

      if (daysBetween < this.config.minDaysBetween) {
        const subject = timetable.subjects.find(s => s.id === slot.subjectId);
        const classItem = timetable.classes.find(c => c.id === slot.classId);

        return this.failure(
          `${classItem?.name || slot.classId}의 ${subject?.name || slot.subjectId} 과목이 너무 가까운 요일에 배정됩니다. (최소 ${this.config.minDaysBetween}일 간격 권장)`,
          'warning',
          {
            classId: slot.classId,
            className: classItem?.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name,
            day: slot.day,
            daysBetween,
            minDaysBetween: this.config.minDaysBetween,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    const violations: string[] = [];

    for (const classItem of timetable.classes) {
      for (const subject of timetable.subjects) {
        const assignedDays = this.getAssignedDaysForSubject(timetable, classItem.id, subject.id);

        if (assignedDays.length < 2) continue;

        // 요일 간격 확인
        const days = timetable.schoolSchedule.days;
        const sortedIndices = assignedDays.map(d => days.indexOf(d)).sort((a, b) => a - b);

        for (let i = 0; i < sortedIndices.length - 1; i++) {
          const daysBetween = sortedIndices[i + 1] - sortedIndices[i];
          if (daysBetween < this.config.minDaysBetween) {
            violations.push(
              `${classItem.name}의 ${subject.name} 과목이 ${days[sortedIndices[i]]}요일과 ${days[sortedIndices[i + 1]]}요일에 너무 가깝게 배정됨`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      return this.failure(
        `분포 불균형 ${violations.length}건 발견`,
        'warning',
        { violations }
      );
    }

    return this.success();
  }

  private getAssignedDaysForSubject(timetable: TimetableData, classId: string, subjectId: string): string[] {
    const assignedDays: string[] = [];
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return assignedDays;

    for (const day of timetable.schoolSchedule.days) {
      const daySchedule = classSchedule[day as keyof typeof classSchedule];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
      for (let period = 1; period <= maxPeriod; period++) {
        const slot = daySchedule[period];
        if (slot && slot.subjectId === subjectId) {
          if (!assignedDays.includes(day)) {
            assignedDays.push(day);
          }
          break; // 하루에 하나만 카운트
        }
      }
    }

    return assignedDays;
  }
}
