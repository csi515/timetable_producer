// 제약조건 기본 클래스 및 인터페이스

import { Slot, TimetableData, ConstraintEvaluationResult, ConstraintMetadata } from './types';
import { getSlot, isEmptySlot } from './utils';

export interface IConstraint {
  /**
   * 제약조건 메타데이터
   */
  readonly metadata: ConstraintMetadata;

  /**
   * 단일 슬롯 배치 전 검사 (하드 제약조건)
   * @param slot 배치하려는 슬롯
   * @param timetable 현재 시간표 상태
   * @returns 제약조건 만족 여부 및 평가 결과
   */
  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 전체 시간표 검증 (하드 제약조건)
   * @param timetable 전체 시간표
   * @returns 제약조건 만족 여부 및 평가 결과
   */
  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 소프트 제약조건 점수 계산 (선택적)
   * @param timetable 전체 시간표
   * @returns 점수 (낮을수록 좋음, 0이면 완벽)
   */
  calculateSoftScore?(timetable: TimetableData): number;
}

export abstract class BaseConstraint implements IConstraint {
  abstract readonly metadata: ConstraintMetadata;

  abstract checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  abstract validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 성공 결과 생성 헬퍼
   */
  protected success(score?: number): ConstraintEvaluationResult {
    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'error',
      score,
    };
  }

  /**
   * 실패 결과 생성 헬퍼
   */
  protected failure(
    reason: string,
    severity: 'error' | 'warning' = 'error',
    details?: Record<string, any>,
    score?: number
  ): ConstraintEvaluationResult {
    return {
      satisfied: false,
      reason,
      violatedConstraints: [this.metadata.id],
      severity,
      details,
      score,
    };
  }

  /**
   * 시간표에서 특정 슬롯 가져오기 (유틸리티 래퍼)
   */
  protected getSlot(timetable: TimetableData, classId: string, day: string, period: number): Slot | null {
    return getSlot(timetable, classId, day as any, period);
  }

  /**
   * 슬롯이 비어있는지 확인 (유틸리티 래퍼)
   */
  protected isEmptySlot(slot: Slot | null): boolean {
    return isEmptySlot(slot);
  }

  /**
   * 데이터 검증 헬퍼
   */
  protected validateData(timetable: TimetableData): { valid: boolean; error?: string } {
    if (!timetable.classes || timetable.classes.length === 0) {
      return { valid: false, error: '학급 정보가 없습니다.' };
    }
    if (!timetable.subjects || timetable.subjects.length === 0) {
      return { valid: false, error: '과목 정보가 없습니다.' };
    }
    if (!timetable.teachers || timetable.teachers.length === 0) {
      return { valid: false, error: '교사 정보가 없습니다.' };
    }
    if (!timetable.schoolSchedule) {
      return { valid: false, error: '학교 일정 정보가 없습니다.' };
    }
    return { valid: true };
  }

  /**
   * 교사 찾기 헬퍼
   */
  protected findTeacher(timetable: TimetableData, teacherId: string | null) {
    if (!teacherId) return null;
    return timetable.teachers.find(t => t.id === teacherId) || null;
  }

  /**
   * 과목 찾기 헬퍼
   */
  protected findSubject(timetable: TimetableData, subjectId: string | null) {
    if (!subjectId) return null;
    return timetable.subjects.find(s => s.id === subjectId) || null;
  }

  /**
   * 학급 찾기 헬퍼
   */
  protected findClass(timetable: TimetableData, classId: string) {
    return timetable.classes.find(c => c.id === classId) || null;
  }
}
