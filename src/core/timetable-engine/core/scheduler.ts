// 시간표 생성 스케줄러 (백트래킹 + CSP)

import { TimetableData, Assignment, GenerationResult, Variable } from '../types';
import { ConstraintValidator } from './validator';
import { ConstraintPropagator } from './propagator';
import { SoftConstraintScorer } from './scorer';
import { OrderingHeuristics } from '../heuristics/ordering';
import { OptimizationHeuristics } from '../heuristics/optimization';

export class TimetableScheduler {
  private maxIterations: number;
  private maxBacktracks: number;
  private useOptimization: boolean;

  constructor(
    maxIterations: number = 100000,
    maxBacktracks: number = 10000,
    useOptimization: boolean = false
  ) {
    this.maxIterations = maxIterations;
    this.maxBacktracks = maxBacktracks;
    this.useOptimization = useOptimization;
  }

  /**
   * 시간표 생성 (백트래킹 + CSP)
   */
  generate(data: TimetableData): GenerationResult {
    const startTime = Date.now();
    let iterations = 0;
    let backtracks = 0;

    // 변수 생성
    const variables = this.createVariables(data);
    
    // 초기 도메인 생성
    const domains = this.createInitialDomains(variables, data);

    // 초기 상태
    const timetable: TimetableData['timetable'] = this.initializeTimetable(data);
    const teacherTimetable: TimetableData['teacherTimetable'] = this.initializeTeacherTimetable(data);

    const state = {
      timetable,
      teacherTimetable,
      assignments: [] as Assignment[],
      unassigned: [...variables],
      domains,
    };

    // 백트래킹 실행
    const result = this.backtrack(state, data, iterations, backtracks);

    const endTime = Date.now();
    const generationTime = endTime - startTime;

    // 최적화 (선택적)
    let finalData = data;
    if (this.useOptimization && result.success) {
      finalData.timetable = result.timetable;
      finalData.teacherTimetable = result.teacherTimetable;
      finalData = OptimizationHeuristics.simulatedAnnealing(finalData);
    }

    // 검증 및 리포트 생성
    const violations = ConstraintValidator.validateTimetable(finalData);

    return {
      success: result.success,
      timetable: finalData.timetable,
      teacherTimetable: finalData.teacherTimetable,
      violations: [
        ...violations.hardViolations.map(v => ({
          type: 'hard' as const,
          constraint: v.constraint,
          message: v.message,
          details: v.details,
        })),
        ...violations.softViolations.map(v => ({
          type: 'soft' as const,
          constraint: v.constraint,
          message: v.message,
          details: v.details,
        })),
      ],
      statistics: {
        totalAssignments: result.assignments.length,
        hardViolations: violations.summary.totalHardViolations,
        softViolations: violations.summary.totalSoftViolations,
        generationTime,
        iterations: result.iterations,
        backtracks: result.backtracks,
      },
      heuristics: {
        variableSelection: 'MRV + Degree',
        valueOrdering: 'LCV',
        strategies: ['Backtracking', 'Forward Checking', this.useOptimization ? 'Simulated Annealing' : ''],
      },
    };
  }

  /**
   * 백트래킹 알고리즘
   */
  private backtrack(
    state: {
      timetable: TimetableData['timetable'];
      teacherTimetable: TimetableData['teacherTimetable'];
      assignments: Assignment[];
      unassigned: Variable[];
      domains: Map<string, Assignment[]>;
    },
    data: TimetableData,
    iterations: number,
    backtracks: number
  ): {
    success: boolean;
    timetable: TimetableData['timetable'];
    teacherTimetable: TimetableData['teacherTimetable'];
    assignments: Assignment[];
    iterations: number;
    backtracks: number;
  } {
    if (iterations >= this.maxIterations) {
      return {
        success: false,
        timetable: state.timetable,
        teacherTimetable: state.teacherTimetable,
        assignments: state.assignments,
        iterations,
        backtracks,
      };
    }

    if (backtracks >= this.maxBacktracks) {
      return {
        success: false,
        timetable: state.timetable,
        teacherTimetable: state.teacherTimetable,
        assignments: state.assignments,
        iterations,
        backtracks,
      };
    }

    // 모든 변수가 배정되었는지 확인
    if (state.unassigned.length === 0) {
      return {
        success: true,
        timetable: state.timetable,
        teacherTimetable: state.teacherTimetable,
        assignments: state.assignments,
        iterations,
        backtracks,
      };
    }

    iterations++;

    // 변수 선택 (MRV + Degree)
    const variable = OrderingHeuristics.selectByMRV(state.unassigned, state.domains) ||
                    OrderingHeuristics.selectByDegree(state.unassigned, data);

    if (!variable) {
      return {
        success: false,
        timetable: state.timetable,
        teacherTimetable: state.teacherTimetable,
        assignments: state.assignments,
        iterations,
        backtracks,
      };
    }

    // 도메인 가져오기
    const key = this.getVariableKey(variable);
    const domain = state.domains.get(key) || [];

    if (domain.length === 0) {
      backtracks++;
      return {
        success: false,
        timetable: state.timetable,
        teacherTimetable: state.teacherTimetable,
        assignments: state.assignments,
        iterations,
        backtracks,
      };
    }

    // 값 정렬 (LCV)
    const orderedDomain = OrderingHeuristics.orderByLCV(
      domain,
      state.timetable,
      state.teacherTimetable,
      data,
      state.domains
    );

    // 각 값에 대해 시도
    for (const candidate of orderedDomain) {
      // 제약조건 검사
      const validationResult = ConstraintValidator.validateBeforePlacement(
        candidate,
        state.timetable,
        state.teacherTimetable,
        data
      );

      if (validationResult.satisfied) {
        // 배정 추가
        const newTimetable = this.addAssignment(state.timetable, candidate);
        const newTeacherTimetable = this.addAssignmentToTeacherTimetable(
          state.teacherTimetable,
          candidate
        );

        // Forward Checking
        const updatedDomains = ConstraintPropagator.forwardCheck(
          candidate,
          newTimetable,
          newTeacherTimetable,
          data,
          state.domains
        );

        // 빈 도메인 확인
        const hasEmptyDomain = Array.from(updatedDomains.values()).some(d => d.length === 0);
        if (hasEmptyDomain && state.unassigned.length > 1) {
          backtracks++;
          continue;
        }

        // 새로운 상태 생성
        const newState = {
          timetable: newTimetable,
          teacherTimetable: newTeacherTimetable,
          assignments: [...state.assignments, candidate],
          unassigned: state.unassigned.filter(v => v !== variable),
          domains: updatedDomains,
        };

        // 재귀 호출
        const result = this.backtrack(newState, data, iterations, backtracks);

        if (result.success) {
          return result;
        }

        backtracks = result.backtracks;
      } else {
        backtracks++;
      }
    }

    // 모든 값이 실패
    return {
      success: false,
      timetable: state.timetable,
      teacherTimetable: state.teacherTimetable,
      assignments: state.assignments,
      iterations,
      backtracks,
    };
  }

  /**
   * 변수 생성
   */
  private createVariables(data: TimetableData): Variable[] {
    const variables: Variable[] = [];

    for (const classItem of data.classes) {
      for (const subject of data.subjects) {
        // 이 과목을 가르칠 수 있는 교사 찾기
        const availableTeachers = data.teachers.filter(t =>
          t.subjects.includes(subject.id)
        );

        if (availableTeachers.length === 0) continue;

        // 코티칭 필요 여부 확인
        if (subject.requiresCoTeaching && subject.coTeachers) {
          // 코티칭 변수 생성
          variables.push({
            classId: classItem.id,
            subjectId: subject.id,
            teacherId: subject.coTeachers,
            requiredHours: subject.weeklyHours,
          });
        } else {
          // 각 교사별로 변수 생성
          for (const teacher of availableTeachers) {
            const hoursNeeded = Math.floor(
              teacher.weeklyHours / (teacher.subjects.length * data.classes.length)
            ) || 1;

            for (let i = 0; i < hoursNeeded; i++) {
              variables.push({
                classId: classItem.id,
                subjectId: subject.id,
                teacherId: teacher.id,
                requiredHours: 1,
              });
            }
          }
        }
      }
    }

    return variables;
  }

  /**
   * 초기 도메인 생성
   */
  private createInitialDomains(
    variables: Variable[],
    data: TimetableData
  ): Map<string, Assignment[]> {
    const domains = new Map<string, Assignment[]>();

    for (const variable of variables) {
      const assignments: Assignment[] = [];

      for (const day of data.schoolConfig.days) {
        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          assignments.push({
            classId: variable.classId,
            subjectId: variable.subjectId,
            teacherId: variable.teacherId,
            day,
            period,
            isCoTeaching: Array.isArray(variable.teacherId),
            facilityId: this.getFacilityForSubject(variable.subjectId, data),
          });
        }
      }

      const key = this.getVariableKey(variable);
      domains.set(key, assignments);
    }

    return domains;
  }

  /**
   * 시간표 초기화
   */
  private initializeTimetable(data: TimetableData): TimetableData['timetable'] {
    const timetable: TimetableData['timetable'] = {};

    for (const classItem of data.classes) {
      timetable[classItem.id] = {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      };
    }

    return timetable;
  }

  /**
   * 교사 시간표 초기화
   */
  private initializeTeacherTimetable(data: TimetableData): TimetableData['teacherTimetable'] {
    const teacherTimetable: TimetableData['teacherTimetable'] = {};

    for (const teacher of data.teachers) {
      teacherTimetable[teacher.id] = {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      };
    }

    return teacherTimetable;
  }

  /**
   * 배정 추가
   */
  private addAssignment(
    timetable: TimetableData['timetable'],
    assignment: Assignment
  ): TimetableData['timetable'] {
    const newTimetable = JSON.parse(JSON.stringify(timetable));
    newTimetable[assignment.classId][assignment.day][assignment.period] = assignment;
    return newTimetable;
  }

  /**
   * 교사 시간표에 배정 추가
   */
  private addAssignmentToTeacherTimetable(
    teacherTimetable: TimetableData['teacherTimetable'],
    assignment: Assignment
  ): TimetableData['teacherTimetable'] {
    const newTeacherTimetable = JSON.parse(JSON.stringify(teacherTimetable));

    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      if (!newTeacherTimetable[teacherId]) {
        newTeacherTimetable[teacherId] = {
          월: {},
          화: {},
          수: {},
          목: {},
          금: {},
        };
      }

      newTeacherTimetable[teacherId][assignment.day][assignment.period] = assignment;
    }

    return newTeacherTimetable;
  }

  /**
   * 과목에 필요한 교실 찾기
   */
  private getFacilityForSubject(subjectId: string, data: TimetableData): string | undefined {
    const subject = data.subjects.find(s => s.id === subjectId);
    if (!subject?.facilityType) return undefined;

    const facility = data.facilities.find(f => f.type === subject.facilityType);
    return facility?.id;
  }

  /**
   * 변수 키 생성
   */
  private getVariableKey(variable: Variable): string {
    const teacherIds = Array.isArray(variable.teacherId)
      ? variable.teacherId.join(',')
      : variable.teacherId;
    return `${variable.classId}_${variable.subjectId}_${teacherIds}`;
  }
}
