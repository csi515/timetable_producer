// 제약조건 기본 클래스

import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

export interface IConstraint {
  /**
   * 제약조건 ID
   */
  id: string;

  /**
   * 제약조건 이름
   */
  name: string;

  /**
   * 제약조건 타입 (hard/soft)
   */
  type: 'hard' | 'soft';

  /**
   * 제약조건 우선순위 (1-10, 높을수록 중요)
   */
  priority: number;

  /**
   * 슬롯 배치 전 검사
   */
  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult;

  /**
   * 전체 시간표 검증
   */
  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[];
}

export abstract class BaseConstraint implements IConstraint {
  abstract id: string;
  abstract name: string;
  abstract type: 'hard' | 'soft';
  abstract priority: number;

  abstract checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult;
  abstract validateTimetable(data: TimetableData, timetable: any): ConstraintResult[];

  protected success(): ConstraintResult {
    return {
      satisfied: true,
      severity: this.type,
      message: '',
    };
  }

  protected failure(message: string, details?: Record<string, any>, penalty?: number): ConstraintResult {
    return {
      satisfied: false,
      severity: this.type,
      message,
      details,
      penalty: penalty || (this.type === 'soft' ? 1 : 0),
    };
  }

  protected getSlot(timetable: any, classId: string, day: string, period: number): TimetableSlot | null {
    const classSchedule = timetable[classId];
    if (!classSchedule) return null;
    const daySchedule = classSchedule[day];
    if (!daySchedule) return null;
    return daySchedule[period] || null;
  }

  protected isSlotEmpty(slot: TimetableSlot | null): boolean {
    return !slot || !slot.subjectId || !slot.teacherId;
  }
}
