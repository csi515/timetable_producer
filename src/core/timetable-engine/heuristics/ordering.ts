// 변수 및 값 순서 결정 휴리스틱

import { Assignment, TimetableData } from '../types';

export interface Variable {
  classId: string;
  subjectId: string;
  teacherId: string | string[];
  requiredHours: number;
}

export class OrderingHeuristics {
  /**
   * MRV (Minimum Remaining Values): 도메인 크기가 가장 작은 변수 선택
   */
  static selectByMRV(
    variables: Variable[],
    domains: Map<string, Assignment[]>
  ): Variable | null {
    if (variables.length === 0) return null;

    let minDomainSize = Infinity;
    let selectedVariable: Variable | null = null;

    for (const variable of variables) {
      const key = this.getVariableKey(variable);
      const domain = domains.get(key) || [];

      if (domain.length === 0) {
        // 도메인이 비어있으면 즉시 반환 (실패 상태)
        return variable;
      }

      if (domain.length < minDomainSize) {
        minDomainSize = domain.length;
        selectedVariable = variable;
      }
    }

    return selectedVariable || variables[0];
  }

  /**
   * Degree Heuristic: 충돌 가능성이 높은 변수 선택
   */
  static selectByDegree(
    variables: Variable[],
    data: TimetableData
  ): Variable | null {
    if (variables.length === 0) return null;

    let maxDegree = -1;
    let selectedVariable: Variable | null = null;

    for (const variable of variables) {
      const degree = this.calculateDegree(variable, variables, data);

      if (degree > maxDegree) {
        maxDegree = degree;
        selectedVariable = variable;
      }
    }

    return selectedVariable || variables[0];
  }

  /**
   * LCV (Least Constraining Value): 다른 변수들의 도메인에 영향을 최소화하는 값 선택
   */
  static orderByLCV(
    assignments: Assignment[],
    timetable: TimetableData['timetable'],
    teacherTimetable: TimetableData['teacherTimetable'],
    data: TimetableData,
    domains: Map<string, Assignment[]>
  ): Assignment[] {
    const assignmentsWithImpact = assignments.map(assignment => {
      const impact = this.calculateImpact(assignment, timetable, teacherTimetable, data, domains);
      return { assignment, impact };
    });

    // 영향이 작은 순서로 정렬
    assignmentsWithImpact.sort((a, b) => a.impact - b.impact);

    return assignmentsWithImpact.map(item => item.assignment);
  }

  /**
   * 변수의 Degree 계산
   */
  private static calculateDegree(
    variable: Variable,
    allVariables: Variable[],
    data: TimetableData
  ): number {
    let degree = 0;

    const subject = data.subjects.find(s => s.id === variable.subjectId);
    const teacherIds = Array.isArray(variable.teacherId) ? variable.teacherId : [variable.teacherId];

    // 연강 필요 과목은 높은 우선순위
    if (subject?.requiresConsecutive) {
      degree += 10;
    }

    // 특수 교실 필요 과목은 높은 우선순위
    if (subject?.facilityType) {
      degree += 8;
    }

    // 코티칭 필요 과목은 높은 우선순위
    if (subject?.requiresCoTeaching) {
      degree += 9;
    }

    // 수준별 이동수업은 높은 우선순위
    if (subject?.levelBased) {
      degree += 7;
    }

    // 다른 변수들과의 충돌 가능성
    for (const otherVariable of allVariables) {
      if (otherVariable === variable) continue;

      // 같은 교사인 경우 충돌 가능성 높음
      const otherTeacherIds = Array.isArray(otherVariable.teacherId)
        ? otherVariable.teacherId
        : [otherVariable.teacherId];

      if (teacherIds.some(tid => otherTeacherIds.includes(tid))) {
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

  /**
   * 값의 영향도 계산
   */
  private static calculateImpact(
    assignment: Assignment,
    timetable: TimetableData['timetable'],
    teacherTimetable: TimetableData['teacherTimetable'],
    data: TimetableData,
    domains: Map<string, Assignment[]>
  ): number {
    let impact = 0;

    // 다른 변수들의 도메인에서 제거될 값의 수 추정
    for (const [key, domain] of domains.entries()) {
      const removedCount = domain.filter(candidate => {
        // 같은 시간대의 값이 제거될 것
        return candidate.day === assignment.day && candidate.period === assignment.period;
      }).length;

      impact += removedCount;
    }

    // 교사 중복으로 인한 영향
    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacherSchedule = teacherTimetable[teacherId];
      if (teacherSchedule && teacherSchedule[assignment.day] && teacherSchedule[assignment.day][assignment.period]) {
        impact += 10; // 이미 배정되어 있으면 큰 영향
      }
    }

    return impact;
  }

  /**
   * 변수 키 생성
   */
  private static getVariableKey(variable: Variable): string {
    const teacherIds = Array.isArray(variable.teacherId)
      ? variable.teacherId.join(',')
      : variable.teacherId;
    return `${variable.classId}_${variable.subjectId}_${teacherIds}`;
  }
}
