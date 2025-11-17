// 제약조건 전파 (Constraint Propagation)

import { Assignment, TimetableData, Timetable, TeacherTimetable } from '../types';
import { ConstraintValidator } from './validator';

export class ConstraintPropagator {
  /**
   * Forward Checking: 값 배정 시 미래 변수들의 도메인 축소
   */
  static forwardCheck(
    assignment: Assignment,
    timetable: Timetable,
    teacherTimetable: TeacherTimetable,
    data: TimetableData,
    domains: Map<string, Assignment[]>
  ): Map<string, Assignment[]> {
    const updatedDomains = new Map(domains);

    // 임시 시간표 생성
    const tempTimetable = this.createTempTimetable(timetable, assignment);
    const tempTeacherTimetable = this.createTempTeacherTimetable(teacherTimetable, assignment);

    // 모든 미배정 변수에 대해 도메인 축소
    for (const [key, domain] of domains.entries()) {
      const remainingAssignments: Assignment[] = [];

      for (const candidate of domain) {
        // 제약조건 검사
        const result = ConstraintValidator.validateBeforePlacement(
          candidate,
          tempTimetable,
          tempTeacherTimetable,
          data
        );

        if (result.satisfied) {
          remainingAssignments.push(candidate);
        }
      }

      updatedDomains.set(key, remainingAssignments);
    }

    return updatedDomains;
  }

  /**
   * Arc Consistency: 이진 제약조건에 대한 일관성 확보
   */
  static arcConsistency(
    timetable: Timetable,
    teacherTimetable: TeacherTimetable,
    data: TimetableData,
    domains: Map<string, Assignment[]>
  ): Map<string, Assignment[]> {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    const updatedDomains = new Map(domains);

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const [key, domain] of updatedDomains.entries()) {
        const originalSize = domain.length;
        const filtered = domain.filter(candidate => {
          const tempTimetable = this.createTempTimetable(timetable, candidate);
          const tempTeacherTimetable = this.createTempTeacherTimetable(teacherTimetable, candidate);

          // 다른 변수들과의 호환성 확인
          for (const [otherKey, otherDomain] of updatedDomains.entries()) {
            if (otherKey === key) continue;

            const hasCompatible = otherDomain.some(otherCandidate => {
              const result = ConstraintValidator.validateBeforePlacement(
                otherCandidate,
                tempTimetable,
                tempTeacherTimetable,
                data
              );
              return result.satisfied;
            });

            if (!hasCompatible) {
              return false; // 호환되는 값이 없으면 제거
            }
          }

          return true;
        });

        if (filtered.length < originalSize) {
          changed = true;
          updatedDomains.set(key, filtered);
        }
      }
    }

    return updatedDomains;
  }

  /**
   * 임시 시간표 생성
   */
  private static createTempTimetable(
    timetable: Timetable,
    newAssignment: Assignment
  ): Timetable {
    const temp: Timetable = JSON.parse(JSON.stringify(timetable));

    if (!temp[newAssignment.classId]) {
      temp[newAssignment.classId] = {
        월: {},
        화: {},
        수: {},
        목: {},
        금: {},
      };
    }

    if (!temp[newAssignment.classId][newAssignment.day]) {
      temp[newAssignment.classId][newAssignment.day] = {};
    }

    temp[newAssignment.classId][newAssignment.day][newAssignment.period] = newAssignment;

    return temp;
  }

  /**
   * 임시 교사 시간표 생성
   */
  private static createTempTeacherTimetable(
    teacherTimetable: TeacherTimetable,
    newAssignment: Assignment
  ): TeacherTimetable {
    const temp: TeacherTimetable = JSON.parse(JSON.stringify(teacherTimetable));

    const teacherIds = Array.isArray(newAssignment.teacherId)
      ? newAssignment.teacherId
      : [newAssignment.teacherId];

    for (const teacherId of teacherIds) {
      if (!temp[teacherId]) {
        temp[teacherId] = {
          월: {},
          화: {},
          수: {},
          목: {},
          금: {},
        };
      }

      if (!temp[teacherId][newAssignment.day]) {
        temp[teacherId][newAssignment.day] = {};
      }

      temp[teacherId][newAssignment.day][newAssignment.period] = newAssignment;
    }

    return temp;
  }
}
