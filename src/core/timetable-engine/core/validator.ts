// 제약조건 검증기

import { Assignment, TimetableData, ConstraintResult, ViolationReport } from '../types';
import { TeacherConstraints } from '../constraints/teacher_constraints';
import { ClassConstraints } from '../constraints/class_constraints';
import { SubjectConstraints } from '../constraints/subject_constraints';
import { SpecialProgramsConstraints } from '../constraints/special_programs_constraints';
import { FacilityConstraints } from '../constraints/facility_constraints';

export class ConstraintValidator {
  /**
   * 슬롯 배치 전 모든 하드 제약조건 검사
   */
  static validateBeforePlacement(
    assignment: Assignment,
    timetable: TimetableData['timetable'],
    teacherTimetable: TimetableData['teacherTimetable'],
    data: TimetableData
  ): ConstraintResult {
    const results: ConstraintResult[] = [];

    // 교사 관련 제약조건
    results.push(TeacherConstraints.checkTeacherNoOverlap(assignment, teacherTimetable, data));
    results.push(TeacherConstraints.checkTeacherUnavailableTime(assignment, data));
    results.push(TeacherConstraints.checkMaxConsecutivePeriods(assignment, teacherTimetable, data));
    results.push(TeacherConstraints.checkMaxBeforeLunch(assignment, teacherTimetable, data));

    // 학급 관련 제약조건
    results.push(ClassConstraints.checkClassNoOverlap(assignment, timetable, data));
    results.push(ClassConstraints.checkGradeCommonPeriod(assignment, data));
    results.push(ClassConstraints.checkFixedTime(assignment, data));
    results.push(ClassConstraints.checkNoConsecutiveForSubject(assignment, timetable, data));

    // 과목 관련 제약조건
    results.push(SubjectConstraints.checkWeeklyHours(assignment, timetable, data));
    results.push(SubjectConstraints.checkMaxPerDay(assignment, timetable, data));
    results.push(SubjectConstraints.checkFacilityConflict(assignment, timetable, data));
    results.push(SubjectConstraints.checkConsecutiveRequired(assignment, timetable, data));

    // 특수 프로그램 제약조건
    results.push(SpecialProgramsConstraints.checkCreativeActivity(assignment, data));
    results.push(SpecialProgramsConstraints.checkCoTeaching(assignment, data));
    results.push(SpecialProgramsConstraints.checkLevelBasedTeaching(assignment, timetable, data));
    results.push(SpecialProgramsConstraints.checkClubActivity(assignment, data));

    // 시설 관련 제약조건
    results.push(FacilityConstraints.checkExclusiveFacility(assignment, timetable, data));
    results.push(FacilityConstraints.checkFacilityCapacity(assignment, data));

    // 첫 번째 실패한 하드 제약조건 반환
    const failedHard = results.find(r => !r.satisfied && r.severity === 'hard');
    if (failedHard) {
      return failedHard;
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 소프트 제약조건 점수 계산
   */
  static calculateSoftConstraintScore(
    assignment: Assignment,
    timetable: TimetableData['timetable'],
    teacherTimetable: TimetableData['teacherTimetable'],
    data: TimetableData
  ): number {
    let score = 0;

    // 교사 연속 수업 최소화
    score += TeacherConstraints.scoreConsecutiveMinimization(assignment, teacherTimetable, data);

    // 과목 간 균형 배치
    score += ClassConstraints.scoreEvenDistribution(assignment, timetable, data);

    // 학생 피로도 고려
    score += SubjectConstraints.scoreStudentFatigue(assignment, data);

    // 교실 거리 최소화
    score += FacilityConstraints.scoreFacilityDistance(assignment, timetable, data);

    return score;
  }

  /**
   * 전체 시간표 검증 및 리포트 생성
   */
  static validateTimetable(data: TimetableData): ViolationReport {
    const hardViolations: ViolationReport['hardViolations'] = [];
    const softViolations: ViolationReport['softViolations'] = [];

    // 모든 배정 검증
    for (const classId of Object.keys(data.timetable)) {
      const classSchedule = data.timetable[classId];

      for (const day of data.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = data.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          const assignment = daySchedule[period];
          if (!assignment) continue;

          // 하드 제약조건 검사
          const hardResult = this.validateBeforePlacement(
            assignment,
            data.timetable,
            data.teacherTimetable,
            data
          );

          if (!hardResult.satisfied) {
            hardViolations.push({
              constraint: hardResult.message.split(':')[0] || 'Unknown',
              message: hardResult.message,
              assignments: [assignment],
              details: hardResult.details,
            });
          }

          // 소프트 제약조건 점수 계산
          const softScore = this.calculateSoftConstraintScore(
            assignment,
            data.timetable,
            data.teacherTimetable,
            data
          );

          if (softScore > 0) {
            softViolations.push({
              constraint: 'Soft Constraint',
              message: `소프트 제약조건 위반 (점수: ${softScore})`,
              score: softScore,
              details: { assignment, score: softScore },
            });
          }
        }
      }
    }

    return {
      hardViolations,
      softViolations,
      summary: {
        totalHardViolations: hardViolations.length,
        totalSoftViolations: softViolations.length,
        isFeasible: hardViolations.length === 0,
      },
    };
  }
}
