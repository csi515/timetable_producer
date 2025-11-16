// Forward Checking (제약조건 전파)

import { ForwardCheckingResult, Variable, Value, TimetableState, Domain } from './types';
import { TimetableData, Slot } from '../constraints/types';
import { ConstraintEngine } from '../constraints/ConstraintEngine';

export class ForwardChecking {
  constructor(private constraintEngine: ConstraintEngine) {}

  /**
   * 슬롯 배정 후 다른 변수들의 도메인에서 불가능한 값 제거
   */
  propagate(
    assignment: Slot,
    timetable: TimetableData,
    state: TimetableState
  ): ForwardCheckingResult {
    const updatedDomains = new Map(state.domains);
    const prunedValues: Array<{ variable: Variable; value: Value }> = [];

    // 모든 미배정 변수에 대해 도메인 축소
    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = updatedDomains.get(key);

      if (!domain) continue;

      const remainingValues: Value[] = [];

      for (const value of domain.values) {
        // 임시 슬롯 생성
        const tempSlot: Slot = {
          classId: variable.classId,
          day: value.day,
          period: value.period,
          subjectId: variable.subjectId,
          teacherId: variable.teacherId,
        };

        // 임시 시간표에 배정 추가
        const tempTimetable = this.createTempTimetable(timetable, assignment);

        // 제약조건 검사
        const result = this.constraintEngine.evaluate(tempSlot);

        if (result.satisfied) {
          remainingValues.push(value);
        } else {
          prunedValues.push({ variable, value });
        }
      }

      // 도메인 업데이트
      updatedDomains.set(key, {
        variable,
        values: remainingValues,
      });
    }

    return {
      updatedDomains,
      prunedValues,
    };
  }

  /**
   * 도메인이 비어있는 변수가 있는지 확인 (실패 상태 감지)
   */
  hasEmptyDomain(state: TimetableState): boolean {
    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = state.domains.get(key);

      if (!domain || domain.values.length === 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * 임시 시간표 생성 (기존 + 새 배정)
   */
  private createTempTimetable(timetable: TimetableData, newAssignment: Slot): TimetableData {
    const tempTimetable = JSON.parse(JSON.stringify(timetable)) as TimetableData;

    const classSchedule = tempTimetable.timetable[newAssignment.classId];
    if (!classSchedule) {
      tempTimetable.timetable[newAssignment.classId] = {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      };
    }

    const daySchedule = tempTimetable.timetable[newAssignment.classId][newAssignment.day];
    if (!daySchedule) {
      tempTimetable.timetable[newAssignment.classId][newAssignment.day] = {};
    }

    tempTimetable.timetable[newAssignment.classId][newAssignment.day][newAssignment.period] = newAssignment;

    return tempTimetable;
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
