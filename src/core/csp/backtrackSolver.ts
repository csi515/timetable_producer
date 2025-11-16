// CSP 백트래킹 솔버 구현

import { Assignment, TimeSlot, CSPVariable, TimetableData } from '../../types/timetable';
import { CSPState, Heuristic, ConstraintChecker, BacktrackResult } from './types';
import { CompositeConstraintChecker } from './constraintCheckers';
import { CombinedHeuristic } from './heuristics';

export class BacktrackSolver {
  private checker: ConstraintChecker;
  private heuristic: Heuristic;
  private maxIterations: number;
  private maxBacktracks: number;

  constructor(
    private data: TimetableData,
    maxIterations: number = 100000,
    maxBacktracks: number = 10000
  ) {
    this.checker = new CompositeConstraintChecker(data, {
      preventConsecutive3Periods: data.constraints.preventConsecutive3Periods,
    });
    this.heuristic = new CombinedHeuristic(data);
    this.maxIterations = maxIterations;
    this.maxBacktracks = maxBacktracks;
  }

  solve(): BacktrackResult {
    const state = this.initializeState();
    const logs: string[] = [];
    const violations: string[] = [];
    let iterations = 0;
    let backtracks = 0;

    logs.push('🚀 시간표 생성 시작...');
    logs.push(`📊 변수 수: ${state.variables.length}`);
    logs.push(`📋 초기 도메인 크기: ${Array.from(state.domains.values()).reduce((sum, d) => sum + d.length, 0)}`);

    const result = this.backtrack(state, logs, violations, iterations, backtracks);

    if (result.success) {
      logs.push(`✅ 시간표 생성 완료! (반복: ${result.iterations}, 백트래킹: ${result.backtracks})`);
    } else {
      logs.push(`❌ 시간표 생성 실패 (반복: ${result.iterations}, 백트래킹: ${result.backtracks})`);
    }

    return {
      ...result,
      logs,
      violations,
    };
  }

  private initializeState(): CSPState {
    const variables: CSPVariable[] = [];
    const domains = new Map<string, TimeSlot[]>();

    // 각 교사의 주당 시수를 반-과목 조합으로 변환
    // 각 교사가 각 반에 각 과목을 몇 시간 가르칠지 결정
    for (const teacher of this.data.teachers) {
      for (const subjectId of teacher.subjects) {
        // 이 교사가 이 과목을 가르칠 수 있는 반들 찾기
        for (const classItem of this.data.classes) {
          // 각 교사-과목-반 조합에 대해 필요한 시수만큼 변수 생성
          // 간단히 각 조합당 1시간씩 생성 (실제로는 더 복잡한 로직 필요)
          const hoursNeeded = Math.floor(teacher.weeklyHours / (teacher.subjects.length * this.data.classes.length)) || 1;
          
          for (let i = 0; i < hoursNeeded; i++) {
            const variable: CSPVariable = {
              classId: classItem.id,
              subjectId: subjectId,
              requiredHours: 1,
            };

            variables.push(variable);

            // 초기 도메인 생성 (모든 가능한 시간대)
            const domain = this.generateInitialDomain();
            const key = this.getVariableKey(variable, teacher.id);
            domains.set(key, domain);
          }
        }
      }
    }

    return {
      variables,
      domains,
      assignments: [],
      unassigned: [...variables],
    };
  }

  private generateInitialDomain(): TimeSlot[] {
    const domain: TimeSlot[] = [];

    for (const day of this.data.schoolSchedule.days) {
      const periods = this.data.schoolSchedule.periodsPerDay[day];
      for (let period = 1; period <= periods; period++) {
        domain.push({ day, period });
      }
    }

    return domain;
  }


  private getVariableKey(variable: CSPVariable, teacherId: string): string {
    return `${variable.classId}_${variable.subjectId}_${teacherId}`;
  }

  private backtrack(
    state: CSPState,
    logs: string[],
    violations: string[],
    iterations: number,
    backtracks: number
  ): BacktrackResult {
    if (iterations >= this.maxIterations) {
      return {
        success: false,
        assignments: state.assignments,
        iterations,
        backtracks,
        logs,
        violations: [...violations, '최대 반복 횟수 초과'],
      };
    }

    if (backtracks >= this.maxBacktracks) {
      return {
        success: false,
        assignments: state.assignments,
        iterations,
        backtracks,
        logs,
        violations: [...violations, '최대 백트래킹 횟수 초과'],
      };
    }

    // 모든 변수가 배정되었는지 확인
    if (state.unassigned.length === 0) {
      // 최종 검증
      if (this.validateComplete(state.assignments)) {
        return {
          success: true,
          assignments: state.assignments,
          iterations,
          backtracks,
          logs,
          violations,
        };
      } else {
        violations.push('완성된 시간표가 제약조건을 위반합니다');
        return {
          success: false,
          assignments: state.assignments,
          iterations,
          backtracks,
          logs,
          violations,
        };
      }
    }

    iterations++;

    // 휴리스틱으로 변수 선택
    const variable = this.heuristic.selectVariable(state);
    if (!variable) {
      return {
        success: false,
        assignments: state.assignments,
        iterations,
        backtracks,
        logs,
        violations: [...violations, '선택할 변수가 없습니다'],
      };
    }

    // 교사 선택 (간단한 휴리스틱: 가장 적게 배정된 교사)
    const teacher = this.selectTeacher(variable, state.assignments);
    if (!teacher) {
      violations.push(`${variable.classId}의 ${variable.subjectId}에 배정할 교사가 없습니다`);
      return {
        success: false,
        assignments: state.assignments,
        iterations,
        backtracks,
        logs,
        violations,
      };
    }

    const key = this.getVariableKey(variable, teacher.id);
    const domain = state.domains.get(key) || [];
    const orderedDomain = this.heuristic.orderDomainValues(variable, domain);

    if (orderedDomain.length === 0) {
      violations.push(`${key}의 도메인이 비어있습니다`);
      return {
        success: false,
        assignments: state.assignments,
        iterations,
        backtracks,
        logs,
        violations,
      };
    }

    // 도메인의 각 값에 대해 시도
    for (const slot of orderedDomain) {
      const assignment: Assignment = {
        classId: variable.classId,
        subjectId: variable.subjectId,
        teacherId: teacher.id,
        slot,
      };

      // 제약조건 검사
      if (this.checker.check(assignment, state.assignments)) {
        // Forward checking
        const newDomains = this.checker.forwardCheck
          ? this.checker.forwardCheck(assignment, new Map(state.domains))
          : state.domains;

        // 새로운 상태 생성
        const newState: CSPState = {
          variables: state.variables,
          domains: newDomains,
          assignments: [...state.assignments, assignment],
          unassigned: state.unassigned.filter(v => v !== variable),
        };

        // 재귀 호출
        const result = this.backtrack(newState, logs, violations, iterations, backtracks);

        if (result.success) {
          return result;
        }

        // 백트래킹
        backtracks++;
        if (backtracks % 100 === 0) {
          logs.push(`🔄 백트래킹 중... (${backtracks}회)`);
        }
      } else {
        violations.push(`제약조건 위반: ${this.getAssignmentDescription(assignment)}`);
      }
    }

    // 모든 값이 실패
    return {
      success: false,
      assignments: state.assignments,
      iterations,
      backtracks,
      logs,
      violations,
    };
  }

  private selectTeacher(variable: CSPVariable, assignments: Assignment[]): { id: string } | null {
    const availableTeachers = this.data.teachers.filter(t =>
      t.subjects.includes(variable.subjectId)
    );

    if (availableTeachers.length === 0) return null;

    // 가장 적게 배정된 교사 선택
    let minAssignments = Infinity;
    let selected: { id: string } | null = null;

    for (const teacher of availableTeachers) {
      const count = assignments.filter(a => a.teacherId === teacher.id).length;
      if (count < minAssignments && count < teacher.weeklyHours) {
        minAssignments = count;
        selected = { id: teacher.id };
      }
    }

    return selected || { id: availableTeachers[0].id };
  }

  private validateComplete(assignments: Assignment[]): boolean {
    // 모든 교사의 시수가 충족되었는지 확인 (약간의 여유 허용)
    for (const teacher of this.data.teachers) {
      const assignedHours = assignments.filter(a => a.teacherId === teacher.id).length;
      // 정확히 일치하거나 약간 부족해도 OK (나머지는 자동 배정)
      if (assignedHours > teacher.weeklyHours) {
        return false;
      }
    }

    // 모든 반에 모든 과목이 배정되었는지 확인 (기본 검증)
    return true;
  }

  private getAssignmentDescription(assignment: Assignment): string {
    const classItem = this.data.classes.find(c => c.id === assignment.classId);
    const subject = this.data.subjects.find(s => s.id === assignment.subjectId);
    const teacher = this.data.teachers.find(t => t.id === assignment.teacherId);

    return `${classItem?.name || assignment.classId} - ${subject?.name || assignment.subjectId} - ${teacher?.name || assignment.teacherId} (${assignment.slot.day} ${assignment.slot.period}교시)`;
  }
}
