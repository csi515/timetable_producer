// 소프트 제약조건 점수 계산기

import { TimetableData, Assignment } from '../types';
import { ConstraintValidator } from './validator';

export class SoftConstraintScorer {
  /**
   * 전체 시간표의 소프트 제약조건 점수 계산
   */
  static calculateTotalScore(data: TimetableData): number {
    let totalScore = 0;

    for (const classId of Object.keys(data.timetable)) {
      const classSchedule = data.timetable[classId];

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const assignment = daySchedule[period];
          if (!assignment) continue;

          const score = ConstraintValidator.calculateSoftConstraintScore(
            assignment,
            data.timetable,
            data.teacherTimetable,
            data
          );

          totalScore += score;
        }
      }
    }

    return totalScore;
  }

  /**
   * 특정 배정의 소프트 제약조건 점수 계산
   */
  static calculateAssignmentScore(
    assignment: Assignment,
    timetable: TimetableData['timetable'],
    teacherTimetable: TimetableData['teacherTimetable'],
    data: TimetableData
  ): number {
    return ConstraintValidator.calculateSoftConstraintScore(
      assignment,
      timetable,
      teacherTimetable,
      data
    );
  }

  /**
   * 시간표 품질 점수 (낮을수록 좋음)
   */
  static calculateQualityScore(data: TimetableData): {
    totalScore: number;
    breakdown: {
      consecutivePenalty: number;
      distributionPenalty: number;
      fatiguePenalty: number;
      facilityDistancePenalty: number;
    };
  } {
    let consecutivePenalty = 0;
    let distributionPenalty = 0;
    let fatiguePenalty = 0;
    let facilityDistancePenalty = 0;

    for (const classId of Object.keys(data.timetable)) {
      const classSchedule = data.timetable[classId];

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const assignment = daySchedule[period];
          if (!assignment) continue;

          const score = ConstraintValidator.calculateSoftConstraintScore(
            assignment,
            data.timetable,
            data.teacherTimetable,
            data
          );

          // 점수 분류 (간단한 추정)
          consecutivePenalty += score * 0.3;
          distributionPenalty += score * 0.3;
          fatiguePenalty += score * 0.2;
          facilityDistancePenalty += score * 0.2;
        }
      }
    }

    return {
      totalScore: consecutivePenalty + distributionPenalty + fatiguePenalty + facilityDistancePenalty,
      breakdown: {
        consecutivePenalty,
        distributionPenalty,
        fatiguePenalty,
        facilityDistancePenalty,
      },
    };
  }
}
