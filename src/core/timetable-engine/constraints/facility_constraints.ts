// 시설/공간 관련 제약조건

import { Assignment, TimetableData, ConstraintResult, Timetable } from '../types';

export class FacilityConstraints {
  /**
   * 하드 제약: 특수 교실은 동시에 두 반 이상 사용 불가
   */
  static checkExclusiveFacility(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    if (!assignment.facilityId) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const facility = data.facilities.find(f => f.id === assignment.facilityId);
    if (!facility || !facility.exclusive) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 같은 교실을 같은 시간에 사용하는 다른 반 확인
    for (const classId of Object.keys(timetable)) {
      if (classId === assignment.classId) continue;

      const classSchedule = timetable[classId];
      if (!classSchedule) continue;

      const daySchedule = classSchedule[assignment.day];
      if (!daySchedule) continue;

      const conflictingAssignment = daySchedule[assignment.period];
      if (conflictingAssignment?.facilityId === assignment.facilityId) {
        const conflictingClass = data.classes.find(c => c.id === classId);
        return {
          satisfied: false,
          severity: 'hard',
          message: `${facility.name}이(가) ${assignment.day}요일 ${assignment.period}교시에 이미 ${conflictingClass?.name || classId}에서 사용 중입니다.`,
          details: {
            facilityId: facility.id,
            facilityName: facility.name,
            conflictingClass: conflictingClass?.name,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 소프트 제약: 이동수업 시 교실 거리 최소화 (가능하면 동일 층)
   */
  static scoreFacilityDistance(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): number {
    if (!assignment.facilityId) return 0;

    const facility = data.facilities.find(f => f.id === assignment.facilityId);
    if (!facility || !facility.floor) return 0;

    const classItem = data.classes.find(c => c.id === assignment.classId);
    if (!classItem) return 0;

    // 같은 날 다른 교시에 사용한 교실들의 층수 확인
    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[assignment.day];
    if (!daySchedule) return 0;

    const usedFloors: number[] = [];
    const maxPeriod = data.schoolConfig.periodsPerDay[assignment.day];
    for (let p = 1; p <= maxPeriod; p++) {
      if (p === assignment.period) continue;
      
      const otherAssignment = daySchedule[p];
      if (otherAssignment?.facilityId) {
        const otherFacility = data.facilities.find(f => f.id === otherAssignment.facilityId);
        if (otherFacility?.floor) {
          usedFloors.push(otherFacility.floor);
        }
      }
    }

    // 다른 층을 사용하면 페널티
    if (usedFloors.length > 0) {
      const differentFloors = usedFloors.filter(f => f !== facility.floor);
      return differentFloors.length * 2; // 층 차이마다 페널티
    }

    return 0;
  }

  /**
   * 하드 제약: 교실 용량 확인
   */
  static checkFacilityCapacity(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    if (!assignment.facilityId) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const facility = data.facilities.find(f => f.id === assignment.facilityId);
    if (!facility || !facility.capacity) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const classItem = data.classes.find(c => c.id === assignment.classId);
    if (!classItem) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 학급 인원수는 데이터에 없으므로 기본값 사용 (실제로는 데이터에 포함되어야 함)
    const estimatedClassSize = 30; // 기본값

    if (estimatedClassSize > facility.capacity) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${facility.name}의 수용 인원(${facility.capacity}명)이 부족합니다.`,
        details: {
          facilityId: facility.id,
          facilityName: facility.name,
          capacity: facility.capacity,
          estimatedSize: estimatedClassSize,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }
}
