// Least Constraining Value (LCV) 휴리스틱

import { HeuristicStrategy, Variable, Value, TimetableState } from './types';
import { TimetableData } from '../constraints/types';
import { ConstraintEngine } from '../constraints/ConstraintEngine';

export class LCVHeuristic implements HeuristicStrategy {
  name = 'LCV (Least Constraining Value)';

  constructor(private constraintEngine: ConstraintEngine) {}

  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    // MRV와 동일한 로직 사용
    if (state.unassigned.length === 0) {
      return null;
    }

    let minDomainSize = Infinity;
    let selectedVariable: Variable | null = null;

    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = state.domains.get(key);

      if (!domain || domain.values.length === 0) {
        return variable;
      }

      if (domain.values.length < minDomainSize) {
        minDomainSize = domain.values.length;
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

    // 각 값이 다른 변수들의 도메인에 미치는 영향을 계산
    const valuesWithImpact = domain.values.map(value => {
      const impact = this.calculateImpact(variable, value, timetable, state);
      return { value, impact };
    });

    // 영향이 작은 값부터 정렬 (Least Constraining)
    valuesWithImpact.sort((a, b) => a.impact - b.impact);

    return valuesWithImpact.map(item => item.value);
  }

  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    // 전체 도메인 크기의 합이 클수록 좋음 (더 많은 선택지 남음)
    let totalDomainSize = 0;

    for (const domain of state.domains.values()) {
      totalDomainSize += domain.values.length;
    }

    return totalDomainSize;
  }

  private calculateImpact(
    variable: Variable,
    value: Value,
    timetable: TimetableData,
    state: TimetableState
  ): number {
    // 임시로 슬롯을 배정하고 다른 변수들의 도메인에 미치는 영향 계산
    const tempSlot = {
      classId: variable.classId,
      day: value.day,
      period: value.period,
      subjectId: variable.subjectId,
      teacherId: variable.teacherId,
    };

    // 제약조건 엔진으로 평가
    const result = this.constraintEngine.evaluate(tempSlot);

    // 영향 점수: 위반 제약조건 수 + 도메인 축소 정도
    let impact = result.violatedConstraints.length * 10;

    // 다른 변수들의 도메인에서 제거될 값의 수 추정
    for (const otherVariable of state.unassigned) {
      if (otherVariable === variable) continue;

      const otherKey = this.getVariableKey(otherVariable);
      const otherDomain = state.domains.get(otherKey);

      if (otherDomain) {
        // 같은 시간대의 값이 제거될 것
        const removedCount = otherDomain.values.filter(
          v => v.day === value.day && v.period === value.period
        ).length;
        impact += removedCount;
      }
    }

    return impact;
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
