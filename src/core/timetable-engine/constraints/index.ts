// 제약조건 모듈 export

export * from './BaseConstraint';
export * from './teacher_constraints';
export * from './class_constraints';
export * from './subject_constraints';
export * from './facility_constraints';
export * from './special_programs_constraints';
export * from './soft_constraints';

// 모든 제약조건 인스턴스 생성 함수
import { IConstraint } from './BaseConstraint';
import {
  TeacherNoOverlapConstraint,
  TeacherUnavailableTimeConstraint,
  TeacherMaxConsecutivePeriodsConstraint,
  TeacherLunchBeforeOverloadConstraint,
} from './teacher_constraints';
import {
  ClassNoOverlapConstraint,
  GradeCommonPeriodConstraint,
  SubjectFixedTimeConstraint,
  SubjectNoDuplicateConstraint,
} from './class_constraints';
import {
  SubjectWeeklyHoursConstraint,
  SubjectNoDuplicatePerDayConstraint,
  SubjectConsecutiveRequiredConstraint,
} from './subject_constraints';
import {
  FacilityConflictConstraint,
  FacilityDistanceConstraint,
} from './facility_constraints';
import {
  CoTeachingConstraint,
  LevelBasedClassConstraint,
  SpecialProgramConstraint,
} from './special_programs_constraints';
import {
  MinimizeConsecutiveLessonsConstraint,
  BalancedDistributionConstraint,
  MorningAfternoonBalanceConstraint,
  StudentFatigueConstraint,
} from './soft_constraints';

export function createAllConstraints(): IConstraint[] {
  return [
    // Hard Constraints
    new TeacherNoOverlapConstraint(),
    new TeacherUnavailableTimeConstraint(),
    new TeacherMaxConsecutivePeriodsConstraint(),
    new TeacherLunchBeforeOverloadConstraint(),
    new ClassNoOverlapConstraint(),
    new GradeCommonPeriodConstraint(),
    new SubjectFixedTimeConstraint(),
    new SubjectNoDuplicateConstraint(),
    new SubjectWeeklyHoursConstraint(),
    new SubjectNoDuplicatePerDayConstraint(),
    new SubjectConsecutiveRequiredConstraint(),
    new FacilityConflictConstraint(),
    new CoTeachingConstraint(),
    new LevelBasedClassConstraint(),
    new SpecialProgramConstraint(),

    // Soft Constraints
    new FacilityDistanceConstraint(),
    new MinimizeConsecutiveLessonsConstraint(),
    new BalancedDistributionConstraint(),
    new MorningAfternoonBalanceConstraint(),
    new StudentFatigueConstraint(),
  ];
}
