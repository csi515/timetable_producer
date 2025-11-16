// 제약조건 기본 클래스 및 인터페이스

import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';

export interface IConstraint {
  /**
   * 제약조건 메타데이터
   */
  metadata: ConstraintMetadata;

  /**
   * 단일 슬롯 배치 전 검사
   * @param slot 배치하려는 슬롯
   * @param timetable 현재 시간표 상태
   * @returns 제약조건 만족 여부 및 평가 결과
   */
  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 전체 시간표 검증
   * @param timetable 전체 시간표
   * @returns 제약조건 만족 여부 및 평가 결과
   */
  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;
}

export abstract class BaseConstraint implements IConstraint {
  abstract metadata: ConstraintMetadata;

  abstract checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  abstract validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 슬롯이 비어있는지 확인
   */
  protected isEmptySlot(slot: Slot): boolean {
    return !slot.subjectId || !slot.teacherId;
  }

  /**
   * 시간표에서 특정 슬롯 가져오기
   */
  protected getSlot(timetable: TimetableData, classId: string, day: string, period: number): Slot | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day as keyof typeof classSchedule];
    if (!daySchedule) return null;

    return daySchedule[period] || null;
  }

  /**
   * 특정 교사가 특정 시간에 배정되어 있는지 확인
   */
  protected isTeacherAssignedAt(timetable: TimetableData, teacherId: string, day: string, period: number, excludeClassId?: string): boolean {
    for (const classId of Object.keys(timetable.timetable)) {
      if (excludeClassId && classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && slot.teacherId === teacherId) {
        return true;
      }
    }
    return false;
  }

  /**
   * 특정 반이 특정 시간에 수업이 있는지 확인
   */
  protected isClassOccupiedAt(timetable: TimetableData, classId: string, day: string, period: number): boolean {
    const slot = this.getSlot(timetable, classId, day, period);
    return slot !== null && !this.isEmptySlot(slot);
  }

  /**
   * 성공 결과 생성 헬퍼
   */
  protected success(): ConstraintEvaluationResult {
    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'error',
    };
  }

  /**
   * 실패 결과 생성 헬퍼
   */
  protected failure(reason: string, severity: 'error' | 'warning' = 'error', details?: Record<string, any>): ConstraintEvaluationResult {
    return {
      satisfied: false,
      reason,
      violatedConstraints: [this.metadata.id],
      severity,
      details,
    };
  }
}
