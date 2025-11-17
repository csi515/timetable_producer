// 과목 관련 제약조건

import { Assignment, TimetableData, ConstraintResult, Timetable } from '../types';

export class SubjectConstraints {
  /**
   * 하드 제약: 과목별 주당 시수 정확히 만족
   */
  static checkWeeklyHours(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 현재 배정된 시수 계산
    let currentHours = 0;
    for (const day of data.schoolConfig.days) {
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      const maxPeriod = data.schoolConfig.periodsPerDay[day];
      for (let p = 1; p <= maxPeriod; p++) {
        if (daySchedule[p]?.subjectId === assignment.subjectId) {
          currentHours++;
        }
      }
    }

    // 새 배정 추가 시 시수 확인
    const newHours = currentHours + 1;

    if (newHours > subject.weeklyHours) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject.name} 과목의 주당 시수가 초과됩니다. (현재: ${currentHours}시간, 추가 후: ${newHours}시간, 필요: ${subject.weeklyHours}시간)`,
        details: {
          subjectId: subject.id,
          currentHours,
          newHours,
          requiredHours: subject.weeklyHours,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 한 과목은 동일 요일에 두 번 이상 배정 금지
   */
  static checkMaxPerDay(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const maxPerDay = subject.maxPerDay || 1;

    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const daySchedule = classSchedule[assignment.day];
    if (!daySchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 같은 날에 이미 배정된 횟수 확인
    let dailyCount = 0;
    const maxPeriod = data.schoolConfig.periodsPerDay[assignment.day];
    for (let p = 1; p <= maxPeriod; p++) {
      if (daySchedule[p]?.subjectId === assignment.subjectId) {
        dailyCount++;
      }
    }

    if (dailyCount >= maxPerDay) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject.name} 과목은 ${assignment.day}요일에 최대 ${maxPerDay}회만 배정 가능합니다. (현재 ${dailyCount}회 배정됨)`,
        details: {
          subjectId: subject.id,
          day: assignment.day,
          currentCount: dailyCount,
          maxCount: maxPerDay,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 과목별 고정 교실 예약 충돌 방지
   */
  static checkFacilityConflict(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.facilityType || !assignment.facilityId) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const facility = data.facilities.find(f => f.id === assignment.facilityId);
    if (!facility?.exclusive) {
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
   * 하드 제약: 연강 필요 과목은 연속 배치 확인
   */
  static checkConsecutiveRequired(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.requiresConsecutive) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const daySchedule = classSchedule[assignment.day];
    if (!daySchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 같은 날에 이미 배정된 같은 과목 확인
    const existingPeriods: number[] = [];
    const maxPeriod = data.schoolConfig.periodsPerDay[assignment.day];
    for (let p = 1; p <= maxPeriod; p++) {
      if (daySchedule[p]?.subjectId === assignment.subjectId) {
        existingPeriods.push(p);
      }
    }

    // 연속인지 확인
    if (existingPeriods.length > 0) {
      const allPeriods = [...existingPeriods, assignment.period].sort((a, b) => a - b);
      const isConsecutive = allPeriods.every((p, i) => 
        i === 0 || p === allPeriods[i - 1] + 1
      );

      if (!isConsecutive) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. (현재 ${existingPeriods.join(', ')}교시에 배정됨)`,
          details: {
            subjectId: subject.id,
            existingPeriods,
            newPeriod: assignment.period,
          },
        };
      }
    } else {
      // 첫 배정인 경우, 인접 교시가 비어있는지 확인
      const prevPeriod = daySchedule[assignment.period - 1];
      const nextPeriod = daySchedule[assignment.period + 1];

      if (prevPeriod && nextPeriod) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${subject.name} 과목은 연속 2교시로 배정되어야 합니다. 인접 교시가 모두 사용 중입니다.`,
          details: {
            subjectId: subject.id,
            period: assignment.period,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 소프트 제약: 학생 피로도 고려 (집중 과목은 1,2교시, 예체능은 5,6교시)
   */
  static scoreStudentFatigue(
    assignment: Assignment,
    data: TimetableData
  ): number {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject) return 0;

    let penalty = 0;

    // 선호 교시 확인
    if (subject.preferredPeriods && subject.preferredPeriods.length > 0) {
      if (!subject.preferredPeriods.includes(assignment.period)) {
        penalty += 3; // 선호 교시가 아니면 페널티
      }
    }

    // 피해야 할 교시 확인
    if (subject.avoidPeriods && subject.avoidPeriods.includes(assignment.period)) {
      penalty += 5; // 피해야 할 교시면 더 큰 페널티
    }

    // 일반적인 규칙: 집중 과목(수학, 국어 등)은 오전, 예체능은 오후
    const intensiveSubjects = ['수학', '국어', '영어', '과학'];
    const physicalSubjects = ['체육', '음악', '미술'];

    if (intensiveSubjects.includes(subject.name)) {
      if (assignment.period > 4) {
        penalty += 2; // 집중 과목이 오후면 페널티
      }
    }

    if (physicalSubjects.includes(subject.name)) {
      if (assignment.period <= 2) {
        penalty += 2; // 예체능이 오전이면 페널티
      }
    }

    return penalty;
  }
}
