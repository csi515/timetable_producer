// 제약조건 기본 클래스

import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from '../types';

export interface IConstraint {
  metadata: ConstraintMetadata;
  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;
  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;
  calculateSoftScore?(timetable: TimetableData): number; // 소프트 제약조건 점수 계산
}

export abstract class BaseConstraint implements IConstraint {
  abstract metadata: ConstraintMetadata;

  abstract checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  abstract validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;

  calculateSoftScore?(timetable: TimetableData): number {
    return 0;
  }

  protected isEmptySlot(slot: Slot): boolean {
    return !slot.subjectId || !slot.teacherId;
  }

  protected getSlot(timetable: TimetableData, classId: string, day: string, period: number): Slot | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return null;

    return daySchedule[period] || null;
  }

  protected isTeacherAssignedAt(
    timetable: TimetableData,
    teacherId: string,
    day: string,
    period: number,
    excludeClassId?: string
  ): boolean {
    for (const classId of Object.keys(timetable.timetable)) {
      if (excludeClassId && classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && slot.teacherId === teacherId) {
        return true;
      }
      // 공동수업 교사도 확인
      if (slot && slot.coTeachers && slot.coTeachers.includes(teacherId)) {
        return true;
      }
    }
    return false;
  }

  protected isClassOccupiedAt(timetable: TimetableData, classId: string, day: string, period: number): boolean {
    const slot = this.getSlot(timetable, classId, day, period);
    return slot !== null && !this.isEmptySlot(slot);
  }

  protected success(score?: number): ConstraintEvaluationResult {
    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'error',
      score,
    };
  }

  protected failure(
    reason: string,
    severity: 'error' | 'warning' = 'error',
    details?: Record<string, any>
  ): ConstraintEvaluationResult {
    return {
      satisfied: false,
      reason,
      violatedConstraints: [this.metadata.id],
      severity,
      details,
    };
  }
}
