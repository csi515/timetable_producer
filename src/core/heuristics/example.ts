// 휴리스틱 엔진 사용 예제 및 성능 비교

import { HeuristicEngine, HeuristicEngineConfig } from './HeuristicEngine';
import { ConstraintEngine } from '../constraints/ConstraintEngine';
import { TimetableData, Slot } from '../constraints/types';
import { TimetableState, Variable, Value, Domain } from './types';

// 예제 데이터 생성
function createExampleData(): TimetableData {
  return {
    classes: [
      { id: 'class_1', name: '1학년 1반', grade: 1, classNumber: 1 },
      { id: 'class_2', name: '1학년 2반', grade: 1, classNumber: 2 },
    ],
    subjects: [
      { id: 'math', name: '수학', maxPerDay: 1 },
      { id: 'pe', name: '체육', requiresConsecutive: true },
    ],
    teachers: [
      {
        id: 'teacher_1',
        name: '김교사',
        subjects: ['math'],
        weeklyHours: 5,
        unavailableSlots: [],
      },
    ],
    timetable: {
      class_1: { 월: {}, 화: {}, 수: {}, 목: {}, 금: {} },
      class_2: { 월: {}, 화: {}, 수: {}, 목: {}, 금: {} },
    },
    schoolSchedule: {
      days: ['월', '화', '수', '목', '금'],
      periodsPerDay: { 월: 6, 화: 6, 수: 6, 목: 6, 금: 6 },
      lunchPeriod: 4,
    },
  };
}

// 성능 측정 함수
function measurePerformance(
  config: HeuristicEngineConfig,
  iterations: number = 100
): { avgTime: number; avgIterations: number; successRate: number } {
  const data = createExampleData();
  const constraintEngine = new ConstraintEngine(data);
  const heuristicEngine = new HeuristicEngine(constraintEngine, config);

  const times: number[] = [];
  const iterationCounts: number[] = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    // 초기 상태 생성
    const initialState: TimetableState = {
      assignments: [],
      unassigned: createVariables(data),
      domains: createInitialDomains(data),
      iteration: 0,
      backtrackCount: 0,
    };

    // 간단한 시뮬레이션 (실제로는 백트래킹 알고리즘 호출)
    let state = initialState;
    let iterations = 0;
    let success = false;

    while (state.unassigned.length > 0 && iterations < 1000) {
      const variable = heuristicEngine.pickNextVariable(data, state);
      if (!variable) break;

      const values = heuristicEngine.orderDomainValues(variable, data, state);
      if (values.length === 0) {
        // 백트래킹 필요
        state.backtrackCount++;
        if (heuristicEngine.shouldRestart(state)) {
          const resetState = heuristicEngine.resetState(initialState);
          if (resetState) {
            state = resetState;
            continue;
          }
        }
        break;
      }

      // 첫 번째 값 선택 (실제로는 모든 값 시도)
      const value = values[0];
      const slot: Slot = {
        classId: variable.classId,
        day: value.day,
        period: value.period,
        subjectId: variable.subjectId,
        teacherId: variable.teacherId,
      };

      // 제약조건 검사
      const result = constraintEngine.evaluate(slot);
      if (result.satisfied) {
        state.assignments.push(slot);
        state.unassigned = state.unassigned.filter(v => v !== variable);

        // Forward Checking
        const fcResult = heuristicEngine.propagate(slot, data, state);
        if (fcResult) {
          state.domains = fcResult.updatedDomains;
        }

        if (heuristicEngine.hasEmptyDomain(state)) {
          state.backtrackCount++;
        }
      } else {
        state.backtrackCount++;
      }

      state.iteration++;
      iterations++;

      if (state.unassigned.length === 0) {
        success = true;
        break;
      }
    }

    const endTime = performance.now();
    times.push(endTime - startTime);
    iterationCounts.push(iterations);

    if (success) {
      successCount++;
    }
  }

  return {
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    avgIterations: iterationCounts.reduce((a, b) => a + b, 0) / iterationCounts.length,
    successRate: successCount / iterations,
  };
}

function createVariables(data: TimetableData): Variable[] {
  const variables: Variable[] = [];
  for (const teacher of data.teachers) {
    for (const subjectId of teacher.subjects) {
      for (const classItem of data.classes) {
        variables.push({
          classId: classItem.id,
          subjectId,
          teacherId: teacher.id,
          requiredHours: 1,
        });
      }
    }
  }
  return variables;
}

function createInitialDomains(data: TimetableData): Map<string, Domain> {
  const domains = new Map<string, Domain>();
  const variables = createVariables(data);

  for (const variable of variables) {
    const values: Value[] = [];
    for (const day of data.schoolSchedule.days) {
      const maxPeriod = data.schoolSchedule.periodsPerDay[day];
      for (let period = 1; period <= maxPeriod; period++) {
        values.push({ day, period });
      }
    }

    const key = `${variable.classId}_${variable.subjectId}_${variable.teacherId}`;
    domains.set(key, { variable, values });
  }

  return domains;
}

// 성능 비교 실행
export function compareHeuristics() {
  console.log('=== 휴리스틱 성능 비교 ===\n');

  const configs: Array<{ name: string; config: HeuristicEngineConfig }> = [
    {
      name: '기본 (MRV만)',
      config: {
        variableSelection: 'mrv',
        valueOrdering: 'default',
        useForwardChecking: false,
        useSoftScoring: false,
        useRandomizedRestart: false,
      },
    },
    {
      name: 'MRV + Forward Checking',
      config: {
        variableSelection: 'mrv',
        valueOrdering: 'default',
        useForwardChecking: true,
        useSoftScoring: false,
        useRandomizedRestart: false,
      },
    },
    {
      name: 'MRV + LCV + Forward Checking',
      config: {
        variableSelection: 'mrv',
        valueOrdering: 'lcv',
        useForwardChecking: true,
        useSoftScoring: false,
        useRandomizedRestart: false,
      },
    },
    {
      name: 'Combined + 모든 최적화',
      config: {
        variableSelection: 'combined',
        valueOrdering: 'lcv',
        useForwardChecking: true,
        useSoftScoring: true,
        useRandomizedRestart: true,
        restartConfig: {
          maxDepth: 50,
          maxRestarts: 3,
        },
      },
    },
  ];

  for (const { name, config } of configs) {
    console.log(`\n${name}:`);
    const result = measurePerformance(config, 10);
    console.log(`  평균 시간: ${result.avgTime.toFixed(2)}ms`);
    console.log(`  평균 반복: ${result.avgIterations.toFixed(1)}회`);
    console.log(`  성공률: ${(result.successRate * 100).toFixed(1)}%`);
  }
}

// 실행 (Node.js 환경에서)
if (typeof window === 'undefined') {
  compareHeuristics();
}
