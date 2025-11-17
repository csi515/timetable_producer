// 특수 프로그램 관련 제약조건

import { BaseConstraint } from './BaseConstraint';
import { TimetableSlot, TimetableData, ConstraintResult } from '../types';

/**
 * 공동수업(코티칭) 제약조건 (Hard)
 */
export class CoTeachingConstraint extends BaseConstraint {
  id = 'co_teaching';
  name = '공동수업 제약조건';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.isCoTeaching || !slot.coTeacherIds || slot.coTeacherIds.length === 0) {
      return this.success();
    }

    // 모든 공동 교사가 해당 시간에 비어있는지 확인
    const unavailableTeachers: string[] = [];

    for (const coTeacherId of slot.coTeacherIds) {
      const isAvailable = !this.isTeacherAssignedAt(timetable, coTeacherId, slot.day, slot.period, slot.classId);

      if (!isAvailable) {
        const teacher = data.teachers.find(t => t.id === coTeacherId);
        unavailableTeachers.push(teacher?.name || coTeacherId);
      }
    }

    if (unavailableTeachers.length > 0) {
      const subject = data.subjects.find(s => s.id === slot.subjectId);
      return this.failure(
        `공동수업(${subject?.name || slot.subjectId})에 필요한 교사(${unavailableTeachers.join(', ')})가 ${slot.day}요일 ${slot.period}교시에 비어있지 않습니다.`,
        {
          subjectId: slot.subjectId,
          subjectName: subject?.name,
          classId: slot.classId,
          day: slot.day,
          period: slot.period,
          unavailableTeachers,
          coTeacherIds: slot.coTeacherIds,
        }
      );
    }

    // 필요한 교실이 비어있는지 확인
    if (slot.facilityId) {
      const conflictingClass = this.findConflictingClassForFacility(
        timetable,
        slot.facilityId,
        slot.day,
        slot.period,
        slot.classId
      );

      if (conflictingClass) {
        const facility = data.facilities.find(f => f.id === slot.facilityId);
        return this.failure(
          `공동수업에 필요한 ${facility?.name || slot.facilityId}이(가) ${slot.day}요일 ${slot.period}교시에 이미 사용 중입니다.`,
          {
            facilityId: slot.facilityId,
            facilityName: facility?.name,
            conflictingClass,
            day: slot.day,
            period: slot.period,
          }
        );
      }
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    if (!data.coTeachings) return violations;

    for (const coTeaching of data.coTeachings) {
      for (const classId of coTeaching.classes) {
        const classSchedule = timetable[classId];
        if (!classSchedule) continue;

        // 해당 과목이 배정된 시간 찾기
        for (const day of data.schoolConfig.days) {
          const daySchedule = classSchedule[day];
          if (!daySchedule) continue;

          const maxPeriod = data.schoolConfig.periodsPerDay[day];
          for (let period = 1; period <= maxPeriod; period++) {
            const slot = daySchedule[period];
            if (this.isSlotEmpty(slot) || slot.subjectId !== coTeaching.subjectId) continue;

            // 공동수업인지 확인
            if (!slot.isCoTeaching || !slot.coTeacherIds) {
              violations.push(this.failure(
                `${data.classes.find(c => c.id === classId)?.name || classId}의 ${data.subjects.find(s => s.id === coTeaching.subjectId)?.name || coTeaching.subjectId} 과목이 공동수업으로 배정되지 않았습니다.`,
                {
                  coTeachingId: coTeaching.id,
                  classId,
                  subjectId: coTeaching.subjectId,
                  day,
                  period,
                }
              ));
              continue;
            }

            // 모든 공동 교사가 비어있는지 확인
            for (const coTeacherId of coTeaching.coTeacherIds) {
              const isAvailable = !this.isTeacherAssignedAt(timetable, coTeacherId, day, period, classId);
              if (!isAvailable) {
                const teacher = data.teachers.find(t => t.id === coTeacherId);
                violations.push(this.failure(
                  `공동수업에 필요한 ${teacher?.name || coTeacherId} 교사가 ${day}요일 ${period}교시에 비어있지 않습니다.`,
                  {
                    coTeachingId: coTeaching.id,
                    teacherId: coTeacherId,
                    teacherName: teacher?.name,
                    classId,
                    day,
                    period,
                  }
                ));
              }
            }
          }
        }
      }
    }

    return violations;
  }

  private isTeacherAssignedAt(timetable: any, teacherId: string, day: string, period: number, excludeClassId?: string): boolean {
    for (const classId of Object.keys(timetable)) {
      if (excludeClassId && classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (!this.isSlotEmpty(slot) && slot.teacherId === teacherId) {
        return true;
      }
    }
    return false;
  }

  private findConflictingClassForFacility(
    timetable: any,
    facilityId: string,
    day: string,
    period: number,
    excludeClassId: string
  ): string | null {
    for (const classId of Object.keys(timetable)) {
      if (classId === excludeClassId) continue;

      const slot = this.getSlot(timetable, classId, day, period);
      if (!this.isSlotEmpty(slot) && slot.facilityId === facilityId) {
        return classId;
      }
    }
    return null;
  }
}

/**
 * 수준별 이동수업 제약조건 (Hard)
 */
export class LevelBasedClassConstraint extends BaseConstraint {
  id = 'level_based_class';
  name = '수준별 이동수업';
  type = 'hard' as const;
  priority = 8;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.isLevelBased) return this.success();

    const classItem = data.classes.find(c => c.id === slot.classId);
    if (!classItem || !classItem.level) return this.success();

    // 같은 학년의 같은 수준 이동수업이 같은 시간에 있는지 확인
    const levelBasedClass = data.levelBasedClasses?.find(
      lbc => lbc.grade === classItem.grade &&
              lbc.level === classItem.level &&
              lbc.subjectId === slot.subjectId &&
              lbc.day === slot.day &&
              lbc.period === slot.period
    );

    if (!levelBasedClass) {
      return this.failure(
        `수준별 이동수업(${classItem.grade}학년 ${classItem.level}반)이 ${slot.day}요일 ${slot.period}교시에 구성되지 않았습니다.`,
        {
          classId: slot.classId,
          className: classItem.name,
          grade: classItem.grade,
          level: classItem.level,
          subjectId: slot.subjectId,
          day: slot.day,
          period: slot.period,
        }
      );
    }

    // 교사가 비어있는지 확인
    if (slot.teacherId !== levelBasedClass.teacherId) {
      const teacher = data.teachers.find(t => t.id === levelBasedClass.teacherId);
      return this.failure(
        `수준별 이동수업의 담당 교사가 ${teacher?.name || levelBasedClass.teacherId}이어야 합니다.`,
        {
          classId: slot.classId,
          expectedTeacherId: levelBasedClass.teacherId,
          expectedTeacherName: teacher?.name,
          actualTeacherId: slot.teacherId,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    if (!data.levelBasedClasses) return violations;

    for (const levelBasedClass of data.levelBasedClasses) {
      // 원본 학급들이 모두 같은 시간에 배정되었는지 확인
      for (const sourceClassId of levelBasedClass.sourceClasses) {
        const slot = this.getSlot(
          timetable,
          sourceClassId,
          levelBasedClass.period.day,
          levelBasedClass.period.period
        );

        if (this.isSlotEmpty(slot) ||
            slot.subjectId !== levelBasedClass.subjectId ||
            slot.teacherId !== levelBasedClass.teacherId ||
            !slot.isLevelBased) {
          const classItem = data.classes.find(c => c.id === sourceClassId);
          violations.push(this.failure(
            `${classItem?.name || sourceClassId}의 수준별 이동수업이 올바르게 배정되지 않았습니다.`,
            {
              levelBasedClassId: levelBasedClass.id,
              classId: sourceClassId,
              className: classItem?.name,
              expectedSubjectId: levelBasedClass.subjectId,
              expectedTeacherId: levelBasedClass.teacherId,
              day: levelBasedClass.period.day,
              period: levelBasedClass.period.period,
            }
          ));
        }
      }
    }

    return violations;
  }
}

/**
 * 창의적 체험활동/동아리 제약조건 (Hard)
 */
export class SpecialProgramConstraint extends BaseConstraint {
  id = 'special_program';
  name = '특수 프로그램 제약조건';
  type = 'hard' as const;
  priority = 9;

  checkBeforePlacement(slot: TimetableSlot, data: TimetableData, timetable: any): ConstraintResult {
    if (!slot.isSpecialProgram) return this.success();

    // 특수 프로그램이 해당 시간에 설정되어 있는지 확인
    const program = data.specialPrograms?.find(
      sp => sp.day === slot.day &&
             sp.period === slot.period &&
             sp.classes.includes(slot.classId)
    );

    if (!program) {
      const classItem = data.classes.find(c => c.id === slot.classId);
      return this.failure(
        `${classItem?.name || slot.classId}이(가) ${slot.day}요일 ${slot.period}교시에 특수 프로그램(${slot.specialProgramType}) 시간이 아닙니다.`,
        {
          classId: slot.classId,
          className: classItem?.name,
          day: slot.day,
          period: slot.period,
          programType: slot.specialProgramType,
        }
      );
    }

    return this.success();
  }

  validateTimetable(data: TimetableData, timetable: any): ConstraintResult[] {
    const violations: ConstraintResult[] = [];

    if (!data.specialPrograms) return violations;

    for (const program of data.specialPrograms) {
      for (const classId of program.classes) {
        const slot = this.getSlot(timetable, classId, program.day, program.period);

        if (this.isSlotEmpty(slot) || !slot.isSpecialProgram || slot.specialProgramType !== program.type) {
          const classItem = data.classes.find(c => c.id === classId);
          violations.push(this.failure(
            `${classItem?.name || classId}이(가) ${program.day}요일 ${program.period}교시에 ${program.name}(${program.type}) 시간이 아닙니다.`,
            {
              programId: program.name,
              programType: program.type,
              classId,
              className: classItem?.name,
              day: program.day,
              period: program.period,
            }
          ));
        }
      }
    }

    return violations;
  }
}
