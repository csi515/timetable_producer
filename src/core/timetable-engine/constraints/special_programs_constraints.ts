// 특수 프로그램 관련 제약조건

import { Assignment, TimetableData, ConstraintResult, SpecialProgram } from '../types';

export class SpecialProgramsConstraints {
  /**
   * 하드 제약: 창의적 체험활동 - 학년 전체가 동일 시간대 사용
   */
  static checkCreativeActivity(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const classItem = data.classes.find(c => c.id === assignment.classId);
    if (!classItem) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const creativePrograms = data.specialPrograms.filter(
      sp => sp.type === 'creative' && sp.grade === classItem.grade
    );

    for (const program of creativePrograms) {
      if (program.day === assignment.day && program.period === assignment.period) {
        // 창의적 체험활동 시간대에는 다른 수업 불가
        const subject = data.subjects.find(s => s.id === assignment.subjectId);
        if (subject?.name !== program.name && assignment.subjectId !== program.id) {
          return {
            satisfied: false,
            severity: 'hard',
            message: `${classItem.grade}학년 공통 창의적 체험활동 시간(${assignment.day}요일 ${assignment.period}교시)에는 다른 수업을 배정할 수 없습니다.`,
            details: {
              programName: program.name,
              attemptedSubject: subject?.name,
            },
          };
        }
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 코티칭/공동수업 - 두 명 이상의 교사가 동시에 참여
   */
  static checkCoTeaching(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.requiresCoTeaching) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 코티칭 교사 목록 확인
    const coTeachers = subject.coTeachers || [];
    if (coTeachers.length === 0) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject.name} 과목은 코티칭이 필요하지만 공동 교사가 지정되지 않았습니다.`,
        details: {
          subjectId: subject.id,
        },
      };
    }

    // 배정된 교사가 코티칭 교사 목록에 포함되는지 확인
    const assignedTeachers = Array.isArray(assignment.teacherId)
      ? assignment.teacherId
      : [assignment.teacherId];

    const missingTeachers = coTeachers.filter(ct => !assignedTeachers.includes(ct));
    if (missingTeachers.length > 0) {
      return {
        satisfied: false,
        severity: 'hard',
        message: `${subject.name} 과목은 다음 교사들이 모두 필요합니다: ${missingTeachers.map(id => data.teachers.find(t => t.id === id)?.name || id).join(', ')}`,
        details: {
          subjectId: subject.id,
          requiredTeachers: coTeachers,
          assignedTeachers,
          missingTeachers,
        },
      };
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 수준별 이동수업 - 한 학년의 특정 시간에 전체 이동수업
   */
  static checkLevelBasedTeaching(
    assignment: Assignment,
    timetable: TimetableData['timetable'],
    data: TimetableData
  ): ConstraintResult {
    const subject = data.subjects.find(s => s.id === assignment.subjectId);
    if (!subject?.levelBased) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const classItem = data.classes.find(c => c.id === assignment.classId);
    if (!classItem) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    const levelGroup = subject.levelGroup;
    if (!levelGroup) {
      return { satisfied: true, severity: 'hard', message: '' };
    }

    // 같은 학년의 같은 수준별 그룹 과목들이 같은 시간에 배정되어야 함
    const sameGradeClasses = data.classes.filter(c => c.grade === classItem.grade);
    const sameLevelSubjects = data.subjects.filter(
      s => s.levelBased && s.levelGroup === levelGroup
    );

    for (const otherClass of sameGradeClasses) {
      if (otherClass.id === assignment.classId) continue;

      const otherClassSchedule = timetable[otherClass.id];
      if (!otherClassSchedule) continue;

      const otherDaySchedule = otherClassSchedule[assignment.day];
      if (!otherDaySchedule) continue;

      const otherAssignment = otherDaySchedule[assignment.period];
      
      // 같은 시간에 다른 수준별 그룹의 과목이 있으면 안 됨
      if (otherAssignment) {
        const otherSubject = data.subjects.find(s => s.id === otherAssignment.subjectId);
        if (otherSubject?.levelBased && otherSubject.levelGroup !== levelGroup) {
          return {
            satisfied: false,
            severity: 'hard',
            message: `수준별 이동수업 시간(${assignment.day}요일 ${assignment.period}교시)에 다른 수준별 그룹의 수업이 있습니다.`,
            details: {
              levelGroup,
              conflictingGroup: otherSubject.levelGroup,
              conflictingClass: otherClass.name,
            },
          };
        }
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }

  /**
   * 하드 제약: 동아리 활동 - 전교 단위 혹은 학년 단위 편성
   */
  static checkClubActivity(
    assignment: Assignment,
    data: TimetableData
  ): ConstraintResult {
    const clubPrograms = data.specialPrograms.filter(sp => sp.type === 'club');

    for (const program of clubPrograms) {
      if (program.day === assignment.day && program.period === assignment.period) {
        const classItem = data.classes.find(c => c.id === assignment.classId);
        
        // 동아리 프로그램에 포함된 학급인지 확인
        if (program.classes && program.classes.length > 0) {
          if (!program.classes.includes(assignment.classId)) {
            return {
              satisfied: false,
              severity: 'hard',
              message: `${assignment.day}요일 ${assignment.period}교시는 동아리 활동 시간입니다.`,
              details: {
                programName: program.name,
                classId: assignment.classId,
              },
            };
          }
        } else if (program.grade && classItem) {
          // 학년 단위 동아리
          if (program.grade !== classItem.grade) {
            return {
              satisfied: false,
              severity: 'hard',
              message: `${program.grade}학년 동아리 활동 시간(${assignment.day}요일 ${assignment.period}교시)입니다.`,
              details: {
                programName: program.name,
                grade: classItem.grade,
              },
            };
          }
        }
      }
    }

    return { satisfied: true, severity: 'hard', message: '' };
  }
}
