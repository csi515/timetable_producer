// 휴리스틱 엔진 통합 클래스

import { HeuristicStrategy, Variable, Value, TimetableState } from './types';
import { TimetableData } from '../constraints/types';
import { MRVHeuristic } from './MRV';
import { LCVHeuristic } from './LCV';
import { DegreeHeuristic } from './Degree';
import { DynamicOrderingHeuristic } from './DynamicOrdering';
import { ForwardChecking } from './ForwardChecking';
import { SoftConstraintScoring } from './SoftConstraintScoring';
import { RandomizedRestart } from './RandomizedRestart';
import { ConstraintEngine } from '../constraints/ConstraintEngine';

export interface HeuristicEngineConfig {
  variableSelection: 'mrv' | 'degree' | 'dynamic' | 'combined';
  valueOrdering: 'lcv' | 'default';
  useForwardChecking: boolean;
  useSoftScoring: boolean;
  useRandomizedRestart: boolean;
  restartConfig?: {
    maxDepth: number;
    maxRestarts: number;
    seed?: number;
  };
}

export class HeuristicEngine {
  private variableStrategy: HeuristicStrategy;
  private valueStrategy: HeuristicStrategy;
  private forwardChecking?: ForwardChecking;
  private softScoring?: SoftConstraintScoring;
  private randomizedRestart?: RandomizedRestart;

  constructor(
    private constraintEngine: ConstraintEngine,
    config: HeuristicEngineConfig
  ) {
    // 변수 선택 전략 설정
    switch (config.variableSelection) {
      case 'mrv':
        this.variableStrategy = new MRVHeuristic();
        break;
      case 'degree':
        this.variableStrategy = new DegreeHeuristic();
        break;
      case 'dynamic':
        this.variableStrategy = new DynamicOrderingHeuristic();
        break;
      case 'combined':
        // MRV와 Degree 결합
        this.variableStrategy = new CombinedHeuristic();
        break;
      default:
        this.variableStrategy = new MRVHeuristic();
    }

    // 값 정렬 전략 설정
    if (config.valueOrdering === 'lcv') {
      this.valueStrategy = new LCVHeuristic(constraintEngine);
    } else {
      this.valueStrategy = this.variableStrategy;
    }

    // Forward Checking 설정
    if (config.useForwardChecking) {
      this.forwardChecking = new ForwardChecking(constraintEngine);
    }

    // Soft Constraint Scoring 설정
    if (config.useSoftScoring) {
      this.softScoring = new SoftConstraintScoring();
    }

    // Randomized Restart 설정
    if (config.useRandomizedRestart && config.restartConfig) {
      this.randomizedRestart = new RandomizedRestart(config.restartConfig);
    }
  }

  /**
   * 다음 배정할 변수 선택
   */
  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    return this.variableStrategy.pickNextVariable(timetable, state);
  }

  /**
   * 변수의 도메인 값 정렬
   */
  orderDomainValues(variable: Variable, timetable: TimetableData, state: TimetableState): Value[] {
    return this.valueStrategy.orderDomainValues(variable, timetable, state);
  }

  /**
   * 부분 해의 점수 계산
   */
  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    if (this.softScoring) {
      return this.softScoring.scorePartialSolution(partialTimetable, state);
    }
    return this.variableStrategy.scorePartialSolution(partialTimetable, state);
  }

  /**
   * Forward Checking 수행
   */
  propagate(assignment: any, timetable: TimetableData, state: TimetableState) {
    if (this.forwardChecking) {
      return this.forwardChecking.propagate(assignment, timetable, state);
    }
    return null;
  }

  /**
   * 빈 도메인 확인
   */
  hasEmptyDomain(state: TimetableState): boolean {
    if (this.forwardChecking) {
      return this.forwardChecking.hasEmptyDomain(state);
    }
    return false;
  }

  /**
   * 재시작 필요 여부 확인
   */
  shouldRestart(state: TimetableState): boolean {
    if (this.randomizedRestart) {
      return this.randomizedRestart.shouldRestart(state);
    }
    return false;
  }

  /**
   * 상태 재시작
   */
  resetState(initialState: TimetableState): TimetableState | null {
    if (this.randomizedRestart && this.randomizedRestart.canRestart()) {
      return this.randomizedRestart.resetState(initialState);
    }
    return null;
  }
}

// 결합 휴리스틱 (MRV + Degree)
class CombinedHeuristic implements HeuristicStrategy {
  name = 'Combined (MRV + Degree)';
  private mrv: MRVHeuristic;
  private degree: DegreeHeuristic;

  constructor() {
    this.mrv = new MRVHeuristic();
    this.degree = new DegreeHeuristic();
  }

  pickNextVariable(timetable: TimetableData, state: TimetableState): Variable | null {
    // MRV로 후보 선정
    const mrvCandidates: Variable[] = [];
    let minDomainSize = Infinity;

    for (const variable of state.unassigned) {
      const key = this.getVariableKey(variable);
      const domain = state.domains.get(key);
      const size = domain?.values.length || 0;

      if (size < minDomainSize) {
        minDomainSize = size;
        mrvCandidates.length = 0;
        mrvCandidates.push(variable);
      } else if (size === minDomainSize) {
        mrvCandidates.push(variable);
      }
    }

    if (mrvCandidates.length === 0) {
      return state.unassigned[0] || null;
    }

    // 같은 도메인 크기면 Degree로 선택
    if (mrvCandidates.length === 1) {
      return mrvCandidates[0];
    }

    // Degree가 가장 높은 것 선택
    let maxDegree = -1;
    let selected: Variable | null = null;

    for (const candidate of mrvCandidates) {
      // Degree 계산 (간단 버전)
      const degree = this.calculateSimpleDegree(candidate, timetable, state);
      if (degree > maxDegree) {
        maxDegree = degree;
        selected = candidate;
      }
    }

    return selected || mrvCandidates[0];
  }

  orderDomainValues(variable: Variable, timetable: TimetableData, state: TimetableState): Value[] {
    return this.mrv.orderDomainValues(variable, timetable, state);
  }

  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    return 0;
  }

  private calculateSimpleDegree(variable: Variable, timetable: TimetableData, state: TimetableState): number {
    let degree = 0;

    const subject = timetable.subjects.find(s => s.id === variable.subjectId);
    if (subject?.requiresConsecutive) degree += 5;
    if (subject?.requiresSpecialRoom) degree += 3;

    return degree;
  }

  private getVariableKey(variable: Variable): string {
    return `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
  }
}
