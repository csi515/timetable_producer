import { 
  ClassScheduleArray, 
  TeacherScheduleArray, 
  TeacherHoursTracker, 
  ValidationResult, 
  TimetableData, 
  ConstraintChecker,
  Teacher,
  Subject,
  Class
} from '../types';
import { DAYS, convertClassNameToKey, getCurrentTeacherHours } from '../utils/helpers';

// 제약조건 검증 시스템
export class ConstraintCheckerImpl implements ConstraintChecker {
  private schedule: ClassScheduleArray;
  private teacherSchedule: TeacherScheduleArray;
  private teacherHours: TeacherHoursTracker;
  private data: TimetableData;

  constructor(
    schedule: ClassScheduleArray,
    teacherSchedule: TeacherScheduleArray,
    teacherHours: TeacherHoursTracker,
    data: TimetableData
  ) {
    this.schedule = schedule;
    this.teacherSchedule = teacherSchedule;
    this.teacherHours = teacherHours;
    this.data = data;
  }

  // 1. 교사 가능 시간 검증
  isTeacherAvailable(teacherId: string, day: string, period: number): ValidationResult {
    const teacher = this.data.teachers.find(t => t.id === teacherId);
    if (!teacher) {
      return {
        allowed: false,
        reason: 'teacher_not_found',
        message: `교사 ID ${teacherId}를 찾을 수 없습니다.`
      };
    }

    // 불가능한 시간 확인
    if (teacher.unavailable && Array.isArray(teacher.unavailable)) {
      const isUnavailable = teacher.unavailable.some(([unavailableDay, unavailablePeriod]) => 
        unavailableDay === day && unavailablePeriod === period
      );
      
      if (isUnavailable) {
        return {
          allowed: false,
          reason: 'teacher_unavailable',
          message: `${teacher.name} 교사는 ${day}요일 ${period}교시에 수업할 수 없습니다.`,
          day,
          period
        };
      }
    }

    // 가능한 시간 제한 확인
    if (teacher.available_times && Array.isArray(teacher.available_times)) {
      const isAvailable = teacher.available_times.some(([availableDay, availablePeriod]) => 
        availableDay === day && availablePeriod === period
      );
      
      if (!isAvailable) {
        return {
          allowed: false,
          reason: 'teacher_time_not_available',
          message: `${teacher.name} 교사는 ${day}요일 ${period}교시에 수업할 수 없습니다 (가능 시간 제한).`,
          day,
          period
        };
      }
    }

    return { allowed: true };
  }

  // 2. 학급 과목 시수 제한 검증
  isClassSubjectLimitOk(classId: string, subjectId: string): ValidationResult {
    const classData = this.data.classes.find(c => c.id === classId);
    const subject = this.data.subjects.find(s => s.id === subjectId);
    
    if (!classData || !subject) {
      return {
        allowed: false,
        reason: 'class_or_subject_not_found',
        message: `학급 ID ${classId} 또는 과목 ID ${subjectId}를 찾을 수 없습니다.`
      };
    }

    // 현재 배정된 과목 시수 계산
    let currentHours = 0;
    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.values(this.schedule[classId][day]).forEach(slot => {
          if (slot && slot.subject === subjectId) {
            currentHours++;
          }
        });
      }
    });

    const targetHours = subject.weekly_hours || 1;
    
    if (currentHours >= targetHours) {
      return {
        allowed: false,
        reason: 'subject_hours_exceeded',
        message: `${classData.name} ${subject.name} 과목 시수 초과: ${currentHours}시간 >= ${targetHours}시간`,
        current: currentHours,
        max: targetHours
      };
    }

    return { allowed: true };
  }

  // 3. 교사 주간 시수 제한 검증
  isTeacherWeeklyHoursWithinLimit(teacherId: string): ValidationResult {
    const teacher = this.data.teachers.find(t => t.id === teacherId);
    if (!teacher) {
      return {
        allowed: false,
        reason: 'teacher_not_found',
        message: `교사 ID ${teacherId}를 찾을 수 없습니다.`
      };
    }

    const currentHours = this.teacherHours[teacher.name]?.current || 0;
    const maxHours = teacher.max_hours_per_week || teacher.maxHours || 22;
    
    if (currentHours >= maxHours) {
      return {
        allowed: false,
        reason: 'teacher_weekly_hours_exceeded',
        message: `${teacher.name} 교사 주간 시수 초과: ${currentHours}시간 >= ${maxHours}시간`,
        current: currentHours,
        max: maxHours
      };
    }

    return { allowed: true };
  }

  // 4. 블록제 과목 유효성 검증
  isBlockSubjectValid(subjectId: string, day: string, period: number): ValidationResult {
    const subject = this.data.subjects.find(s => s.id === subjectId);
    if (!subject || !subject.block) {
      return { allowed: true }; // 블록제 과목이 아니면 검증 불필요
    }

    // 블록제 과목은 연속 2교시가 필요
    const nextPeriod = period + 1;
    
    // 다음 교시가 존재하는지 확인
    const periodsPerDay = this.data.base?.periods_per_day || { '월': 7, '화': 7, '수': 7, '목': 7, '금': 7 };
    const maxPeriods = periodsPerDay[day] || 7;
    
    if (nextPeriod > maxPeriods) {
      return {
        allowed: false,
        reason: 'block_period_out_of_range',
        message: `${subject.name} 블록제 과목이 ${day}요일 마지막 교시에 배정되어 연속 수업이 불가능합니다.`,
        day,
        period
      };
    }

    // 다음 교시가 비어있는지 확인 (모든 학급에서)
    const classIds = Object.keys(this.schedule);
    for (const classId of classIds) {
      if (this.schedule[classId] && 
          this.schedule[classId][day] && 
          this.schedule[classId][day][nextPeriod]) {
        return {
          allowed: false,
          reason: 'block_period_conflict',
          message: `${subject.name} 블록제 과목의 다음 교시(${nextPeriod}교시)가 이미 사용 중입니다.`,
          day,
          period
        };
      }
    }

    return { allowed: true };
  }

  // 5. 공동수업 유효성 검증
  isCoTeachingValid(subjectId: string, teacher1: string, teacher2: string, day: string, period: number): ValidationResult {
    const subject = this.data.subjects.find(s => s.id === subjectId);
    if (!subject || !subject.requires_co_teaching) {
      return { allowed: true }; // 공동수업이 필요하지 않으면 검증 불필요
    }

    // 두 교사가 모두 해당 시간에 가능한지 확인
    const teacher1Check = this.isTeacherAvailable(teacher1, day, period);
    if (!teacher1Check.allowed) {
      return {
        allowed: false,
        reason: 'co_teaching_teacher1_unavailable',
        message: `공동수업 교사1(${teacher1})이 해당 시간에 수업할 수 없습니다: ${teacher1Check.message}`
      };
    }

    const teacher2Check = this.isTeacherAvailable(teacher2, day, period);
    if (!teacher2Check.allowed) {
      return {
        allowed: false,
        reason: 'co_teaching_teacher2_unavailable',
        message: `공동수업 교사2(${teacher2})이 해당 시간에 수업할 수 없습니다: ${teacher2Check.message}`
      };
    }

    // 두 교사가 같은 시간에 다른 곳에 배정되어 있지 않은지 확인
    const teacher1Schedule = this.teacherSchedule[teacher1];
    const teacher2Schedule = this.teacherSchedule[teacher2];
    
    if (teacher1Schedule && teacher1Schedule[day] && teacher1Schedule[day][period]) {
      return {
        allowed: false,
        reason: 'co_teaching_teacher1_conflict',
        message: `공동수업 교사1(${teacher1})이 ${day}요일 ${period}교시에 다른 수업에 배정되어 있습니다.`
      };
    }

    if (teacher2Schedule && teacher2Schedule[day] && teacher2Schedule[day][period]) {
      return {
        allowed: false,
        reason: 'co_teaching_teacher2_conflict',
        message: `공동수업 교사2(${teacher2})이 ${day}요일 ${period}교시에 다른 수업에 배정되어 있습니다.`
      };
    }

    return { allowed: true };
  }

  // 6. 교사 중복 배정 검증
  isTeacherConflictFree(teacherId: string, day: string, period: number, excludeClassId?: string): ValidationResult {
    const teacher = this.data.teachers.find(t => t.id === teacherId);
    if (!teacher) {
      return {
        allowed: false,
        reason: 'teacher_not_found',
        message: `교사 ID ${teacherId}를 찾을 수 없습니다.`
      };
    }

    // 모든 학급에서 해당 교사가 같은 시간에 배정되어 있는지 확인
    const classIds = Object.keys(this.schedule);
    for (const classId of classIds) {
      if (excludeClassId && classId === excludeClassId) continue;
      
      if (this.schedule[classId] && 
          this.schedule[classId][day] && 
          this.schedule[classId][day][period]) {
        const slot = this.schedule[classId][day][period];
        if (slot && slot.teachers.includes(teacherId)) {
          return {
            allowed: false,
            reason: 'teacher_time_conflict',
            message: `${teacher.name} 교사가 ${day}요일 ${period}교시에 ${classId}에서 이미 수업 중입니다.`,
            conflictClass: classId,
            day,
            period
          };
        }
      }
    }

    return { allowed: true };
  }

  // 7. 학급 주간 시수 제한 검증
  isClassWeeklyHoursWithinLimit(classId: string): ValidationResult {
    const classData = this.data.classes.find(c => c.id === classId);
    if (!classData) {
      return {
        allowed: false,
        reason: 'class_not_found',
        message: `학급 ID ${classId}를 찾을 수 없습니다.`
      };
    }

    let currentHours = 0;
    DAYS.forEach(day => {
      if (this.schedule[classId] && this.schedule[classId][day]) {
        Object.values(this.schedule[classId][day]).forEach(slot => {
          if (slot) {
            currentHours++;
          }
        });
      }
    });

    if (currentHours >= classData.weekly_hours) {
      return {
        allowed: false,
        reason: 'class_weekly_hours_exceeded',
        message: `${classData.name} 학급 주간 시수 초과: ${currentHours}시간 >= ${classData.weekly_hours}시간`,
        current: currentHours,
        max: classData.weekly_hours
      };
    }

    return { allowed: true };
  }

  // 8. 종합 검증 함수
  validatePlacement(
    classId: string,
    day: string,
    period: number,
    subjectId: string,
    teachers: string[]
  ): ValidationResult {
    // 1. 교사 가능 시간 검증
    for (const teacherId of teachers) {
      const teacherCheck = this.isTeacherAvailable(teacherId, day, period);
      if (!teacherCheck.allowed) {
        return teacherCheck;
      }
    }

    // 2. 교사 중복 배정 검증
    for (const teacherId of teachers) {
      const conflictCheck = this.isTeacherConflictFree(teacherId, day, period, classId);
      if (!conflictCheck.allowed) {
        return conflictCheck;
      }
    }

    // 3. 학급 과목 시수 제한 검증
    const subjectCheck = this.isClassSubjectLimitOk(classId, subjectId);
    if (!subjectCheck.allowed) {
      return subjectCheck;
    }

    // 4. 교사 주간 시수 제한 검증
    for (const teacherId of teachers) {
      const hoursCheck = this.isTeacherWeeklyHoursWithinLimit(teacherId);
      if (!hoursCheck.allowed) {
        return hoursCheck;
      }
    }

    // 5. 블록제 과목 검증
    const blockCheck = this.isBlockSubjectValid(subjectId, day, period);
    if (!blockCheck.allowed) {
      return blockCheck;
    }

    // 6. 공동수업 검증 (2명 이상의 교사가 있는 경우)
    if (teachers.length >= 2) {
      const coTeachingCheck = this.isCoTeachingValid(subjectId, teachers[0], teachers[1], day, period);
      if (!coTeachingCheck.allowed) {
        return coTeachingCheck;
      }
    }

    // 7. 학급 주간 시수 제한 검증
    const classHoursCheck = this.isClassWeeklyHoursWithinLimit(classId);
    if (!classHoursCheck.allowed) {
      return classHoursCheck;
    }

    return { allowed: true };
  }
}