// 휴리스틱 모듈 타입 정의

import { TimetableData, Slot, Day } from '../constraints/types';

export interface Variable {
  classId: string;
  subjectId: string;
  teacherId: string;
  requiredHours: number;
}

export interface Value {
  day: Day;
  period: number;
}

export interface Domain {
  variable: Variable;
  values: Value[];
}

export interface TimetableState {
  assignments: Slot[];
  unassigned: Variable[];
  domains: Map<string, Domain>; // variable key -> domain
  iteration: number;
  backtrackCount: number;
}

export interface HeuristicStrategy {
  /**
   * 다음 배정할 변수 선택
   */
  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null;

  /**
   * 변수의 도메인 값 정렬 (우선순위 순서)
   */
  orderDomainValues(variable: Variable, timetable: TimetableData, state: TimetableState): Value[];

  /**
   * 부분 해의 점수 계산 (높을수록 좋음)
   */
  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number;
}

export interface ForwardCheckingResult {
  updatedDomains: Map<string, Domain>;
  prunedValues: Array<{ variable: Variable; value: Value }>;
}
