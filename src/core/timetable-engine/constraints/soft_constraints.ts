// 소프트 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 교사 연속 수업 최소화 (Soft)
 */
export class MinimizeConsecutiveLessonsConstraint extends BaseConstraint {
  id = 'minimize_consecutive';
  name = '교사 연속 수업 최소화';
  type = 'soft' as const;
  priority = 5;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.teacherId || !slot.classId) return this.success();

    // 연속 수업이 되는지 확인
    const consecutiveCount = this.countConsecutivePeriods(
      timetable,
      slot.teacherId,
      slot.classId,
      slot.day,
      slot.period
    );

    if (consecutiveCount > 0) {
      const penalty = consecutiveCount * 2; // 연속 수업 페널티
      return this.failure(
        `연속 수업으로 인한 피로도 증가`,
        {
          teacherId: slot.teacherId,
          classId: slot.classId,
          day: slot.day,
          period: slot.period,
          consecutiveCount: consecutiveCount + 1,
        },
        penalty
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    let totalPenalty = 0;

    for (const teacher of data.teachers) {
      for (const classId of Object.keys(timetable)) {
        const classSchedule = timetable[classId];
        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = data.schoolConfig.periodsPerDay[day];
          let consecutiveCount = 0;

          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            const isAssigned = !this.isSlotEmpty(slot) && slot.teacherId === teacher.id;

            if (isAssigned) {
              consecutiveCount++;
            } else {
              if (consecutiveCount > 1) {
                totalPenalty += (consecutiveCount - 1) * 2;
                const classItem = data.classes.find(c => c.id === classId);
                violations.push(this.failure(
                  `${teacher.name} 교사가 ${classItem?.name || classId}에서 ${day}요일에 연속 ${consecutiveCount}교시 수업`,
                  {
                    teacherId: teacher.id,
                    teacherName: teacher.name,
                    classId,
                    className: classItem?.name,
                    day,
                    consecutiveCount,
                  },
                  (consecutiveCount - 1) * 2
                ));
              }
              consecutiveCount = 0;
            }
          }
        }
      }
    }

    return violations;
  }

  private countConsecutivePeriods(
    timetable: any,
    teacherId: string,
    classId: string,
    day: string,
    period: number
  ): number {
    const classSchedule = timetable[classId];
    if (!classSchedule) return 0;

    const daySchedule = classSchedule[day];
    if (!daySchedule) return 0;

    let count = 0;

    // 앞쪽 연속 교시 확인
    for (let p = period - 1; p >= 1; p--) {
      const slot = daySchedule[p];
      if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    // 뒤쪽 연속 교시 확인
    for (let p = period + 1; p <= 10; p++) {
      const slot = daySchedule[p];
      if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }
}

/**
 * 과목 간 균형 배치 (Soft)
 */
export class BalancedDistributionConstraint extends BaseConstraint {
  id = 'balanced_distribution';
  name = '과목 간 균형 배치';
  type = 'soft' as const;
  priority = 4;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    // 배치 전에는 검사 불가 (전체 시간표 완성 후 검증)
    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const classItem of data.classes) {
      const classSchedule = timetable[classItem.id];
      if (!classSchedule) continue;

      // 각 과목별 요일 분포 확인
      const subjectDistribution: Record<string, Record<string, number>> = {};

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (this.isSlotEmpty(slot) || !slot.subjectId) continue;

          if (!subjectDistribution[slot.subjectId]) {
            subjectDistribution[slot.subjectId] = {};
          }
          subjectDistribution[slot.subjectId][day] = (subjectDistribution[slot.subjectId][day] || 0) + 1;
        }
      }

      // 분포의 표준편차 계산
      for (const [subjectId, dayCounts] of Object.entries(subjectDistribution)) {
        const counts = Object.values(dayCounts);
        if (counts.length < 2) continue;

        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 크면 페널티
        if (stdDev > 0.5) {
          const subject = data.subjects.find(s => s.id === subjectId);
          violations.push(this.failure(
            `${classItem.name}의 ${subject?.name || subjectId} 과목이 요일별로 불균등하게 배정됨 (표준편차: ${stdDev.toFixed(2)})`,
            {
              subjectId,
              subjectName: subject?.name,
              classId: classItem.id,
              className: classItem.name,
              distribution: dayCounts,
              stdDev,
            },
            stdDev * 3
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 오전/오후 몰림 방지 (Soft)
 */
export class MorningAfternoonBalanceConstraint extends BaseConstraint {
  id = 'morning_afternoon_balance';
  name = '오전/오후 몰림 방지';
  type = 'soft' as const;
  priority = 4;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    // 배치 전에는 검사 불가
    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];
    const lunchPeriod = data.schoolConfig.lunchPeriod;

    for (const classItem of data.classes) {
      const classSchedule = timetable[classItem.id];
      if (!classSchedule) continue;

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        let morningCount = 0;
        let afternoonCount = 0;

        // 오전/오후 수업 수 계산
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (this.isSlotEmpty(slot)) continue;

          if (period <= lunchPeriod) {
            morningCount++;
          } else {
            afternoonCount++;
          }
        }

        // 불균형 확인 (차이가 2 이상이면 페널티)
        const imbalance = Math.abs(morningCount - afternoonCount);
        if (imbalance > 2) {
          violations.push(this.failure(
            `${classItem.name}이(가) ${day}요일에 오전 ${morningCount}교시, 오후 ${afternoonCount}교시로 불균형`,
            {
              classId: classItem.id,
              className: classItem.name,
              day,
              morningCount,
              afternoonCount,
              imbalance,
            },
            imbalance * 2
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 학생 피로도 고려 (Soft)
 */
export class StudentFatigueConstraint extends BaseConstraint {
  id = 'student_fatigue';
  name = '학생 피로도 고려';
  type = 'soft' as const;
  priority = 5;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.subjectId) return this.success();

    const subject = data.subjects.find(s => s.id === slot.subjectId);
    if (!subject) return this.success();

    // 집중 과목(수학, 국어 등)은 오전 우선
    if (subject.difficulty === 'high' && slot.period > 3) {
      return this.failure(
        `${subject.name} 과목이 오후(${slot.period}교시)에 배정됨 (오전 배정 권장)`,
        {
          subjectId: subject.id,
          subjectName: subject.name,
          difficulty: subject.difficulty,
          day: slot.day,
          period: slot.period,
        },
        3
      );
    }

    // 예체능 과목은 오후 우선
    if (subject.difficulty === 'low' && slot.period <= 3) {
      return this.failure(
        `${subject.name} 과목이 오전(${slot.period}교시)에 배정됨 (오후 배정 권장)`,
        {
          subjectId: subject.id,
          subjectName: subject.name,
          difficulty: subject.difficulty,
          day: slot.day,
          period: slot.period,
        },
        2
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    for (const classItem of data.classes) {
      const classSchedule = timetable[classItem.id];
      if (!classSchedule) continue;

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const slot = daySchedule[period];
          if (this.isSlotEmpty(slot) || !slot.subjectId) continue;

          const subject = data.subjects.find(s => s.id === slot.subjectId);
          if (!subject) continue;

          // 집중 과목이 오후에 배정된 경우
          if (subject.difficulty === 'high' && period > 3) {
            violations.push(this.failure(
              `${classItem.name}의 ${subject.name} 과목이 오후(${period}교시)에 배정됨`,
              {
                subjectId: subject.id,
                subjectName: subject.name,
                classId: classItem.id,
                className: classItem.name,
                day,
                period,
              },
              3
            ));
          }

          // 예체능 과목이 오전에 배정된 경우
          if (subject.difficulty === 'low' && period <= 3) {
            violations.push(this.failure(
              `${classItem.name}의 ${subject.name} 과목이 오전(${period}교시)에 배정됨`,
              {
                subjectId: subject.id,
                subjectName: subject.name,
                classId: classItem.id,
                className: classItem.name,
                day,
                period,
              },
              2
            ));
          }
        }
      }
    }

    return violations;
  }
}
