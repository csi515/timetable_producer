// Minimum Remaining Value (MRV) 휴리스틱

import { HeuristicStrategy, Variable, Value, TimetableState, Domain } from './types';
import { TimetableData } from '../constraints/types';

export class MRVHeuristic implements HeuristicStrategy {
  name = 'MRV (Minimum Remaining Values)';

  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    if (state.unassigned.length === 0) {
      return null;
    }

    // 도메인 크기가 가장 작은 변수 선택
    let minDomainSize = Infinity;
    let selectedVariable: Variable | null = null;

    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = state.domains.get(key);

      if (!domain || domain.values.length === 0) {
        // 도메인이 비어있으면 즉시 반환 (실패 상태)
        return variable;
      }

      const domainSize = domain.values.length;

      if (domainSize < minDomainSize) {
        minDomainSize = domainSize;
        selectedVariable = variable;
      }
    }

    return selectedVariable || state.unassigned[0];
  }

  orderDomainValues(variable: Variable, timetable: TimetableData, state: TimetableState): Value[] {
    const key = this.getVariableKey(variable);
    const domain = state.domains.get(key);

    if (!domain) {
      return [];
    }

    // 기본적으로 도메인 값 그대로 반환
    // 필요시 추가 정렬 로직 구현 가능
    return domain.values;
  }

  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    // MRV는 변수 선택에만 사용되므로 점수 계산 불필요
    return 0;
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
