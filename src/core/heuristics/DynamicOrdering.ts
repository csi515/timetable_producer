// Dynamic Ordering (동적 순서 조정)

import { HeuristicStrategy, Variable, Value, TimetableState } from './types';
import { TimetableData } from '../constraints/types';
import { MRVHeuristic } from './MRV';
import { DegreeHeuristic } from './Degree';

export class DynamicOrderingHeuristic implements HeuristicStrategy {
  name = 'Dynamic Ordering';

  private mrvHeuristic: MRVHeuristic;
  private degreeHeuristic: DegreeHeuristic;

  constructor() {
    this.mrvHeuristic = new MRVHeuristic();
    this.degreeHeuristic = new DegreeHeuristic();
  }

  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    // 도메인 크기 재계산
    this.recalculateDomainSizes(state);

    // MRV와 Degree를 결합하여 선택
    const mrvVariable = this.mrvHeuristic.pickNextVariable(timetable, state);
    const degreeVariable = this.degreeHeuristic.pickNextVariable(timetable, state);

    // 도메인 크기가 같으면 Degree 우선
    if (mrvVariable && degreeVariable) {
      const mrvKey = this.getVariableKey(mrvVariable);
      const degreeKey = this.getVariableKey(degreeVariable);
      const mrvDomain = state.domains.get(mrvKey);
      const degreeDomain = state.domains.get(degreeKey);

      if (mrvDomain && degreeDomain) {
        if (mrvDomain.values.length === degreeDomain.values.length) {
          return degreeVariable; // 충돌 가능성이 높은 것 우선
        }
      }
    }

    return mrvVariable || degreeVariable || state.unassigned[0] || null;
  }

  orderDomainValues(variable: Variable, timetable: TimetableData, state: TimetableState): Value[] {
    const key = this.getVariableKey(variable);
    const domain = state.domains.get(key);

    if (!domain) {
      return [];
    }

    // 연강 필요 과목인 경우 연속 가능한 값 우선
    const subject = timetable.subjects.find(s => s.id === variable.subjectId);
    if (subject?.requiresConsecutive) {
      return this.orderForConsecutive(domain.values, state, variable);
    }

    return domain.values;
  }

  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    // 도메인 크기의 합이 클수록 좋음
    let totalDomainSize = 0;

    for (const domain of state.domains.values()) {
      totalDomainSize += domain.values.length;
    }

    return totalDomainSize;
  }

  /**
   * 도메인 크기 재계산
   */
  private recalculateDomainSizes(state: TimetableState): void {
    // 실제로는 Forward Checking에서 이미 계산되지만,
    // 여기서는 추가 검증이나 최적화 수행 가능
    for (const [key, domain] of state.domains.entries()) {
      // 빈 도메인 확인
      if (domain.values.length === 0) {
        // 로깅 또는 추가 처리
      }
    }
  }

  /**
   * 연강을 위한 값 정렬
   */
  private orderForConsecutive(
    values: Value[],
    state: TimetableState,
    variable: Variable
  ): Value[] {
    const consecutivePairs: Value[] = [];
    const singles: Value[] = [];

    for (const value of values) {
      // 인접한 교시가 도메인에 있는지 확인
      const hasConsecutive = values.some(
        v =>
          v.day === value.day &&
          Math.abs(v.period - value.period) === 1
      );

      if (hasConsecutive) {
        consecutivePairs.push(value);
      } else {
        singles.push(value);
      }
    }

    // 연속 가능한 값 우선
    return [...consecutivePairs, ...singles];
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
