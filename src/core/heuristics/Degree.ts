// Degree Heuristic (충돌 가능성이 높은 변수 우선)

import { HeuristicStrategy, Variable, Value, TimetableState } from './types';
import { TimetableData, Subject } from '../constraints/types';

export class DegreeHeuristic implements HeuristicStrategy {
  name = 'Degree Heuristic';

  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    if (state.unassigned.length === 0) {
      return null;
    }

    // 충돌 가능성이 높은 변수 선택
    let maxDegree = -1;
    let selectedVariable: Variable | null = null;

    for (const variable of state.unassigned) {
      const degree = this.calculateDegree(variable, timetable, state);

      if (degree > maxDegree) {
        maxDegree = degree;
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

    return domain.values;
  }

  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    return 0;
  }

  private calculateDegree(variable: Variable, timetable: TimetableData, state: TimetableState): number {
    let degree = 0;

    const subject = timetable.subjects.find(s => s.id === variable.subjectId);
    const teacher = timetable.teachers.find(t => t.id === variable.teacherId);

    // 연강 필요 과목은 높은 우선순위
    if (subject?.requiresConsecutive) {
      degree += 10;
    }

    // 특별실 필요 과목은 높은 우선순위
    if (subject?.requiresSpecialRoom) {
      degree += 8;
    }

    // 교사 불가능 시간이 많은 경우 높은 우선순위
    if (teacher) {
      degree += teacher.unavailableSlots.length;
    }

    // 다른 변수들과의 충돌 가능성 계산
    for (const otherVariable of state.unassigned) {
      if (otherVariable === variable) continue;

      // 같은 교사인 경우 충돌 가능성 높음
      if (otherVariable.teacherId === variable.teacherId) {
        degree += 3;
      }

      // 같은 반인 경우 충돌 가능성 높음
      if (otherVariable.classId === variable.classId) {
        degree += 2;
      }

      // 같은 과목인 경우 충돌 가능성 있음
      if (otherVariable.subjectId === variable.subjectId) {
        degree += 1;
      }
    }

    return degree;
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
