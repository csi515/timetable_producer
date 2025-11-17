// 소프트 제약조건 (가능하면 지키기)

import { BaseConstraint } from './BaseConstraint';
import { Slot, TimetableData, ConstraintEvaluationResult } from '../types';

/**
 * 교사 연속 수업 최소화 (소프트)
 */
export class MinimizeConsecutiveLessonsConstraint extends BaseConstraint {
  metadata = {
    id: 'minimize_consecutive',
    name: '교사 연속 수업 최소화',
    description: '교사의 연속 수업을 최소화합니다.',
    type: 'soft' as const,
    priority: 'medium' as const,
    category: 'teacher',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    // 소프트 제약조건이므로 항상 통과
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    // 소프트 제약조건이므로 항상 통과
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let penalty = 0;

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount > 1) {
                penalty += (consecutiveCount - 1) * 2; // 연속 수업당 2점 페널티
              }
              consecutiveCount = 0;
            }
          }

          if (consecutiveCount > 1) {
            penalty += (consecutiveCount - 1) * 2;
          }
        }
      }
    }

    return -penalty; // 페널티는 음수로 반환
  }
}

/**
 * 과목 간 균형 배치 (소프트)
 * 과목이 월~금 고르게 분포되도록
 */
export class BalancedSubjectDistributionConstraint extends BaseConstraint {
  metadata = {
    id: 'balanced_subject_distribution',
    name: '과목 균형 배치',
    description: '과목이 주간에 고르게 분포되도록 합니다.',
    type: 'soft' as const,
    priority: 'low' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let penalty = 0;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        const dayCounts: Record<string, number> = {};

        for (const day of timetable.schoolConfig.days) {
          dayCounts[day] = 0;
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              dayCounts[day]++;
              break; // 하루에 하나만 카운트
            }
          }
        }

        // 분포의 표준편차 계산
        const counts = Object.values(dayCounts);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 크면 페널티
        if (stdDev > 0.5) {
          penalty += stdDev * 3;
        }
      }
    }

    return -penalty;
  }
}

/**
 * 오전/오후 과목 몰림 방지 (소프트)
 */
export class PreventSubjectClusteringConstraint extends BaseConstraint {
  metadata = {
    id: 'prevent_subject_clustering',
    name: '과목 몰림 방지',
    description: '오전/오후에 특정 과목이 몰리지 않도록 합니다.',
    type: 'soft' as const,
    priority: 'medium' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let penalty = 0;
    const lunchPeriod = timetable.schoolConfig.lunchPeriod;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const subject of timetable.subjects) {
        let morningCount = 0;
        let afternoonCount = 0;

        for (const day of timetable.schoolConfig.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.subjectId === subject.id) {
              if (period <= lunchPeriod) {
                morningCount++;
              } else {
                afternoonCount++;
              }
            }
          }
        }

        // 오전 또는 오후에 과도하게 몰리면 페널티
        const total = morningCount + afternoonCount;
        if (total > 0) {
          const morningRatio = morningCount / total;
          const afternoonRatio = afternoonCount / total;

          if (morningRatio > 0.7 || afternoonRatio > 0.7) {
            penalty += 5;
          }
        }
      }
    }

    return -penalty;
  }
}

/**
 * 학생 피로도 고려 (소프트)
 * 수학·국어 등 집중 과목은 1·2교시에 배치 우선
 * 예체능 과목은 5·6교시 배치 우선
 */
export class StudentFatigueConstraint extends BaseConstraint {
  metadata = {
    id: 'student_fatigue',
    name: '학생 피로도 고려',
    description: '집중 과목은 오전에, 예체능은 오후에 배치합니다.',
    type: 'soft' as const,
    priority: 'medium' as const,
    category: 'subject',
  };

  checkBeforePlacement(slot: Slot, timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  validateTimetable(timetable: TimetableData): ConstraintEvaluationResult {
    return this.success();
  }

  calculateSoftScore(timetable: TimetableData): number {
    let score = 0;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      for (const day of timetable.schoolConfig.days) {
        const daySchedule = classSchedule[day as keyof typeof classSchedule];
        if (!daySchedule) continue;

        const maxPeriod = timetable.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (!slot || !slot.subjectId) continue;

          const subject = timetable.subjects.find(s => s.id === slot.subjectId);
          if (!subject) continue;

          // 집중 과목(핵심 과목)은 1-2교시에 배치되면 보너스
          if (subject.isCoreSubject && (period === 1 || period === 2)) {
            score += 3;
          } else if (subject.isCoreSubject && period > 4) {
            score -= 2; // 오후에 배치되면 페널티
          }

          // 예체능 과목은 5-6교시에 배치되면 보너스
          if (subject.difficulty === 'low' && period >= 5) {
            score += 2;
          } else if (subject.difficulty === 'low' && period <= 2) {
            score -= 1; // 오전에 배치되면 페널티
          }
        }
      }
    }

    return score;
  }
}
