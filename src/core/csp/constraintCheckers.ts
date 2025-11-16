// 제약조건 검사기 구현

import { Assignment, TimeSlot, Teacher, Subject, Class, TimetableData } from '../../types/timetable';
import { ConstraintChecker } from './types';

export class TeacherConflictChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    // 같은 교사가 같은 시간에 다른 반을 가르치는지 확인
    const conflicting = existingAssignments.find(
      a => a.teacherId === assignment.teacherId &&
           a.slot.day === assignment.slot.day &&
           a.slot.period === assignment.slot.period &&
           a.classId !== assignment.classId
    );
    return !conflicting;
  }

  forwardCheck(assignment: Assignment, domains: Map<string, Domain>): Map<string, Domain> {
    const updatedDomains = new Map(domains);
    
    // 이 교사가 배정된 시간을 다른 변수의 도메인에서 제거
    domains.forEach((domain, key) => {
      if (key.includes(assignment.teacherId)) {
        const filtered = domain.filter(
          slot => !(slot.day === assignment.slot.day && slot.period === assignment.slot.period)
        );
        updatedDomains.set(key, filtered);
      }
    });

    return updatedDomains;
  }
}

export class ClassConflictChecker implements ConstraintChecker {
  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    // 같은 반이 같은 시간에 다른 과목을 배정받는지 확인
    const conflicting = existingAssignments.find(
      a => a.classId === assignment.classId &&
           a.slot.day === assignment.slot.day &&
           a.slot.period === assignment.slot.period &&
           a.subjectId !== assignment.subjectId
    );
    return !conflicting;
  }
}

export class TeacherUnavailableChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const teacher = this.data.teachers.find(t => t.id === assignment.teacherId);
    if (!teacher) return false;

    const isUnavailable = teacher.unavailableSlots.some(
      slot => slot.day === assignment.slot.day && slot.period === assignment.slot.period
    );
    return !isUnavailable;
  }
}

export class ConsecutiveRequiredChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const subject = this.data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.requiresConsecutive) return true;

    // 연강이 필요한 과목은 2교시 연속으로 배정되어야 함
    const sameClassAssignments = existingAssignments.filter(
      a => a.classId === assignment.classId && a.subjectId === assignment.subjectId
    );

    // 이미 배정된 경우, 연속인지 확인
    if (sameClassAssignments.length > 0) {
      const consecutive = sameClassAssignments.some(a => {
        const periodDiff = Math.abs(a.slot.period - assignment.slot.period);
        return a.slot.day === assignment.slot.day && periodDiff === 1;
      });
      return consecutive || sameClassAssignments.length === 0;
    }

    return true;
  }
}

export class ConsecutiveForbiddenChecker implements ConstraintChecker {
  constructor(private config: { preventConsecutive3Periods: boolean }) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    if (!this.config.preventConsecutive3Periods) return true;

    // 같은 교사가 같은 반에서 연속 3교시를 가르치는지 확인
    const sameTeacherClassAssignments = existingAssignments.filter(
      a => a.teacherId === assignment.teacherId &&
           a.classId === assignment.classId &&
           a.slot.day === assignment.slot.day
    );

    if (sameTeacherClassAssignments.length >= 2) {
      const periods = [...sameTeacherClassAssignments.map(a => a.slot.period), assignment.slot.period].sort((a, b) => a - b);
      
      // 연속 3교시인지 확인
      for (let i = 0; i < periods.length - 2; i++) {
        if (periods[i + 1] === periods[i] + 1 && periods[i + 2] === periods[i] + 2) {
          return false;
        }
      }
    }

    return true;
  }
}

export class SpecialRoomConflictChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const subject = this.data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.requiresSpecialRoom) return true;

    // 같은 특별실을 같은 시간에 사용하는 다른 반이 있는지 확인
    const conflicting = existingAssignments.find(
      a => {
        const aSubject = this.data.subjects.find(s => s.id === a.subjectId);
        return aSubject?.requiresSpecialRoom &&
               aSubject?.specialRoomType === subject.specialRoomType &&
               a.slot.day === assignment.slot.day &&
               a.slot.period === assignment.slot.period &&
               a.classId !== assignment.classId;
      }
    );
    return !conflicting;
  }
}

export class SubjectLimitPerDayChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const subject = this.data.subjects.find(s => s.id === assignment.subjectId);
    const maxPerDay = subject?.maxPerDay ?? 1;

    // 같은 반, 같은 날에 이미 배정된 횟수 확인
    const sameDayCount = existingAssignments.filter(
      a => a.classId === assignment.classId &&
           a.subjectId === assignment.subjectId &&
           a.slot.day === assignment.slot.day
    ).length;

    return sameDayCount < maxPerDay;
  }
}

export class TeacherHoursLimitChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const teacher = this.data.teachers.find(t => t.id === assignment.teacherId);
    if (!teacher) return false;

    // 현재 배정된 시수 확인
    const currentHours = existingAssignments.filter(
      a => a.teacherId === assignment.teacherId
    ).length;

    return currentHours < teacher.weeklyHours;
  }
}

export class TeacherDailyLimitChecker implements ConstraintChecker {
  constructor(private data: TimetableData) {}

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    const teacher = this.data.teachers.find(t => t.id === assignment.teacherId);
    if (!teacher?.maxHoursPerDay) return true;

    // 같은 날에 이미 배정된 수업 수 확인
    const sameDayCount = existingAssignments.filter(
      a => a.teacherId === assignment.teacherId &&
           a.slot.day === assignment.slot.day
    ).length;

    return sameDayCount < teacher.maxHoursPerDay;
  }
}

// 모든 제약조건을 통합하는 체커
export class CompositeConstraintChecker implements ConstraintChecker {
  private checkers: ConstraintChecker[];

  constructor(data: TimetableData, config: { preventConsecutive3Periods: boolean }) {
    this.checkers = [
      new TeacherConflictChecker(data),
      new ClassConflictChecker(),
      new TeacherUnavailableChecker(data),
      new ConsecutiveRequiredChecker(data),
      new ConsecutiveForbiddenChecker(config),
      new SpecialRoomConflictChecker(data),
      new SubjectLimitPerDayChecker(data),
      new TeacherHoursLimitChecker(data),
      new TeacherDailyLimitChecker(data),
    ];
  }

  check(assignment: Assignment, existingAssignments: Assignment[]): boolean {
    return this.checkers.every(checker => checker.check(assignment, existingAssignments));
  }

  forwardCheck(assignment: Assignment, domains: Map<string, Domain>): Map<string, Domain> {
    let updatedDomains = domains;
    
    for (const checker of this.checkers) {
      if (checker.forwardCheck) {
        updatedDomains = checker.forwardCheck(assignment, updatedDomains);
      }
    }

    return updatedDomains;
  }
}
