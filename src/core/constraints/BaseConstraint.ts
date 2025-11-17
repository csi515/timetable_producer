// 제약조건 기본 클래스 및 인터페이스

import {
  Slot,
  TimetableData,
  ConstraintEvaluationResult,
  ConstraintMetadata,
  PropagationResult,
} from './types';

export interface IConstraint {
  /**
   * 제약조건 메타데이터
   */
  readonly metadata: ConstraintMetadata;

  /**
   * 슬롯 배치 전 검사 (하드 제약조건)
   * @param slot 배치하려는 슬롯
   * @param timetable 현재 시간표 상태
   * @returns 제약조건 만족 여부
   */
  checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  /**
   * 소프트 제약조건 점수 계산
   * @param slot 배치하려는 슬롯
   * @param timetable 현재 시간표 상태
   * @returns 점수 (낮을수록 좋음, 0이면 완벽)
   */
  checkSoftConstraint?(slot: Slot, timetable: TimetableData): number;

  /**
   * 제약조건 전파 (Forward Checking)
   * @param slot 배치된 슬롯
   * @param timetable 현재 시간표 상태
   * @param domains 현재 도메인 맵
   * @returns 전파 결과
   */
  propagate?(slot: Slot, timetable: TimetableData, domains: Map<string, TimeSlot[]>): PropagationResult;

  /**
   * 전체 시간표 검증
   * @param timetable 전체 시간표
   * @returns 검증 결과
   */
  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;
}

export abstract class BaseConstraint implements IConstraint {
  abstract readonly metadata: ConstraintMetadata;

  abstract checkHardConstraint(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult;

  abstract validateTimetable(timetable: TimetableData): ConstraintEvaluationResult;

  // 소프트 제약조건은 선택적 구현
  checkSoftConstraint?(slot: Slot, timetable: TimetableData): number {
    return 0;
  }

  // 제약조건 전파는 선택적 구현
  propagate?(slot: Slot, timetable: TimetableData, domains: Map<string, TimeSlot[]>): PropagationResult {
    return {
      domains: new Map(domains),
      prunedValues: [],
      hasEmptyDomain: false,
    };
  }

  // ========== 유틸리티 메서드 ==========

  /**
   * 성공 결과 생성
   */
  protected success(): ConstraintEvaluationResult {
    return {
      satisfied: true,
      violatedConstraints: [],
      severity: 'hard',
    };
  }

  /**
   * 하드 제약조건 위반 결과 생성
   */
  protected hardViolation(reason: string, details?: Record<string, any>): ConstraintEvaluationResult {
    return {
      satisfied: false,
      reason,
      violatedConstraints: [this.metadata.id],
      severity: 'hard',
      details,
    };
  }

  /**
   * 소프트 제약조건 위반 결과 생성
   */
  protected softViolation(reason: string, score: number, details?: Record<string, any>): ConstraintEvaluationResult {
    return {
      satisfied: true, // 소프트 제약조건은 위반해도 배치는 가능
      reason,
      violatedConstraints: [this.metadata.id],
      severity: 'soft',
      score,
      details,
    };
  }

  /**
   * 시간표에서 특정 슬롯 가져오기
   */
  protected getSlot(timetable: TimetableData, classId: string, day: Day, period: number): Slot | null {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return null;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return null;

    return daySchedule[period] || null;
  }

  /**
   * 슬롯이 비어있는지 확인
   */
  protected isEmptySlot(slot: Slot | null): boolean {
    return !slot || !slot.subjectId || !slot.teacherId;
  }

  /**
   * 특정 교사가 특정 시간에 배정되어 있는지 확인
   */
  protected isTeacherAssignedAt(
    timetable: TimetableData,
    teacherId: string,
    day: Day,
    period: number,
    excludeClassId?: string
  ): boolean {
    for (const classId of Object.keys(timetable.timetable)) {
      if (excludeClassId && classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && slot.teacherId === teacherId) {
        return true;
      }

      // 코티칭 교사도 확인
      if (slot && slot.coTeachers?.includes(teacherId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 특정 반이 특정 시간에 수업이 있는지 확인
   */
  protected isClassOccupiedAt(timetable: TimetableData, classId: string, day: Day, period: number): boolean {
    const slot = this.getSlot(timetable, classId, day, period);
    return !this.isEmptySlot(slot);
  }

  /**
   * 특정 교실이 특정 시간에 사용 중인지 확인
   */
  protected isRoomOccupiedAt(
    timetable: TimetableData,
    roomId: string,
    day: Day,
    period: number,
    excludeClassId?: string
  ): boolean {
    for (const classId of Object.keys(timetable.timetable)) {
      if (excludeClassId && classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (slot && slot.roomId === roomId) {
        return true;
      }
    }
    return false;
  }

  /**
   * 교사가 특정 날에 배정된 수업 수 계산
   */
  protected countDailyLessons(timetable: TimetableData, teacherId: string, day: Day): number {
    let count = 0;
    for (const classId of Object.keys(timetable.timetable)) {
      const classSchedule = timetable.timetable[classId];
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
      for (let period = 1; period <= maxPeriod; period++) {
        const slot = daySchedule[period];
        if (slot && (slot.teacherId === teacherId || slot.coTeachers?.includes(teacherId))) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * 반이 특정 날에 특정 과목이 배정된 횟수 계산
   */
  protected countDailySubjectLessons(
    timetable: TimetableData,
    classId: string,
    subjectId: string,
    day: Day
  ): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
    for (let period = 1; period <= maxPeriod; period++) {
      const slot = daySchedule[period];
      if (slot && slot.subjectId === subjectId) {
        count++;
      }
    }
    return count;
  }

  /**
   * 교사가 특정 날에 연속으로 배정된 교시 수 계산
   */
  protected countConsecutivePeriods(
    timetable: TimetableData,
    teacherId: string,
    classId: string,
    day: Day,
    period: number
  ): number {
    const classSchedule = timetable.timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return 0;

    let count = 0;
    const maxPeriod = timetable.schoolConfig.periodsPerDay[day];

    // 앞쪽 연속 교시 확인
    for (let p = period - 1; p >= 1; p--) {
      const slot = daySchedule[p];
      if (slot && (slot.teacherId === teacherId || slot.coTeachers?.includes(teacherId))) {
        count++;
      } else {
        break;
      }
    }

    // 뒤쪽 연속 교시 확인
    for (let p = period + 1; p <= maxPeriod; p++) {
      const slot = daySchedule[p];
      if (slot && (slot.teacherId === teacherId || slot.coTeachers?.includes(teacherId))) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * 안전한 데이터 접근 (에러 방지)
   */
  protected safeGet<T>(fn: () => T, defaultValue: T): T {
    try {
      return fn();
    } catch (error) {
      console.warn(`제약조건 평가 중 오류 발생 (${this.metadata.id}):`, error);
      return defaultValue;
    }
  }
}
