// Soft Constraints Scoring (소프트 제약조건 점수 계산)

import { TimetableData, Slot } from '../constraints/types';
import { TimetableState } from './types';

export interface SoftConstraintPenalty {
  lunchBeforeOverload: number; // 점심 전 과도한 배치
  consecutivePeriods: number; // 연속 수업
  unevenDistribution: number; // 불균등 분포
}

export class SoftConstraintScoring {
  private penalties: SoftConstraintPenalty;

  constructor(penalties?: Partial<SoftConstraintPenalty>) {
    this.penalties = {
      lunchBeforeOverload: penalties?.lunchBeforeOverload || 5,
      consecutivePeriods: penalties?.consecutivePeriods || 3,
      unevenDistribution: penalties?.unevenDistribution || 2,
    };
  }

  /**
   * 부분 해의 점수 계산 (높을수록 좋음)
   */
  scorePartialSolution(partialTimetable: TimetableData, state: TimetableState): number {
    let score = 1000; // 기본 점수

    // 점심 전 과도한 배치 페널티
    score -= this.calculateLunchOverloadPenalty(partialTimetable);

    // 연속 수업 페널티
    score -= this.calculateConsecutivePenalty(partialTimetable);

    // 불균등 분포 페널티
    score -= this.calculateDistributionPenalty(partialTimetable);

    return Math.max(0, score);
  }

  /**
   * 점심 전 과도한 배치 페널티 계산
   */
  private calculateLunchOverloadPenalty(timetable: TimetableData): number {
    let penalty = 0;
    const lunchPeriod = timetable.schoolSchedule.lunchPeriod || 4;
    const maxBeforeLunch = 3;

    for (const teacher of timetable.teachers) {
      for (const day of timetable.schoolSchedule.days) {
        let beforeLunchCount = 0;

        for (const classId of Object.keys(timetable.timetable)) {
          const classSchedule = timetable.timetable[classId];
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          for (let period = 1; period <= lunchPeriod; period++) {
            const slot = daySchedule[period];
            if (slot && slot.teacherId === teacher.id) {
              beforeLunchCount++;
            }
          }
        }

        if (beforeLunchCount > maxBeforeLunch) {
          penalty += (beforeLunchCount - maxBeforeLunch) * this.penalties.lunchBeforeOverload;
        }
      }
    }

    return penalty;
  }

  /**
   * 연속 수업 페널티 계산
   */
  private calculateConsecutivePenalty(timetable: TimetableData): number {
    let penalty = 0;
    const maxConsecutive = 3;

    for (const teacher of timetable.teachers) {
      for (const classId of Object.keys(timetable.timetable)) {
        const classSchedule = timetable.timetable[classId];

        for (const day of timetable.schoolSchedule.days) {
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          let consecutiveCount = 0;
          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = slot && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount > maxConsecutive) {
                penalty += (consecutiveCount - maxConsecutive) * this.penalties.consecutivePeriods;
              }
              consecutiveCount = 0;
            }
          }

          // 마지막까지 연속인 경우
          if (consecutiveCount > maxConsecutive) {
            penalty += (consecutiveCount - maxConsecutive) * this.penalties.consecutivePeriods;
          }
        }
      }
    }

    return penalty;
  }

  /**
   * 불균등 분포 페널티 계산
   */
  private calculateDistributionPenalty(timetable: TimetableData): number {
    let penalty = 0;

    for (const classItem of timetable.classes) {
      const classSchedule = timetable.timetable[classItem.id];
      if (!classSchedule) continue;

      // 각 과목별 요일 분포 확인
      for (const subject of timetable.subjects) {
        const dayCounts: Record<string, number> = {};

        for (const day of timetable.schoolSchedule.days) {
          dayCounts[day] = 0;
          const daySchedule = classSchedule[day as keyof typeof classSchedule];
          if (!daySchedule) continue;

          const maxPeriod = timetable.schoolSchedule.periodsPerDay[day as keyof typeof timetable.schoolSchedule.periodsPerDay];
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
          penalty += stdDev * this.penalties.unevenDistribution;
        }
      }
    }

    return penalty;
  }
}
