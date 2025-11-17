// 학급 관련 제약조건

import { Assignment, TimetableData, ConstraintResult, Timetable } from '../types';

export class ClassConstraints {
  /**
   * 하드 제약: 한 학급은 동일 시간에 1개 수업만 가능
   */
  static checkClassNoOverlap(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const daySchedule = classSchedule[assignment.day];
    if (!daySchedule) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const existingAssignment = daySchedule[assignment.period];

    if (existingAssignment) {
      const classItem = data.classes.find(c => c.id === assignment.classId);
      const existingSubject = data.subjects.find(s => s.id === existingAssignment.subjectId);
      const newSubject = data.subjects.find(s => s.id === assignment.subjectId);

      return {
        satisfied: false,
        severity: 'hard',
        message: `${classItem?.name || assignment.classId}이(가) ${assignment.day}요일 ${assignment.period}교시에 이미 ${existingSubject?.name || existingAssignment.subjectId} 수업이 있습니다.`,
        details: {
          classId: assignment.classId,
          existingSubject: existingSubject?.name,
          newSubject: newSubject?.name,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 학년별 공통 시간대 확인
   */
  static checkGradeCommonPeriod(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const classItem = data.classes.find(c => c.id === assignment.classId);
    if (!classItem) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const commonPeriods = data.schoolConfig.gradeCommonPeriods || [];
    const matchingPeriod = commonPeriods.find(
      cp => cp.grade === classItem.grade &&
            cp.day === assignment.day &&
            cp.period === assignment.period
    );

    if (matchingPeriod) {
      // 공통 시간대에는 특정 활동만 가능
      const subject = data.subjects.find(s => s.id === assignment.subjectId);
      const isAllowed = subject?.name === matchingPeriod.activity ||
                       assignment.subjectId === matchingPeriod.activity;

      if (!isAllowed) {
        return {
          satisfied: false,
          severity: 'hard',
          message: `${classItem.grade}학년 공통 시간대(${assignment.day}요일 ${assignment.period}교시)에는 ${matchingPeriod.activity}만 배정 가능합니다.`,
          details: {
            grade: classItem.grade,
            activity: matchingPeriod.activity,
            attemptedSubject: subject?.name,
          },
        };
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 특정 과목은 반드시 특정 요일/시간에만 편성
   */
  static checkFixedTime(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.fixedTime) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const fixedTime = subject.fixedTime;
    if (fixedTime.day !== assignment.day || fixedTime.period !== assignment.period) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject.name} 과목은 ${fixedTime.day}요일 ${fixedTime.period}교시에만 배정 가능합니다.`,
        details: {
          subjectId: subject.id,
          subjectName: subject.name,
          requiredTime: fixedTime,
          attemptedTime: { day: assignment.day, period: assignment.period },
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 특정 과목은 중복 배치 금지 (예: 체육 1,2교시 연강 불가)
   */
  static checkNoConsecutiveForSubject(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    
    // 연강이 필요한 과목은 제외
    if (subject?.requiresConsecutive) {
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

    // 인접 교시에 같은 과목이 있는지 확인
    const prevPeriod = daySchedule[assignment.period - 1];
    const nextPeriod = daySchedule[assignment.period + 1];

    if (prevPeriod?.subjectId === assignment.subjectId) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject?.name || assignment.subjectId} 과목은 연속 배치할 수 없습니다. (${assignment.period - 1}교시에 이미 배정됨)`,
        details: {
          subjectId: assignment.subjectId,
          conflictingPeriod: assignment.period - 1,
        },
      };
    }

    if (nextPeriod?.subjectId === assignment.subjectId) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject?.name || assignment.subjectId} 과목은 연속 배치할 수 없습니다. (${assignment.period + 1}교시에 이미 배정됨)`,
        details: {
          subjectId: assignment.subjectId,
          conflictingPeriod: assignment.period + 1,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 소프트 제약: 과목 간 균형 배치 (월~금 고르게)
   */
  static scoreEvenDistribution(
    assignment: Assignment,
    timetable: Timetable,
    data: TimetableData
  ): number {
    const classSchedule = timetable[assignment.classId];
    if (!classSchedule) return 0;

    // 각 요일별 해당 과목 배정 횟수 계산
    const dayCounts: Record<string, number> = {};
    for (const day of data.schoolConfig.days) {
      dayCounts[day] = 0;
      const daySchedule = classSchedule[day];
      if (!daySchedule) continue;

      const maxPeriod = data.schoolConfig.periodsPerDay[day];
      for (let p = 1; p <= maxPeriod; p++) {
        if (daySchedule[p]?.subjectId === assignment.subjectId) {
          dayCounts[day]++;
        }
      }
    }

    // 현재 배정 추가
    dayCounts[assignment.day]++;

    // 분포의 표준편차 계산
    const counts = Object.values(dayCounts);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // 표준편차가 크면 페널티
    return stdDev * 3;
  }
}
