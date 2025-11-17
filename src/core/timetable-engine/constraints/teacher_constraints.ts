// 교사 관련 제약조건

import { Assignment, TimetableData, ConstraintResult, TeacherTimetable } from '../types';

export class TeacherConstraints {
  /**
   * 하드 제약: 한 교사는 동시간대에 두 개 이상의 수업 불가
   */
  static checkTeacherNoOverlap(
    assignment: Assignment,
    teacherTimetable: TeacherTimetable,
    data: TimetableData
  ): ConstraintResult {
    const teacherIds = Array.isArray(assignment.teacherId) 
      ? assignment.teacherId 
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacherSchedule = teacherTimetable[teacherId];
      if (!teacherSchedule) continue;

      const daySchedule = teacherSchedule[assignment.day];
      if (!daySchedule) continue;

      const existingAssignment = daySchedule[assignment.period];

      if (existingAssignment) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${data.teachers.find(t => t.id === teacherId)?.name || teacherId} 교사가 ${assignment.day}요일 ${assignment.period}교시에 이미 수업 중입니다.`,
          details: {
            teacherId,
            conflictingAssignment: existingAssignment,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 교사별 금지 시간대 확인
   */
  static checkTeacherUnavailableTime(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacher = data.teachers.find(t => t.id === teacherId);
      if (!teacher) continue;

      const isUnavailable = teacher.unavailableSlots.some(
        slot => slot.day === assignment.day && slot.period === assignment.period
      );

      if (isUnavailable) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${teacher.name} 교사는 ${assignment.day}요일 ${assignment.period}교시에 수업할 수 없습니다. (금지 시간대)`,
          details: {
            teacherId,
            teacherName: teacher.name,
            day: assignment.day,
            period: assignment.period,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 교사에게 연속 3교시 이상의 수업 배치 금지
   */
  static checkMaxConsecutivePeriods(
    assignment: Assignment,
    teacherTimetable: TeacherTimetable,
    data: TimetableData
  ): ConstraintResult {
    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacher = data.teachers.find(t => t.id === teacherId);
      const maxConsecutive = teacher?.maxConsecutivePeriods || 3;

      const teacherSchedule = teacherTimetable[teacherId];
      if (!teacherSchedule) continue;

      const daySchedule = teacherSchedule[assignment.day];
      if (!daySchedule) continue;

      // 앞뒤 연속 교시 확인
      let consecutiveCount = 1;

      // 앞쪽 연속 교시 확인
      for (let p = assignment.period - 1; p >= 1; p--) {
        if (daySchedule[p]) {
          consecutiveCount++;
        } else {
          break;
        }
      }

      // 뒤쪽 연속 교시 확인
      const maxPeriod = data.schoolConfig.periodsPerDay[assignment.day];
      for (let p = assignment.period + 1; p <= maxPeriod; p++) {
        if (daySchedule[p]) {
          consecutiveCount++;
        } else {
          break;
        }
      }

      if (consecutiveCount > maxConsecutive) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${teacher?.name || teacherId} 교사가 ${assignment.day}요일에 연속 ${consecutiveCount}교시 수업하게 됩니다. (최대 ${maxConsecutive}교시)`,
          details: {
            teacherId,
            consecutiveCount,
            maxConsecutive,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 점심시간 전 특정 교사에게 2시간 이상 몰리는 배치 금지
   */
  static checkMaxBeforeLunch(
    assignment: Assignment,
    teacherTimetable: TeacherTimetable,
    data: TimetableData
  ): ConstraintResult {
    if (assignment.period > data.schoolConfig.lunchPeriod) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacher = data.teachers.find(t => t.id === teacherId);
      const maxBeforeLunch = teacher?.maxBeforeLunch || 2;

      const teacherSchedule = teacherTimetable[teacherId];
      if (!teacherSchedule) continue;

      const daySchedule = teacherSchedule[assignment.day];
      if (!daySchedule) continue;

      // 점심 전 수업 수 카운트
      let beforeLunchCount = 0;
      for (let p = 1; p <= data.schoolConfig.lunchPeriod; p++) {
        if (daySchedule[p] || (p === assignment.period)) {
          beforeLunchCount++;
        }
      }

      if (beforeLunchCount > maxBeforeLunch) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${teacher?.name || teacherId} 교사가 ${assignment.day}요일 점심 전에 ${beforeLunchCount}교시 수업하게 됩니다. (최대 ${maxBeforeLunch}교시)`,
          details: {
            teacherId,
            beforeLunchCount,
            maxBeforeLunch,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 소프트 제약: 교사의 연속 수업 최소화 (점수 계산)
   */
  static scoreConsecutiveMinimization(
    assignment: Assignment,
    teacherTimetable: TeacherTimetable,
    data: TimetableData
  ): number {
    let penalty = 0;
    const teacherIds = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    for (const teacherId of teacherIds) {
      const teacherSchedule = teacherTimetable[teacherId];
      if (!teacherSchedule) continue;

      const daySchedule = teacherSchedule[assignment.day];
      if (!daySchedule) continue;

      // 앞뒤 교시 확인
      const prevPeriod = daySchedule[assignment.period - 1];
      const nextPeriod = daySchedule[assignment.period + 1];

      if (prevPeriod || nextPeriod) {
        penalty += 5; // 연속 수업 페널티
      }
    }

    return penalty;
  }
}
